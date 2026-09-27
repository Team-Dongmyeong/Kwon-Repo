# import os
# import uuid
# from typing import Dict, List, Optional

# from dotenv import load_dotenv, find_dotenv
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from openai import OpenAI
# from pydantic import BaseModel

# from prompts import SYSTEM_PROMPT

# # 프로젝트 루트(capstone_project/.env)를 위로 올라가며 찾아서 로드.
# # backend 폴더 안에서 uvicorn을 실행해도, 루트에 있는 .env를 그대로 찾습니다.
# load_dotenv(find_dotenv())

# client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# app = FastAPI(title="마음잇기 Chat API")

# # 로컬 개발 주소(Vite) + 배포된 Vercel 프론트 주소를 기본으로 허용.
# # Render 배포 시 ALLOWED_ORIGINS 환경변수에 콤마(,)로 추가 주소를 넣으면
# # (예: 다른 브랜치 프리뷰 배포 주소 등) 코드 수정 없이 늘릴 수 있음.
# _default_origins = [
#     "http://localhost:5173",
#     "https://kwon-repo-hwai.vercel.app"
# ]
# _extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
# allow_origins = _default_origins + _extra_origins

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=allow_origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # TODO: Supabase 연동 후 실제 DB로 교체 예정.
# # 지금은 서버가 켜져 있는 동안만 세션별 대화 맥락을 메모리에 유지합니다
# # (서버 재시작하면 사라짐 — 여러 대화 세션을 동시에 이어갈 수 있게 하기 위한
# # 최소한의 구조이며, 감정/키워드 분석 결과 저장은 kcELECTRA/SBERT 서빙(/analyze)과
# # Supabase가 붙는 다음 단계에서 이어집니다).
# session_store: Dict[str, List[dict]] = {}


# class ChatRequest(BaseModel):
#     message: str
#     session_id: Optional[str] = None  # 없으면 새 세션으로 시작


# class ChatResponse(BaseModel):
#     session_id: str
#     reply: str


# @app.post("/chat", response_model=ChatResponse)
# def chat(req: ChatRequest):
#     session_id = req.session_id or str(uuid.uuid4())

#     history = session_store.get(session_id, [])
#     history.append({"role": "user", "content": req.message})

#     messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history

#     completion = client.chat.completions.create(
#         model="gpt-4o-mini",
#         messages=messages,
#     )
#     reply = completion.choices[0].message.content

#     history.append({"role": "assistant", "content": reply})
#     session_store[session_id] = history

#     return ChatResponse(session_id=session_id, reply=reply)


# @app.get("/")
# def root():
#     return {"status": "ok", "service": "maeum-itgi backend"}

import os
import uuid
from typing import Dict, List, Optional
 
from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
 
from prompts import SYSTEM_PROMPT
 
# ── [추가] Supabase 연동 함수 ─────────────────────────────
# backend/DB/config.py, backend/DB/supabase_client.py 가 있어야 함
from DB.config import supabase
from DB.supabase_client import (
    register_user,
    login_user,
    get_user_info_query,
)
 
# 로컬: 루트 .env를 찾아서 로드 / Render: .env가 없으므로 대시보드 환경변수를 그대로 사용
load_dotenv(find_dotenv())
 
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
 
app = FastAPI(title="마음잇기 Chat API")
 
_default_origins = [
    "http://localhost:5173",
    "https://kwon-repo-hwai.vercel.app",
]
_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
allow_origins = _default_origins + _extra_origins
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # Authorization 헤더 포함
)
 
session_store: Dict[str, List[dict]] = {}
 
 
# ── 요청/응답 모델 ────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
 
 
class ChatResponse(BaseModel):
    session_id: str
    reply: str
 
 
# [추가] 회원가입 / 로그인 요청 모델
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    password_confirm: str
 
 
class LoginRequest(BaseModel):
    email: str
    password: str
 
 
# ── [추가] 인증 관련 엔드포인트 ───────────────────────────
@app.post("/auth/register")
def register(req: RegisterRequest):
    # 프론트에서 한 번 거르더라도, 서버에서도 한 번 더 검증
    if req.password != req.password_confirm:
        raise HTTPException(status_code=400, detail="비밀번호가 일치하지 않습니다.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다.")
 
    result = register_user(req.email, req.password, req.name)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
 
    # Supabase 응답 객체(토큰 포함)를 그대로 내보내지 않고 필요한 것만 반환
    return {"message": "회원가입 완료. 이메일 인증이 켜져 있다면 메일함을 확인해주세요."}
 
 
@app.post("/auth/login")
def login(req: LoginRequest):
    result = login_user(req.email, req.password)
    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["error"])
    return result  # {"success", "user": {...}, "session": {"access_token"}}
 
 
def _get_user_id_from_token(authorization: Optional[str]) -> str:
    """'Authorization: Bearer <access_token>' 헤더에서 사용자 id를 확인"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    token = authorization.split(" ", 1)[1]
    try:
        user_res = supabase.auth.get_user(token)
        return user_res.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
 
 
@app.get("/me")
def my_page(authorization: Optional[str] = Header(default=None)):
    user_id = _get_user_id_from_token(authorization)
    result = get_user_info_query(user_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    if not result["data"]:
        raise HTTPException(status_code=404, detail="프로필이 없습니다.")
    return result["data"][0]
 
 
# ── 기존 채팅 엔드포인트 (변경 없음) ──────────────────────
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
 
    history = session_store.get(session_id, [])
    history.append({"role": "user", "content": req.message})
 
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history
 
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    reply = completion.choices[0].message.content
 
    history.append({"role": "assistant", "content": reply})
    session_store[session_id] = history
 
    return ChatResponse(session_id=session_id, reply=reply)
 
 
@app.get("/")
def root():
    return {"status": "ok", "service": "maeum-itgi backend"}
