from __future__ import annotations

import os
from functools import lru_cache


@lru_cache(maxsize=1)
def get_db():
    """main.py의 db와 같은 service_role 클라이언트 (RAG 테이블 조회용)"""
    from supabase import create_client

    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    return create_client(os.getenv("SUPABASE_URL"), key)
