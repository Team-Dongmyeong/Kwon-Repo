"""SBERT 임베딩 + Supabase pgvector 검색"""
from __future__ import annotations

from collections import Counter

from .db import get_db
from .loader import S

DOC_SIM_THRESHOLD = 0.45   # 상담 문장: 이 값 미만은 버림 (chat_messages.top_similarity 보면서 조정)
JOB_SIM_THRESHOLD = 0.50   # 직무: 직무명을 직접 말하지 않았을 때만 쓰므로 더 엄격하게


def embed(text: str) -> list:
    # 적재 스크립트와 똑같이 normalize_embeddings=True
    return S.sbert.encode(text, normalize_embeddings=True).tolist()


def search_counsel_docs(vec: list, k: int = 4) -> tuple:
    """비슷한 상담 문장 top-k + 다수결 고민 유형. kb_documents가 비어 있으면 ([], None)"""
    rows = get_db().rpc("match_documents", {"query_embedding": vec, "match_count": k}).execute().data or []
    rows = [r for r in rows if r["similarity"] >= DOC_SIM_THRESHOLD]
    concern = Counter(r["concern_type"] for r in rows).most_common(1)[0][0] if rows else None
    return rows, concern


def search_job_semantic(vec: list):
    """직무명을 직접 말하지 않았을 때 의미가 가장 가까운 직무 (category, job_name, sim) 또는 None"""
    rows = get_db().rpc("match_jobs", {"query_embedding": vec, "match_count": 1}).execute().data or []
    if rows and rows[0]["similarity"] >= JOB_SIM_THRESHOLD:
        r = rows[0]
        return r["category"], r["job_name"], r["similarity"]
    return None
