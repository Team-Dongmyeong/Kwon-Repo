"""
직무 프로필(취업진로+역량부족 병합본) 조회.
37행뿐이라 서버 시작 시 메모리에 올려두고, 문장 속 직무명/별칭을 문자열로 먼저 찾습니다.
"""
from __future__ import annotations

import re

from .db import get_db

# 특정 직무 없이 분야만 말했을 때 → 그 분야의 '직무 공통' 행 사용
# (분야 이름은 main.py 채용공고의 JOB_NCS_CODES_BY_CATEGORY와 같게 맞춤)
CATEGORY_ALIASES = {
    "IT/SW": ["IT", "개발자", "프로그래머", "소프트웨어", "코딩"],
    "MD/상품기획": ["상품기획", "마케팅", "마케터"],
    "공공·복지": ["공공기관", "복지"],
    "디자인": ["디자인", "디자이너"],
    "식·음료": ["요식업", "외식", "조리", "요리"],
}

_jobs: dict = {}            # (category, job_name) → row
_alias_index: list = []     # [(alias, key)], 긴 별칭 우선


def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


def _is_ascii(s: str) -> bool:
    return all(ord(c) < 128 for c in s)


def load_jobs(rows: list | None = None) -> int:
    """rows를 넘기면 DB 대신 사용(테스트용). 반환: 직무 수"""
    if rows is None:
        rows = get_db().table("job_profiles").select(
            "id, category, job_name, is_common, aliases, keywords, companies, main_tasks, "
            "salary_low, salary_mid, salary_high, outlook_down, outlook_same, outlook_up, "
            "certificates, skills, majors, knowledge"
        ).execute().data or []
    _jobs.clear()
    _alias_index.clear()
    for r in rows:
        key = (r["category"], r["job_name"])
        _jobs[key] = r
        for a in r.get("aliases") or []:
            _alias_index.append((a, key))
    _alias_index.sort(key=lambda x: len(x[0]), reverse=True)
    return len(rows)


def _contains(text: str, alias: str) -> bool:
    if _is_ascii(alias.replace(" ", "")):
        # 영문 별칭(QA, MD, PR...)은 단어 경계로: 'mail' 속 'ai' 같은 오탐 방지
        return re.search(r"(?<![A-Za-z])" + re.escape(alias) + r"(?![A-Za-z])", text, re.I) is not None
    return _norm(alias) in _norm(text)


def find_jobs_in_text(text: str, limit: int = 2) -> list:
    """문장에 나온 직무 key 목록 (최대 2개: '백엔드랑 프론트 중 뭐가 나아?' 비교 질문 대응)"""
    found: list = []
    for alias, key in _alias_index:
        if key not in found and _contains(text, alias):
            found.append(key)
            if len(found) >= limit:
                break
    return found


def find_category_in_text(text: str):
    for cat, aliases in CATEGORY_ALIASES.items():
        if any(_contains(text, a) for a in aliases):
            return cat
    return None


def get_job(category, job_name: str):
    if category:
        return _jobs.get((category, job_name))
    return next((r for (c, n), r in _jobs.items() if n == job_name), None)


def get_common(category: str):
    return _jobs.get((category, "직무 공통"))
