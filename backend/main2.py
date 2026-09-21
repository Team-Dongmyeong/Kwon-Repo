# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from DB.supabase_client import register_user, login_user, get_user_info_query

app = FastAPI()

# 프론트엔드(React)와의 통신 허용 설정 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 테스트 시 모든 출처 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 회원가입 요청 데이터 클래스
class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str

    # 로그인 요청 데이터 구조
class LoginRequest(BaseModel):
    email: str
    password: str

# 프론트엔드가 호출할 로그인 API Endpoint
@app.post("/api/login")
def login(request: LoginRequest):
    result = login_user(request.email, request.password)
    return result

@app.post("/api/signup")
def signup(request: SignUpRequest):
    # backend/DB/supabase_client.py 의 함수 호출
    result = register_user(request.email, request.password, request.name)
    return result

@app.get("/api/user-info/{user_id}")
def read_user_info(user_id: str):
    # DB/supabase_client.py 내 함수 실행
    return get_user_info_query(user_id)