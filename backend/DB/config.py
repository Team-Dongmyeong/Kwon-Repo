import os
from supabase import create_client, Client

# Supabase 웹 대시보드에서 확인한 정보
SUPABASE_URL: str = "https://ddrzlupldnboxpcjuhxs.supabase.co"
SUPABASE_KEY: str = "sb_publishable_hBe7DdCLiTeFtoKPBN9qbQ_IGRsV125"

# Supabase 클라이언트 객체 생성
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)