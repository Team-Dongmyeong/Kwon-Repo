# test_prototype/backend/DB/config.py
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# backend/.env 파일의 환경변수 로드
load_dotenv()

# os.getenv()를 통해 환경변수 값 가져오기
SUPABASE_URL: str = os.getenv("SUPABASE_URL")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY")

# 환경변수가 정상적으로 로드되지 않았을 경우 예외 처리
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL 또는 SUPABASE_KEY가 .env 파일에 설정되지 않았습니다.")

# Supabase 클라이언트 객체 생성
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)