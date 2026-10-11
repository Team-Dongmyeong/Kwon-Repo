"""
취업진로.xlsx + 역량부족.xlsx → job_profiles.jsonl (정제·병합본)

  (backend 폴더에서) python scripts/build_job_profiles.py data/취업진로.xlsx data/역량부족.xlsx data/job_profiles.jsonl

- (대분류, 중분류) 기준으로 두 파일 병합
- 임금/전망 문자열(줄바꿈·쉼표 형식 혼재)을 숫자로 파싱
- 별칭(aliases) 생성: 사용자가 "백엔드 개발", "프론트" 처럼 말해도 찾을 수 있게
- 임베딩용 profile_text 생성
CSV로 저장된 파일도 읽을 수 있습니다(.csv 확장자면 read_csv).
"""
import json
import re
import sys

import pandas as pd

# main.py 채용공고(JOB_NCS_CODES_BY_CATEGORY / JOB_SUBJOB_KEYWORDS) 이름과 맞추기
CATEGORY_RENAME = {"식/음료": "식·음료"}
JOB_RENAME = {"셰프, 주방장": "셰프·주방장", "카페, 레스토랑 매니저": "카페·레스토랑 매니저"}

# 자동 생성으로는 못 잡는 별칭 (자유롭게 추가하세요)
MANUAL_ALIASES = {
    "백엔드개발자": ["백엔드", "서버개발", "서버 개발자"],
    "AI/ML 엔지니어": ["AI 엔지니어", "AI 개발", "인공지능", "머신러닝", "딥러닝", "ML 엔지니어", "LLM"],
    "QA": ["QA", "품질관리", "테스터", "테스트 엔지니어"],
    "앱개발자": ["앱개발", "안드로이드 개발", "iOS 개발", "모바일 개발"],
    "웹개발자": ["웹개발", "웹 개발"],
    "프론트엔드개발자": ["프론트엔드", "프론트", "FE 개발"],
    "게임개발자": ["게임개발", "게임 프로그래머", "게임 클라이언트"],
    "네트워크엔지니어": ["네트워크 엔지니어", "네트워크 관리"],
    "시스템엔지니어": ["시스템 엔지니어", "인프라 엔지니어", "SE"],
    "MD": ["MD", "상품기획자", "머천다이저"],
    "콘텐츠마케터": ["콘텐츠 마케팅", "컨텐츠 마케터"],
    "홍보": ["홍보", "PR"],
    "온라인마케터": ["온라인 마케팅", "퍼포먼스 마케터", "디지털 마케터"],
    "사회복지사": ["사회복지", "복지사"],
    "UI/UX 디자이너": ["UX 디자이너", "UI 디자이너", "프로덕트 디자이너"],
    "셰프·주방장": ["셰프", "주방장", "쉐프"],
    "제과제빵사": ["제빵사", "제과", "제빵", "파티시에"],
    "카페·레스토랑 매니저": ["카페 매니저", "레스토랑 매니저", "매장 매니저"],
    "홀 서버": ["홀서빙", "서빙", "홀 서버"],
}


def read_table(path):
    """.xlsx / .csv 둘 다 지원. 엑셀에서 저장한 한글 CSV(cp949)도 읽음"""
    if not path.lower().endswith(".csv"):
        return pd.read_excel(path)
    for enc in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"CSV 인코딩을 읽을 수 없습니다: {path}")


def read_any(path: str) -> pd.DataFrame:
    df = read_table(path)
    df.columns = [c.strip() for c in df.columns]
    for c in df.columns:
        if df[c].dtype == object:
            df[c] = df[c].astype(str).str.strip()
    return df


def clean_list(s: str) -> str:
    """'a,b,  c, ' → 'a, b, c' (줄바꿈/중복공백/끝 쉼표 정리)"""
    if not s or s == "nan":
        return ""
    parts = [p.strip() for p in re.split(r"[,\n]", s)]
    return ", ".join(p for p in parts if p)


def parse_salary(s: str):
    # '하위(25%) 3,315만원 중위값 3,730만원 상위 (25%) 4,610만원'
    def grab(label):
        m = re.search(label + r"[^0-9]*?(?:\(\s*25%\s*\))?\s*([\d,]+)\s*만원", s)
        return int(m.group(1).replace(",", "")) if m else None
    return grab("하위"), grab("중위값"), grab("상위")


def parse_outlook(s: str):
    # '감소 (40%), 현상유지 (27%)...' / '감소(63%),  현상유지, (12%), 증가(24%)'
    def grab(label):
        m = re.search(label + r"[^0-9]*?(\d+)\s*%", s)
        return int(m.group(1)) if m else None
    return grab("감소"), grab("현상유지"), grab("증가")


def make_aliases(job: str) -> list[str]:
    if job == "직무 공통":
        return []
    al = {job, job.replace(" ", "")}
    if job.endswith("디자이너"):
        al.add(job[:-4] + "디자인")            # 'UI/UX 디자이너' → 'UI/UX 디자인'
    if job.endswith("개발자"):
        al.add(job[:-1])                       # '백엔드개발자' → '백엔드개발'
    al.update(MANUAL_ALIASES.get(job, []))
    return sorted(al, key=len, reverse=True)


def build_profile_text(r: dict) -> str:
    name = r["category"] + " 분야 공통" if r["is_common"] else f"{r['category']} {r['job_name']}"
    return (
        f"{name}. 주요 업무: {r['main_tasks']}. 직무 키워드: {r['keywords']}. "
        f"필요 기술: {r['skills']}. 필수 지식: {r['knowledge']}. "
        f"관련 자격증: {r['certificates']}. 관련 학과: {r['majors']}."
    )


def main(career_path, comp_path, out_path):
    career = read_any(career_path)
    comp = read_any(comp_path)
    df = career.merge(comp, on=["대분류", "중분류"], how="outer", validate="one_to_one")
    df["대분류"] = df["대분류"].replace(CATEGORY_RENAME)
    df["중분류"] = df["중분류"].replace(JOB_RENAME)

    rows = []
    for _, x in df.iterrows():
        lo, mid, hi = parse_salary(x["임금"])
        down, same, up = parse_outlook(x["전망"])
        r = {
            "category": x["대분류"],
            "job_name": x["중분류"],
            "is_common": x["중분류"] == "직무 공통",
            "aliases": make_aliases(x["중분류"]),
            "keywords": clean_list(x["직무 키워드"]),
            "companies": clean_list(x["추천 기업"]),
            "main_tasks": clean_list(x["주요 수행 업무"]),
            "salary_low": lo, "salary_mid": mid, "salary_high": hi,
            "outlook_down": down, "outlook_same": same, "outlook_up": up,
            "certificates": clean_list(x["관련 자격증"]),
            "skills": clean_list(x["필요 기술"]),
            "majors": clean_list(x["관련학과"]),
            "knowledge": clean_list(x["필수 지식"]),
        }
        r["profile_text"] = build_profile_text(r)
        rows.append(r)

    with open(out_path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # 검증 출력
    bad = [r["job_name"] for r in rows if None in (r["salary_low"], r["salary_mid"], r["salary_high"],
                                                    r["outlook_down"], r["outlook_same"], r["outlook_up"])]
    print(f"{len(rows)}개 직무 저장 → {out_path}")
    print("파싱 실패:", bad or "없음")


if __name__ == "__main__":
    main(*sys.argv[1:4])
