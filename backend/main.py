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
from typing import Optional
 
from dotenv import load_dotenv, find_dotenv
 
# 로컬: .env를 찾아서 로드 / Render: .env가 없으므로 대시보드 환경변수를 그대로 사용
load_dotenv(find_dotenv())
 
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from supabase import Client, create_client
 
try:
    from supabase import ClientOptions
except ImportError:  # supabase 패키지 버전에 따라 위치가 다름
    from supabase.lib.client_options import ClientOptions
 
from prompts import SYSTEM_PROMPT
from DB.config import supabase  # anon 키 클라이언트 — 토큰 확인(get_user)에 사용
from DB.supabase_client import register_user
 
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
 
# ── Supabase 클라이언트 ───────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
 
# DB 읽기/쓰기 전용 클라이언트 (service_role 키 → RLS를 켠 채팅 테이블에도 접근 가능)
# ※ 이 키는 절대 프론트(Vercel)에 넣지 말 것. Render 환경변수에만.
db: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY)
if not SUPABASE_SERVICE_KEY:
    print("[경고] SUPABASE_SERVICE_ROLE_KEY가 없습니다. RLS를 켠 채팅 테이블 저장이 실패할 수 있어요.")
 
 
def _new_auth_client() -> Client:
    """로그인/토큰 갱신용 일회용 클라이언트.
    전역 클라이언트 하나로 로그인하면 마지막 로그인 사용자로 상태가 덮어써지므로,
    요청마다 새로 만들어서 사용자끼리 섞이지 않게 함."""
    return create_client(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )
 
 
# ── FastAPI / CORS ────────────────────────────────────────
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
    # 배포마다 새로 생기는 Vercel 주소(kwon-repo-hwai-xxxx-45888.vercel.app 등)도 허용
    allow_origin_regex=r"https://kwon-repo-hwai(-[a-z0-9-]+)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # Authorization 헤더 포함
)
 
 
# ── 요청/응답 모델 ────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    password_confirm: str
 
 
class LoginRequest(BaseModel):
    email: str
    password: str
 
 
class RefreshRequest(BaseModel):
    refresh_token: str
 
 
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # 없으면 새 대화방 생성
 
 
class ChatResponse(BaseModel):
    session_id: str
    reply: str
 
 
# ── 로그인 사용자 확인 ────────────────────────────────────
def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """'Authorization: Bearer <access_token>' 헤더로 누가 요청했는지 확인"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    token = authorization.split(" ", 1)[1]
    try:
        res = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="로그인이 만료되었어요. 다시 로그인해주세요.")
    if not res or not res.user:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    return res.user.id
 
 
# ── 인증 ──────────────────────────────────────────────────
@app.post("/auth/register")
def register(req: RegisterRequest):
    if req.password != req.password_confirm:
        raise HTTPException(status_code=400, detail="비밀번호가 일치하지 않습니다.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="비밀번호는 6자 이상이어야 합니다.")
 
    result = register_user(req.email, req.password, req.name)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"message": "회원가입 완료"}
 
 
@app.post("/auth/login")
def login(req: LoginRequest):
    try:
        res = _new_auth_client().auth.sign_in_with_password(
            {"email": req.email, "password": req.password}
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
 
    meta = res.user.user_metadata or {}
    return {
        "success": True,
        "user": {
            "id": res.user.id,
            "email": res.user.email,
            "name": meta.get("name", "사용자"),
        },
        "session": {
            "access_token": res.session.access_token,
            # access_token은 1시간 뒤 만료 → 이 값으로 새 토큰을 받아 로그인 유지
            "refresh_token": res.session.refresh_token,
        },
    }
 
 
@app.post("/auth/refresh")
def refresh(req: RefreshRequest):
    try:
        res = _new_auth_client().auth.refresh_session(req.refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="다시 로그인해주세요.")
    if not res or not res.session:
        raise HTTPException(status_code=401, detail="다시 로그인해주세요.")
    return {
        "access_token": res.session.access_token,
        "refresh_token": res.session.refresh_token,
    }
 
 
@app.get("/me")
def my_page(user_id: str = Depends(get_current_user_id)):
    rows = db.table("profiles").select("*").eq("id", user_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="프로필이 없습니다.")
    return rows[0]
 
 
# ── 채팅 기록 ─────────────────────────────────────────────
@app.get("/chat/sessions")
def list_sessions(user_id: str = Depends(get_current_user_id)):
    """로그인한 사용자의 대화방 목록 + 각 대화방의 메시지 (최신 대화방이 앞)"""
    sessions = (
        db.table("chat_sessions")
        .select("id, title, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    if not sessions:
        return []
 
    messages = (
        db.table("chat_messages")
        .select("session_id, role, content, created_at")
        .in_("session_id", [s["id"] for s in sessions])
        .order("id")
        .execute()
        .data
    )
    by_session = {s["id"]: [] for s in sessions}
    for m in messages:
        by_session[m["session_id"]].append(
            {"role": m["role"], "content": m["content"], "created_at": m["created_at"]}
        )
    return [{**s, "messages": by_session[s["id"]]} for s in sessions]
 
 
@app.delete("/chat/sessions/{session_id}")
def delete_session(session_id: str, user_id: str = Depends(get_current_user_id)):
    # user_id 조건을 같이 걸어서 남의 대화방은 지울 수 없게 함 (메시지는 CASCADE로 같이 삭제)
    db.table("chat_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
    return {"ok": True}
 
 
MAX_HISTORY = 20  # GPT에 함께 보낼 최근 메시지 수 (너무 길어지면 비용↑)
 
 
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    session_id = req.session_id
    is_new = session_id is None
 
    if is_new:
        text = req.message.strip()
        title = text[:22] + ("…" if len(text) > 22 else "")
        created = db.table("chat_sessions").insert({"user_id": user_id, "title": title}).execute().data
        session_id = created[0]["id"]
        history = []
    else:
        owned = (
            db.table("chat_sessions").select("id")
            .eq("id", session_id).eq("user_id", user_id)
            .execute().data
        )
        if not owned:
            raise HTTPException(status_code=404, detail="대화방을 찾을 수 없습니다.")
        rows = (
            db.table("chat_messages").select("role, content")
            .eq("session_id", session_id)
            .order("id", desc=True).limit(MAX_HISTORY)
            .execute().data
        )
        history = list(reversed(rows))
 
    messages = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + history
        + [{"role": "user", "content": req.message}]
    )
 
    try:
        completion = client.chat.completions.create(model="gpt-4o-mini", messages=messages)
        reply = completion.choices[0].message.content
    except Exception:
        if is_new:  # 첫 메시지부터 실패하면 빈 대화방이 남지 않게 정리
            db.table("chat_sessions").delete().eq("id", session_id).execute()
        raise HTTPException(status_code=502, detail="AI 응답을 받지 못했어요.")
 
    db.table("chat_messages").insert([
        {"session_id": session_id, "user_id": user_id, "role": "user", "content": req.message},
        {"session_id": session_id, "user_id": user_id, "role": "assistant", "content": reply},
    ]).execute()
 
    return ChatResponse(session_id=session_id, reply=reply)
 
 
@app.get("/")
def root():
    return {"status": "ok", "service": "maeum-itgi backend"}
 