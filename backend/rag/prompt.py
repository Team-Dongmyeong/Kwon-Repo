"""GPT에 넘길 system 프롬프트 조립 (RAG 모드)
= prompts.SYSTEM_PROMPT(고정 지침) + prompts.build_context(요청별 분석 결과·검색 결과)
"""
from __future__ import annotations

from prompts import SYSTEM_PROMPT, build_context

# 모델/코드의 이름 → 프롬프트(SYSTEM_PROMPT)에서 쓰는 이름
EMOTION_DISPLAY = {"행복": "기쁨"}            # KcELECTRA 라벨 '행복' = 프롬프트의 '기쁨'
CONCERN_DISPLAY = {"면접": "면접준비"}

# 검색 정보(직무 데이터)를 프롬프트에 넣는 고민 유형 — 면접준비·자기소개서는 검색 없이 코칭
RAG_CONCERNS = ("취업진로", "역량부족", None)

# 고민 유형별로 직무 데이터 중 보여줄 항목
FIELDS_BY_CONCERN = {
    "취업진로": ["main_tasks", "keywords", "companies", "salary", "outlook", "majors"],
    "역량부족": ["certificates", "skills", "knowledge", "majors", "keywords"],
    None: ["main_tasks", "keywords", "skills", "certificates", "salary", "outlook"],
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
            lines.append(f"- 임금: 하위25% {job['salary_low']:,}만원 / 중위 {job['salary_mid']:,}만원 / "
                         f"상위25% {job['salary_high']:,}만원")
        elif f == "outlook" and job.get("outlook_up") is not None:
            lines.append(f"- 전망: 증가 {job['outlook_up']}% / 현상유지 {job['outlook_same']}% / "
                         f"감소 {job['outlook_down']}%")
        elif f in LABELS and job.get(f):
            lines.append(f"- {LABELS[f]}: {job[f]}")
    return "\n".join(lines)


def build_system_prompt(emotion, concern, jobs: list, docs: list,
                        is_anxious: bool = False, is_crisis: bool = False) -> str:
    main_job = next((j for j in jobs if not j["is_common"]), None)
    job_name = main_job["job_name"] if main_job else (jobs[0]["category"] + " 분야" if jobs else None)

    rag_text = ""
    if concern in RAG_CONCERNS and jobs:
        rag_text = "\n\n".join(format_job(j, concern) for j in jobs)
    if docs:
        rag_text += ("\n\n" if rag_text else "") + "[비슷한 고민 사례 — 참고용, 그대로 베끼지 말 것]\n" + \
                    "\n".join(f"{i + 1}) {d['content']}" for i, d in enumerate(docs))

    context = build_context(
        emotion=EMOTION_DISPLAY.get(emotion, emotion),
        concern_type=CONCERN_DISPLAY.get(concern, concern),
        job_name=job_name,
        rag_context=rag_text,
        is_anxious=is_anxious,
        is_crisis=is_crisis,
    )
    return SYSTEM_PROMPT.strip() + "\n\n" + context