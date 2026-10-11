"""GPT에 넘길 system 프롬프트 조립 (RAG 모드)"""
from __future__ import annotations

from prompts import BASE_PROMPT

RAG_RULES = """
[참고 자료 사용 규칙]
- 아래 [직무 데이터]의 수치(연봉, 전망 비율)는 데이터에 있는 값만 "참고 데이터 기준"이라고 밝히고 인용하세요.
  데이터에 없는 숫자는 만들지 마세요.
- '추천 기업'은 해당 직무 채용 사례가 있는 기업 예시일 뿐, 합격·채용을 보장하지 않습니다.
- [현재 모집 중인 채용공고]가 있으면 사용자가 관심 있어 할 때 기관명·마감일과 함께 소개하세요.
  목록에 없는 공고는 절대 만들어내지 마세요.
- [비슷한 고민 사례]는 참고용입니다. 그대로 베끼지 말고 사용자 상황에 맞게 활용하세요.
- 먼저 감정을 짧게 알아주고, 마지막에는 사용자가 바로 해볼 수 있는 행동 1가지를 제안하세요.
"""

EMOTION_GUIDE = {
    "슬픔": "사용자가 슬퍼합니다. 위로와 공감을 충분히 먼저 하고, 조언은 부담 없는 작은 것 하나만.",
    "공포": "사용자가 불안해합니다. 불안을 인정하고, 막연함이 줄도록 구체적인 정보 위주로 차분하게.",
    "분노": "사용자가 화가 나 있습니다. 감정을 인정하고 반박하지 마세요. 해결책은 그다음에 짧게.",
    "혐오": "사용자가 강한 거부감을 느낍니다. 판단하지 말고 무엇이 싫은지 이해하려는 태도로.",
    "놀람": "사용자가 놀라거나 당황했습니다. 상황을 정리해 주고 차근차근 설명하세요.",
    "행복": "사용자가 긍정적입니다. 함께 기뻐하고 다음 단계를 구체적으로 제안하세요.",
    "중립": "정보를 원하는 상황입니다. 공감은 짧게, 구체적인 정보와 방법 위주로.",
}
EMOTION_MIN_CONF = 0.5   # 확률이 이보다 낮으면 감정 지침을 넣지 않음

# 고민 유형별로 직무 데이터 중 보여줄 항목
FIELDS_BY_CONCERN = {
    "취업진로": ["main_tasks", "keywords", "companies", "salary", "outlook", "majors"],
    "역량부족": ["certificates", "skills", "knowledge", "majors", "keywords"],
    "면접": ["main_tasks", "skills", "knowledge", "keywords"],
    "자기소개서": ["main_tasks", "skills", "keywords"],
    None: ["main_tasks", "keywords", "skills", "certificates", "salary", "outlook"],
}
CONCERN_GUIDE = {
    "면접": "직무 데이터의 주요 업무·필요 기술을 근거로 예상 면접 질문과 답변 방향을 제시하세요.",
    "자기소개서": "직무 데이터의 주요 업무·필요 기술을 근거로 자기소개서에서 강조할 역량과 경험 소재를 제안하세요.",
}
LABELS = {
    "main_tasks": "주요 수행 업무", "keywords": "직무 키워드", "companies": "추천 기업(예시)",
    "certificates": "관련 자격증", "skills": "필요 기술", "knowledge": "필수 지식", "majors": "관련 학과",
}


def format_job(job: dict, concern) -> str:
    title = f"{job['category']} 분야 공통" if job["is_common"] else f"{job['job_name']} ({job['category']})"
    lines = [f"■ {title}"]
    for f in FIELDS_BY_CONCERN.get(concern, FIELDS_BY_CONCERN[None]):
        if f == "salary" and job.get("salary_mid"):
            lines.append(f"- 연봉: 하위25% {job['salary_low']:,}만원 / 중위 {job['salary_mid']:,}만원 / "
                         f"상위25% {job['salary_high']:,}만원")
        elif f == "outlook" and job.get("outlook_up") is not None:
            lines.append(f"- 향후 일자리 전망: 증가 {job['outlook_up']}% / 현상유지 {job['outlook_same']}% / "
                         f"감소 {job['outlook_down']}%")
        elif f in LABELS and job.get(f):
            lines.append(f"- {LABELS[f]}: {job[f]}")
    return "\n".join(lines)


def build_system_prompt(emotion, emotion_conf: float, concern, jobs: list,
                        docs: list, postings: list) -> str:
    parts = [BASE_PROMPT.strip(), RAG_RULES.strip()]
    if emotion and emotion_conf >= EMOTION_MIN_CONF and emotion in EMOTION_GUIDE:
        parts.append(f"[사용자 감정] {emotion} → {EMOTION_GUIDE[emotion]}")
    if concern:
        parts.append(f"[추정 고민 유형] {concern}")
        if concern in CONCERN_GUIDE:
            parts.append(CONCERN_GUIDE[concern])
    if jobs:
        parts.append("[직무 데이터]\n" + "\n\n".join(format_job(j, concern) for j in jobs))
    else:
        parts.append("(관심 직무가 아직 파악되지 않았습니다. 필요하면 관심 직무나 전공을 자연스럽게 물어보세요.)")
    if postings:
        parts.append("[현재 모집 중인 채용공고]\n" + "\n".join(
            f"- {p['company']} | {p['title']} | 마감 {p['deadline']}" for p in postings))
    if docs:
        parts.append("[비슷한 고민 사례]\n" + "\n".join(f"{i + 1}) {d['content']}" for i, d in enumerate(docs)))
    return "\n\n".join(parts)
