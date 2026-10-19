"""
사용자 메시지 1개 →
  (위기 체크) → 감정(KcELECTRA) → 임베딩(SBERT) → 비슷한 고민 검색/고민 유형 → 직무 찾기
  → (채용공고) → system 프롬프트 조립
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from . import job_lookup
from prompts import decide_anxious

from .emotion import classify_emotion_probs
from .prompt import build_system_prompt
from .retriever import embed, search_counsel_docs, search_job_semantic

CRISIS_PATTERN = re.compile(r"죽고\s*싶|자살|극단적\s*선택|사라지고\s*싶|살기\s*싫|목숨을|자해|끝내고\s*싶")
CRISIS_REPLY = (
    "많이 힘드셨겠어요. 지금 느끼는 마음을 이야기해 줘서 정말 고마워요.\n"
    "혼자 견디기 어려울 때는 전문 상담을 꼭 받아보셨으면 해요.\n"
    "- 자살예방상담전화 109 (24시간)\n"
    "- 정신건강위기상담 1577-0199\n"
    "- 긴급한 상황이면 112 또는 119\n"
    "괜찮다면 지금 어떤 일이 있었는지 조금 더 이야기해 줄래요?"
)

# 임베딩 검색만으로 못 잡는 유형을 키워드로 보정 (면접/자소서는 아직 상담 문서가 없으므로)
CONCERN_KEYWORDS = {
    "취업진로": re.compile(r"연봉|월급|임금|전망|어떤\s*회사|기업\s*추천|채용\s*공고|공고|무슨\s*일\s*을|하는\s*일"),
    "면접": re.compile(r"면접"),
    "자기소개서": re.compile(r"자소서|자기\s*소개서|자기소개"),
}


@dataclass
class RagResult:
    system_prompt: Optional[str] = None   # None이면 GPT 호출 없이 fixed_reply 사용
    fixed_reply: Optional[str] = None
    meta: dict = field(default_factory=dict)   # chat_messages(사용자 메시지 행)에 함께 저장


def build_rag_context(
    user_msg: str,
    prev_job_name: Optional[str] = None,
    recommended_job: Optional[str] = None,
    postings_provider: Optional[Callable] = None,
    has_history: bool = False,
) -> RagResult:
    """
    prev_job_name:     같은 대화방에서 직전에 다룬 직무 (chat_messages.job_name)
    recommended_job:   팀원 '추천직업 테스트' 결과 (DB에 저장돼 있다면)
    postings_provider: (사용 안 함) 프롬프트 지침상 구체적 채용공고는 답변에 넣지 않고 '채용공고' 메뉴로 안내
    has_history:       이 대화방에 이전 대화 내역이 있는지 → 감정 임계치 선택 (없음 0.5 / 있음 0.75)
    """
    # 0) 위기 표현 → GPT를 거치지 않고 안전 응답
    if CRISIS_PATTERN.search(user_msg):
        return RagResult(fixed_reply=CRISIS_REPLY, meta={"is_crisis": True})

    # 1) 감정 + 출력 제어 (부정 감정 점수 >= 임계치 → 감정 케어 우선)
    emotion, emo_conf, emo_probs = classify_emotion_probs(user_msg)
    is_anxious, neg_score, threshold = decide_anxious(emo_probs, has_history)
    print(f"[RAG] 감정={emotion}({emo_conf:.2f}) 부정점수={neg_score:.2f} 임계치={threshold} "
          f"→ {'감정 케어 우선' if is_anxious else '취업 가이드 우선'}")

    # 2) 임베딩 한 번 → 두 검색에 재사용
    vec = embed(user_msg)
    docs, concern = search_counsel_docs(vec)
    for name, pat in CONCERN_KEYWORDS.items():
        if pat.search(user_msg):
            concern = name

    # 3) 직무 결정: 직접 언급 > 같은 대화의 이전 직무 > 추천 테스트 결과 > 의미 검색
    jobs: list = []
    keys = job_lookup.find_jobs_in_text(user_msg)
    if keys:
        jobs = [job_lookup.get_job(c, n) for c, n in keys]
    elif prev_job_name and job_lookup.get_job(None, prev_job_name):
        jobs = [job_lookup.get_job(None, prev_job_name)]
    elif recommended_job and job_lookup.get_job(None, recommended_job):
        jobs = [job_lookup.get_job(None, recommended_job)]
    else:
        hit = search_job_semantic(vec)
        if hit:
            jobs = [job_lookup.get_job(hit[0], hit[1])]
    jobs = [j for j in jobs if j]

    # 직무 1개면 같은 분야 '직무 공통'도 추가 / 직무는 없고 분야만 말했으면 '직무 공통'만
    if len(jobs) == 1:
        common = job_lookup.get_common(jobs[0]["category"])
        if common:
            jobs.append(common)
    elif not jobs:
        cat = job_lookup.find_category_in_text(user_msg)
        if cat and job_lookup.get_common(cat):
            jobs = [job_lookup.get_common(cat)]

    main_job = next((j for j in jobs if not j["is_common"]), None)

    system_prompt = build_system_prompt(emotion, concern, jobs, docs, is_anxious=is_anxious)
    return RagResult(
        system_prompt=system_prompt,
        meta={
            "emotion": emotion,
            "emotion_conf": round(emo_conf, 4),
            "concern_type": concern,
            "job_name": main_job["job_name"] if main_job else None,
            "retrieved_ids": [d["id"] for d in docs],
            "top_similarity": round(docs[0]["similarity"], 4) if docs else None,
            "is_crisis": False,
        },
    )