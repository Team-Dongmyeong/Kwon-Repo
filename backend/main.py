import os
from typing import Optional

# ↓↓↓ [채용공고 기능 추가] API_new에서 가져온 4줄 — build_job_list()가 쓰는 표준 라이브러리들
import time
import threading
from datetime import datetime
import requests
# ↑↑↑
 
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

 # ============================================================
# 채용공고 (/api/jobs) — job-fetch/fetch_jobs_to_mock.py가 로컬에서 하던 일
# (재정경제부_공공기관 채용정보 API 호출 + 가공)을 그대로 백엔드로 옮긴 것.
# 팀 회의에서 "채용공고 자체는 DB에 저장하지 않는다"고 정한 대로, DB 없이
# 요청이 올 때마다(단, 캐시 TTL 안에서는 캐시된 값을) 공공데이터 API를 직접
# 호출해서 그 자리에서 응답한다.
# ============================================================

# 공공데이터포털 서비스키. job-fetch/service_key.txt처럼 파일로 읽지 않고
# 환경변수로 받음 — 그 파일은 .gitignore로 막혀있어서 배포 서버엔 존재하지
# 않기 때문. Render "Environment" 탭에 JOB_API_SERVICE_KEY로 등록해야 함.
JOB_API_SERVICE_KEY = os.getenv("JOB_API_SERVICE_KEY", "")

JOB_API_BASE_URL = "https://apis.data.go.kr/1051000/recruitment"

# 코드정의서 기준 NCS 대분류 코드 (우리 5개 카테고리 매핑). fetch_jobs_to_mock.py와
# 완전히 동일한 값 — 프론트(src/constants/jobCategories.js)의 분류 체계와 맞춰야 함.
JOB_NCS_CODES_BY_CATEGORY = {
    "IT/SW": ["R600020"],
    "디자인": ["R600008", "R600018"],
    "공공·복지": ["R600007"],
    "식·음료": ["R600013", "R600021"],
    "MD/상품기획": ["R600010", "R600002"],
}

JOB_NCS_CODE_LABELS = {
    "R600020": "정보통신",
    "R600008": "문화예술디자인방송",
    "R600018": "섬유의복",
    "R600007": "사회복지종교",
    "R600013": "음식서비스",
    "R600021": "식품가공",
    "R600010": "영업판매",
    "R600002": "경영회계사무",
}

JOB_MAX_ROWS_PER_CATEGORY = 100
JOB_PAGE_SIZE = 100

JOB_SUBJOB_KEYWORDS = {
    "IT/SW": {
        "백엔드개발자": ["백엔드", "서버개발", "backend"],
        "AI/ML 엔지니어": ["인공지능", "머신러닝", "딥러닝", " ai", "ai ", "ai엔지니어", "데이터사이언"],
        "QA": ["품질보증", "qa", "테스터", "품질관리"],
        "게임개발자": ["게임개발", "게임 프로그래머", "유니티", "언리얼"],
        "네트워크엔지니어": ["네트워크"],
        "시스템엔지니어": ["시스템엔지니어", "서버관리", "인프라"],
        "앱개발자": ["앱개발", "모바일개발", "안드로이드", "ios개발"],
        "웹개발자": ["웹개발", "홈페이지개발", "웹퍼블리셔"],
        "프론트엔드개발자": ["프론트엔드", "프론트 개발", "frontend"],
    },
    "디자인": {
        "UI/UX 디자이너": ["ui/ux", "ui 디자", "ux 디자", "ui디자", "ux디자"],
        "공간 디자이너": ["공간디자인", "공간 디자인", "전시디자인"],
        "광고 디자이너": ["광고디자인", "광고 디자인"],
        "그래픽 디자이너": ["그래픽디자인", "그래픽 디자인"],
        "시각 디자이너": ["시각디자인", "시각 디자인"],
        "실내 디자이너": ["실내디자인", "인테리어"],
        "웹 디자이너": ["웹디자인", "웹 디자인"],
        "제품 디자이너": ["제품디자인", "프로덕트 디자인"],
        "캐릭터 디자이너": ["캐릭터디자인", "캐릭터 디자인"],
        "패션 디자이너": ["패션디자인", "의상디자인"],
        "편집 디자이너": ["편집디자인", "출판디자인"],
    },
    "공공·복지": {
        "사회복지사": ["사회복지사", "복지사", "사회복지"],
    },
    "식·음료": {
        "바리스타": ["바리스타"],
        "셰프·주방장": ["셰프", "주방장"],
        "요리사": ["요리사"],
        "제과제빵사": ["제과", "제빵", "베이커리"],
        "조리사": ["조리사", "조리실무"],
        "카페·레스토랑 매니저": ["카페매니저", "레스토랑매니저", "매장관리자"],
        "홀 서버": ["홀서빙", "플로어스태프"],
    },
    "MD/상품기획": {
        "MD": [" md", "md ", "상품기획", "머천다이저"],
        "콘텐츠마케터": ["콘텐츠마케팅", "콘텐츠 마케터"],
        "홍보": ["홍보"],
        "온라인마케터": ["온라인마케팅", "디지털마케팅", "온라인 마케터"],
    },
}
 
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
 