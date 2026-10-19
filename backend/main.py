import os
import re
import json  # [감정 리포트] GPT 감정 분류 응답 파싱
from typing import Optional

# ↓↓↓ [채용공고 기능 추가] API_new에서 가져온 4줄 — build_job_list()가 쓰는 표준 라이브러리들
import time
import threading
from datetime import datetime, timedelta, timezone
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
 
from contextlib import asynccontextmanager  # [RAG]

from prompts import SYSTEM_PROMPT, build_context  # [감정임계치] build_context 추가
from DB.config import supabase  # anon 키 클라이언트 — 토큰 확인(get_user)에 사용
from DB.supabase_client import register_user
import rag  # [RAG] backend/rag/ 폴더 (감정 분류 + 검색 + 프롬프트 조립)
import emotion_state  # [감정점수] 6개 감정 기본 25점 → 상담에 따라 변화
 
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
# [RAG] 서버 시작 시: 모델·직무 데이터 로드와 채용공고 캐시 채우기를 '백그라운드'로 시작.
#       (서버는 바로 켜지고, 로드가 끝나기 전의 채팅은 기존처럼 GPT 단독으로 응답)
@asynccontextmanager
async def lifespan(app: FastAPI):
    rag.start_background_load()
    if JOB_API_SERVICE_KEY:
        threading.Thread(target=_warm_jobs_cache, daemon=True).start()
    yield


app = FastAPI(title="마음잇기 Chat API", lifespan=lifespan)
 
_default_origins = [
    "http://localhost:5173",
    "https://maeum-connection.vercel.app",
]
_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
allow_origins = _default_origins + _extra_origins
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    # 배포마다 새로 생기는 Vercel 주소(maeum-connection.vercel.app 등)도 허용
    allow_origin_regex=r"https://maeum-connection(-[a-z0-9-]+)?\.vercel\.app",
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
    # [RAG] 프론트에서 써도 되고 안 써도 됨 (기존 프론트는 그대로 동작)
    emotion: Optional[str] = None
    concern_type: Optional[str] = None
    job_name: Optional[str] = None
 
 
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

# ── [감정 리포트] GPT 감정 분류 (임시 대체용) ──────────────
# Render 무료 플랜에서는 KcELECTRA를 못 띄워서(RAG_ENABLED=false) 감정이 저장되지 않음.
# 그동안 마이페이지 감정 그래프를 쓸 수 있도록, 감정이 비어 있을 때만 GPT로 같은 7가지
# 라벨 중 하나를 골라 저장한다. RAG가 켜지면 KcELECTRA 결과가 우선이라 이 함수는 안 쓰임.
# 끄려면 환경변수 EMOTION_FALLBACK=off
EMOTION_LABELS = ["공포", "놀람", "분노", "슬픔", "중립", "행복", "혐오"]
EMOTION_FALLBACK = os.getenv("EMOTION_FALLBACK", "gpt").lower()


def _gpt_emotion(text: str):
    """(감정, 확신도) 또는 실패 시 None. 실패해도 채팅에는 영향 없음."""
    if EMOTION_FALLBACK != "gpt":
        return None
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=30,
            timeout=10,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "사용자 문장에 드러난 감정을 다음 7개 중 정확히 하나로 분류해. "
                        "공포, 놀람, 분노, 슬픔, 중립, 행복, 혐오. "
                        "질문·정보 요청처럼 감정이 드러나지 않으면 중립. "
                        '반드시 {"emotion": "라벨", "confidence": 0~1 숫자} JSON만 출력해.'
                    ),
                },
                {"role": "user", "content": text[:1000]},
            ],
        )
        data = json.loads(completion.choices[0].message.content)
        emotion = str(data.get("emotion", "")).strip()
        if emotion not in EMOTION_LABELS:
            return None
        conf = float(data.get("confidence", 0.7))
        return emotion, max(0.0, min(1.0, conf))
    except Exception as e:
        print(f"[감정] GPT 분류 실패(무시): {e!r}")
        return None
 
 
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
            db.table("chat_messages").select("role, content, job_name")  # [RAG] job_name 추가
            .eq("session_id", session_id)
            .order("id", desc=True).limit(MAX_HISTORY)
            .execute().data
        )
        history = list(reversed(rows))

    # [RAG] 같은 대화방에서 마지막으로 다룬 직무 (예: "그럼 자격증은?" 같은 이어지는 질문용)
    prev_job = next((r.get("job_name") for r in reversed(history) if r.get("job_name")), None)
    history = [{"role": r["role"], "content": r["content"]} for r in history]  # GPT엔 role/content만

    # [RAG] 감정 분류 + 검색 + 프롬프트 조립. 모델 준비 전이거나 오류가 나면 기존 GPT 단독 방식.
    rag_result = None
    if rag.is_ready():
        try:
            rag_result = rag.build_rag_context(
                req.message,
                prev_job_name=prev_job,
                has_history=bool(history),  # [감정임계치] 이전 대화 있으면 임계치 0.75, 없으면 0.5
                recommended_job=None,  # TODO: 추천직업 테스트 결과를 DB에 저장한다면 여기에 연결
                postings_provider=_postings_for,
            )
        except Exception as e:
            print(f"[RAG] 실패 → GPT 단독으로 응답: {e!r}")
            rag_result = None

    if rag_result is not None and rag_result.fixed_reply:
        reply = rag_result.fixed_reply  # 위기 표현 → 안전 안내 (GPT 호출 안 함)
    else:
        system_prompt = (
            rag_result.system_prompt if rag_result
            else SYSTEM_PROMPT + "\n\n" + build_context()  # [감정임계치] RAG 없을 때: 분석 값은 '확인 안 됨'
        )
        messages = (
            [{"role": "system", "content": system_prompt}]
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

    meta = dict(rag_result.meta) if rag_result else {}  # [RAG] 사용자 메시지 행에 분석 결과 저장
    # [감정 리포트] RAG(KcELECTRA)가 꺼져 있거나 실패해서 감정이 없으면 GPT로 대신 분류
    if not meta.get("emotion"):
        emo = _gpt_emotion(req.message)
        if emo:
            meta["emotion"], meta["emotion_conf"] = emo
    db.table("chat_messages").insert([
        {"session_id": session_id, "user_id": user_id, "role": "user", "content": req.message, **meta},
        {"session_id": session_id, "user_id": user_id, "role": "assistant", "content": reply,
         "job_name": meta.get("job_name")},
    ]).execute()

    return ChatResponse(
        session_id=session_id,
        reply=reply,
        emotion=meta.get("emotion"),
        concern_type=meta.get("concern_type"),
        job_name=meta.get("job_name"),
    )


# ── [감정 리포트] 마이페이지 '감정상태' 탭 ─────────────────
# /chat이 사용자 메시지마다 저장한 emotion(KcELECTRA 결과)을 모아서
#   ① 최근 30일 감정 패턴 (육각형: 공포·놀람·분노·슬픔·행복·혐오, 중립 제외)
#   ② 심리상태 점수 0~100 추이 (일주일=일별 / 한달=주별 / 1년=월별)
# 를 계산해 돌려줌. 감정이 없는 메시지(RAG 적용 전·RAG 꺼짐)는 자동으로 제외됨.
_EMO_KST = timezone(timedelta(hours=9))
EMOTION_AXES = ["공포", "놀람", "분노", "슬픔", "행복", "혐오"]
# 감정 → 좋음/나쁨 방향. 놀람은 좋은 일·나쁜 일 양쪽에 쓰여서 0(중립)으로 둠.
EMOTION_VALENCE = {"행복": 1, "중립": 0, "놀람": 0, "슬픔": -1, "분노": -1, "공포": -1, "혐오": -1}
PATTERN_DAYS = 30


def _parse_ts(value: str) -> datetime:
    """Supabase timestamptz 문자열 → KST datetime (소수점 자릿수가 들쭉날쭉해도 처리)"""
    s = value.replace("Z", "+00:00")
    m = re.match(r"^(.*?\d{2}:\d{2}:\d{2})(\.\d+)?(.*)$", s)
    if m:
        frac = (m.group(2) or ".0")[1:7].ljust(6, "0")
        s = f"{m.group(1)}.{frac}{m.group(3)}"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_EMO_KST)


def _message_score(emotion: str, conf) -> float:
    """메시지 1개의 점수(-1~1) = 감정 방향 × 확신도"""
    try:
        c = float(conf) if conf is not None else 1.0
    except (TypeError, ValueError):
        c = 1.0
    return EMOTION_VALENCE.get(emotion, 0) * c


PSYCH_BASE_SCORE = 50  # [감정점수] 심리상태 기본 점수 (상담 기록이 없을 때). 0=부정적 · 50=보통 · 100=긍정적


def _bucket_points(rows: list, key_fn, label_fn, all_keys=None) -> dict:
    """rows를 key_fn으로 묶어 구간별 점수(0~100) 계산.
    [감정점수] all_keys를 주면 대화가 없는 구간도 채움 → 기본 점수(또는 직전 구간 점수)를 이어서 표시"""
    buckets = {}
    for r in rows:
        k = key_fn(r["_dt"])
        if k is None:
            continue
        buckets.setdefault(k, []).append(_message_score(r["emotion"], r.get("emotion_conf")))
    keys = list(all_keys) if all_keys is not None else sorted(buckets)
    points, last = [], PSYCH_BASE_SCORE
    for k in keys:
        if buckets.get(k):
            last = round(50 + 50 * sum(buckets[k]) / len(buckets[k]))
        points.append(last)
    return {
        "dates": [label_fn(k) for k in keys],
        "points": points,
        "counts": [len(buckets.get(k, [])) for k in keys],
    }


@app.get("/emotions/summary")
def emotion_summary(user_id: str = Depends(get_current_user_id)):
    now = datetime.now(_EMO_KST)
    today = now.date()
    since = (now - timedelta(days=366)).astimezone(timezone.utc).isoformat()

    # 최근 1년치 사용자 메시지 중 감정이 저장된 것만 (1000행 단위로 나눠서 조회)
    rows, start, page = [], 0, 1000
    while True:
        chunk = (
            db.table("chat_messages")
            .select("emotion, emotion_conf, created_at")
            .eq("user_id", user_id)
            .eq("role", "user")
            .not_.is_("emotion", "null")
            .gte("created_at", since)
            .order("id")
            .range(start, start + page - 1)
            .execute()
            .data
        )
        rows.extend(chunk)
        if len(chunk) < page:
            break
        start += page

    for r in rows:
        r["_dt"] = _parse_ts(r["created_at"])

    # ① 최근 30일 감정 패턴
    # [감정점수] 6개 감정 모두 기본 25점에서 시작 → 최근 30일 상담 메시지 순서대로 점수 재배분.
    #           상담 기록이 없으면 6개 모두 25. value(0~100) = 육각형 그래프 값.
    recent = [r for r in rows if (today - r["_dt"].date()).days < PATTERN_DAYS]
    scores = emotion_state.replay(recent)
    counts = {e: 0 for e in EMOTION_AXES}
    for r in recent:
        if r["emotion"] in counts:
            counts[r["emotion"]] += 1
    pattern_total = sum(counts.values())
    pattern = [
        {
            "label": e,
            "count": counts[e],
            "ratio": round(counts[e] / pattern_total * 100) if pattern_total else 0,
            "value": round(scores[e]),   # [감정점수] 기본 25, 상담에 따라 변화
            "score": scores[e],          # [감정점수] 소수 1자리 값
        }
        for e in EMOTION_AXES
    ]
    dominant = max(scores, key=scores.get) if len(set(scores.values())) > 1 else None

    # ② 심리상태 추이
    def week_key(dt):  # 최근 7일, 하루 단위
        d = dt.date()
        return d if (today - d).days < 7 else None

    def month_key(dt):  # 최근 4주, 7일 단위 (0 = 이번 주)
        diff = (today - dt.date()).days
        return -(diff // 7) if diff < 28 else None

    def year_key(dt):  # 최근 12개월, 월 단위
        months = (today.year - dt.year) * 12 + (today.month - dt.month)
        return (dt.year, dt.month) if months < 12 else None

    # [감정점수] 대화가 없는 날/주/월도 빠짐없이 표시 (상담 전에는 전부 기본 점수)
    week_keys = [today - timedelta(days=i) for i in range(6, -1, -1)]
    month_keys = [-3, -2, -1, 0]
    year_keys = []
    y, mth = today.year, today.month
    for _ in range(12):
        year_keys.append((y, mth))
        y, mth = (y, mth - 1) if mth > 1 else (y - 1, 12)
    year_keys.reverse()

    trend = {
        "week": _bucket_points(rows, week_key, lambda d: d.strftime("%m/%d"), week_keys),
        "month": _bucket_points(
            rows, month_key, lambda k: (today + timedelta(days=7 * k)).strftime("%m/%d"), month_keys
        ),
        "year": _bucket_points(rows, year_key, lambda k: f"{k[0]}/{k[1]:02d}", year_keys),
    }

    return {
        "pattern": pattern,
        "base_score": emotion_state.BASE_SCORE,  # [감정점수] 감정 기본 점수 25
        "is_default": not recent,                # [감정점수] True면 최근 30일 상담 기록이 없어 전부 기본값
        "dominant": dominant,                    # [감정점수] 가장 높은 감정 (전부 같으면 None)
        "psych_base_score": PSYCH_BASE_SCORE,    # [감정점수] 심리상태 기본 점수 50
        "pattern_total": pattern_total,          # 최근 30일, 중립 제외 메시지 수
        "recent_message_count": len(recent),     # 최근 30일, 중립 포함 메시지 수
        "trend": trend,
    }
 
 
@app.get("/")
def root():
    # [RAG] rag: loading(로딩 중) / ready(적용됨) / disabled / error: ... (Render에서 상태 확인용)
    return {"status": "ok", "service": "maeum-itgi backend", "rag": rag.status()}

# 추가한거 문제 시 이 아래 삭제
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


def _job_fetch_page(ncs_code: str, page_no: int, num_of_rows: int) -> tuple:
    """채용공시 목록조회(/list) 한 페이지 호출. (결과 리스트, totalCount) 반환.
    실패해도 예외 없이 ([], 0) 반환 — 한 카테고리 호출이 실패해도 나머지
    카테고리는 계속 처리되도록."""
    url = f"{JOB_API_BASE_URL}/list"
    params = {
        "serviceKey": JOB_API_SERVICE_KEY,
        "resultType": "json",
        "numOfRows": num_of_rows,
        "pageNo": page_no,
        "ongoingYn": "Y",
        "ncsCdLst": ncs_code,
    }
    try:
        res = requests.get(url, params=params, timeout=15)
        if res.status_code != 200:
            print(f"  ⚠ [jobs] HTTP {res.status_code} — {res.text[:200]}")
            return [], 0
        data = res.json()
    except Exception as e:
        print(f"  ⚠ [jobs] 호출 실패: {e}")
        return [], 0

    if data.get("resultCode") != 200:
        print(f"  ⚠ [jobs] API 오류: {data.get('resultMsg')}")
        return [], 0

    return data.get("result", []) or [], data.get("totalCount", 0) or 0


def _job_fetch_list(ncs_code: str, max_rows: int) -> list:
    collected = []
    page_no = 1
    total_count = None
    while len(collected) < max_rows:
        remaining = max_rows - len(collected)
        page_size = min(JOB_PAGE_SIZE, remaining)
        items, total_count = _job_fetch_page(ncs_code, page_no, page_size)
        if not items:
            break
        collected.extend(items)
        if total_count and len(collected) >= total_count:
            break
        page_no += 1
    return collected


def _job_to_yyyy_mm_dd(ymd: str) -> str:
    if not ymd or len(ymd) != 8:
        return "상시채용"
    try:
        return datetime.strptime(ymd, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return "상시채용"


def _job_clean_url(raw_url) -> str:
    """srcUrl이 '없음'/'해당없음'/'.' 같은 안내 텍스트로 오는 경우가 있어서,
    http(s)로 시작하는 진짜 URL만 통과시키고 나머지는 빈 문자열로 정리."""
    cleaned = (raw_url or "").strip()
    if cleaned.lower().startswith("http"):
        return cleaned
    return ""


def _job_classify_subjob(title: str, category: str) -> str:
    lowered = f" {(title or '').lower()} "
    for subjob, keywords in JOB_SUBJOB_KEYWORDS.get(category, {}).items():
        for kw in keywords:
            if kw.lower() in lowered:
                return subjob
    return "직무공통"


def _job_transform(item: dict, category: str, ncs_group: str) -> dict:
    region_list = (item.get("workRgnNmLst") or "").split(",")
    region = region_list[0].strip() if region_list and region_list[0] else "지역 미정"
    tag_list = [t.strip() for t in (item.get("hireTypeNmLst") or "").split(",") if t.strip()]
    title = item.get("recrutPbancTtl") or "제목 없음"

    return {
        "id": item.get("recrutPblntSn"),
        "company": item.get("instNm") or "기관명 미상",
        "title": title,
        "subJob": _job_classify_subjob(title, category),
        "location": region,
        "category": category,
        "ncsGroup": ncs_group,
        "type": item.get("recrutSeNm") or "전체",
        "tags": tag_list[:2] if tag_list else ["공공기관"],
        "deadline": _job_to_yyyy_mm_dd(item.get("pbancEndYmd")),
        "url": _job_clean_url(item.get("srcUrl")),
    }


def build_job_list() -> list:
    """카테고리별로 공공데이터 API를 호출해 전체 채용공고 리스트를 만든다.
    DB에 저장하지 않고 매번(캐시 TTL 안에서는 캐시로) 이 함수를 다시 호출하는
    방식 — job-fetch/fetch_jobs_to_mock.py의 main()과 동일한 로직이지만
    파일로 저장하는 대신 그대로 리스트를 반환한다."""
    all_jobs = []
    for category, ncs_codes in JOB_NCS_CODES_BY_CATEGORY.items():
        seen_ids = set()
        category_items = []
        for ncs_code in ncs_codes:
            raw_items = _job_fetch_list(ncs_code, JOB_MAX_ROWS_PER_CATEGORY)
            for raw in raw_items:
                rid = raw.get("recrutPblntSn")
                if rid in seen_ids:
                    continue
                seen_ids.add(rid)
                category_items.append((raw, ncs_code))
        for raw, ncs_code in category_items:
            ncs_group = JOB_NCS_CODE_LABELS.get(ncs_code, ncs_code)
            all_jobs.append(_job_transform(raw, category, ncs_group))

    # 실제 지원 페이지로 연결되는 URL이 없는 공고는 목록에서 제외
    # (클릭해도 안 넘어가는 공고를 보여주지 않기로 한 팀 결정, fetch_jobs_to_mock.py와 동일)
    all_jobs = [job for job in all_jobs if job["url"]]
    return all_jobs


# 간단한 인메모리 캐시 — DB가 없으므로, 매 요청마다 공공데이터 API를 다시 부르지
# 않도록 30분간 결과를 들고 있는다(팀 설계 문서의 "같은 조건 30분~1시간 캐시
# 권장"을 반영). 서버가 재시작되면 캐시도 비워짐 — 괜찮음, 다음 요청 때 다시 채움.
_jobs_cache = {"data": None, "fetched_at": 0.0}
_jobs_cache_lock = threading.Lock()
JOBS_CACHE_TTL_SECONDS = 30 * 60


def get_jobs_cached() -> list:
    now = time.time()
    with _jobs_cache_lock:
        is_stale = _jobs_cache["data"] is None or (now - _jobs_cache["fetched_at"]) >= JOBS_CACHE_TTL_SECONDS
        if is_stale:
            _jobs_cache["data"] = build_job_list()
            _jobs_cache["fetched_at"] = now
        return _jobs_cache["data"]


# [RAG] 상담 답변에 '현재 모집 중인 공고'를 넣기 위한 함수들.
# 캐시가 이미 채워져 있을 때만 사용 → 채팅 응답이 공공데이터 API 때문에 느려지지 않음.
def _warm_jobs_cache():
    try:
        get_jobs_cached()
        print(f"[jobs] 캐시 준비 완료: {len(_jobs_cache['data'] or [])}건")
    except Exception as e:
        print(f"[jobs] 캐시 준비 실패(무시): {e!r}")


def _postings_for(category: str, job_name: Optional[str], limit: int = 3) -> list:
    data = _jobs_cache["data"]
    if not data or time.time() - _jobs_cache["fetched_at"] >= JOBS_CACHE_TTL_SECONDS:
        return []
    items = [j for j in data if j["category"] == category]
    if job_name:
        exact = [j for j in items if j["subJob"] == job_name]
        items = exact or items  # 해당 직무 공고가 없으면 같은 분야 공고
    items = sorted(items, key=lambda j: j["deadline"])  # 마감 임박 순 ('상시채용'은 뒤로)
    return [{k: j[k] for k in ("company", "title", "deadline", "url")} for j in items[:limit]]


@app.get("/api/jobs")
def get_jobs():
    if not JOB_API_SERVICE_KEY:
        raise HTTPException(
            status_code=500,
            detail="JOB_API_SERVICE_KEY 환경변수가 설정되지 않았습니다. Render(또는 로컬 .env)에 등록해주세요.",
        )
    jobs = get_jobs_cached()
    return {
        "jobs": jobs,
        "count": len(jobs),
        "cachedAt": datetime.fromtimestamp(_jobs_cache["fetched_at"]).isoformat(timespec="seconds"),
    }

# ============================================================
# 청년정책 (/api/policies) — 온통청년 청년정책 Open API(getPlcy) 연동.
# 채용공고(/api/jobs)와 같은 방식: DB 없이 요청이 올 때마다(캐시 TTL 안에서는
# 캐시로) 외부 API를 서버에서 직접 호출하고, 우리 화면에 맞게 가공해서 내려줌.
# 인증키는 프론트에 절대 노출하지 않고 환경변수 YOUTH_API_KEY로만 읽음
# (로컬은 .env, 배포는 Render "Environment" 탭에 등록).
# ============================================================

YOUTH_API_KEY = os.getenv("YOUTH_API_KEY", "")
YOUTH_API_URL = "https://www.youthcenter.go.kr/go/ythip/getPlcy"
YOUTH_UPSTREAM_PAGE_SIZE = 100  # 온통청년 API를 한 번 부를 때 가져오는 정책 수
YOUTH_RESULT_TARGET = 20  # 화면에 한 번에 내려줄 정책 수(필터 후 기준 최소 목표)
YOUTH_MAX_UPSTREAM_PAGES_PER_REQUEST = 3  # 필터로 걸러져도 한 요청에서 최대 몇 페이지까지 더 볼지
YOUTH_CACHE_TTL_SECONDS = 30 * 60
KST = timezone(timedelta(hours=9))

# zipCd(시군구 법정동 코드 5자리)의 앞 2자리 = 시도 코드
YOUTH_SIDO_NAMES = {
    "11": "서울", "26": "부산", "27": "대구", "28": "인천", "29": "광주",
    "30": "대전", "31": "울산", "36": "세종", "41": "경기", "42": "강원",
    "51": "강원", "43": "충북", "44": "충남", "45": "전북", "52": "전북",
    "46": "전남", "47": "경북", "48": "경남", "50": "제주",
}

# 코드정의서(API코드정보.xlsx) 중 화면에 "지원 대상" 태그로 보여줄 것만 옮김.
# '제한없음'(0013010, 0049010)은 태그로 보여줄 의미가 없어서 일부러 뺌.
YOUTH_JOB_CODES = {
    "0013001": "재직자", "0013002": "자영업자", "0013003": "미취업자", "0013004": "프리랜서",
    "0013005": "일용근로자", "0013006": "(예비)창업자", "0013007": "단기근로자", "0013008": "영농종사자",
}
YOUTH_SCHOOL_CODES = {
    "0049001": "고졸 미만", "0049002": "고교 재학", "0049003": "고졸 예정", "0049004": "고교 졸업",
    "0049005": "대학 재학", "0049006": "대졸 예정", "0049007": "대학 졸업", "0049008": "석·박사",
}

_youth_cache = {}  # (page, query, category) -> {"fetched_at", "items", "total"}
_youth_cache_lock = threading.Lock()


def _youth_to_int(value, default=0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _youth_clean_url(raw) -> str:
    cleaned = (raw or "").strip()
    return cleaned if cleaned.lower().startswith("http") else ""


def _youth_parse_apply_period(text: str):
    """'20260507 ~ 20260607' -> (시작 date, 끝 date). 파싱 못 하면 (None, None)."""
    parts = [p.strip() for p in (text or "").split("~")]
    dates = []
    for p in parts:
        try:
            dates.append(datetime.strptime(p, "%Y%m%d").date())
        except ValueError:
            dates.append(None)
    if len(dates) == 2:
        return dates[0], dates[1]
    return None, None


def _youth_apply_status(item: dict):
    """(status, deadline_iso, d_day) 반환. status: 상시 / 진행중 / 마감 / 확인필요"""
    code = (item.get("aplyPrdSeCd") or "").strip()
    if code == "0057002":
        return "상시", "", None
    if code == "0057003":
        return "마감", "", None
    _, end = _youth_parse_apply_period(item.get("aplyYmd"))
    if end is None:
        return "확인필요", "", None
    today = datetime.now(KST).date()
    d_day = (end - today).days
    if d_day < 0:
        return "마감", end.isoformat(), d_day
    return "진행중", end.isoformat(), d_day


def _youth_region_info(zip_cd: str):
    prefixes = sorted({z.strip()[:2] for z in (zip_cd or "").split(",") if len(z.strip()) >= 2})
    names = []
    for p in prefixes:
        n = YOUTH_SIDO_NAMES.get(p)
        if n and n not in names:
            names.append(n)
    if not prefixes or len(names) >= 15:
        label = "전국"
    elif len(names) <= 3:
        label = ", ".join(names)
    else:
        label = f"{', '.join(names[:3])} 외 {len(names) - 3}곳"
    return prefixes, label


def _youth_transform(item: dict) -> dict:
    status, deadline, d_day = _youth_apply_status(item)
    prefixes, region_label = _youth_region_info(item.get("zipCd"))

    keywords = [k.strip() for k in (item.get("plcyKywdNm") or "").split(",") if k.strip()]
    org = (item.get("operInstCdNm") or "").strip() or (item.get("sprvsnInstCdNm") or "").strip()

    age_min = _youth_to_int(item.get("sprtTrgtMinAge"))
    age_max = _youth_to_int(item.get("sprtTrgtMaxAge"))
    age_unlimited = (item.get("sprtTrgtAgeLmtYn") or "").strip() == "Y" or (age_min == 0 and age_max == 0)

    target_tags = []
    for code in (item.get("jobCd") or "").split(","):
        label = YOUTH_JOB_CODES.get(code.strip())
        if label:
            target_tags.append(label)
    for code in (item.get("schoolCd") or "").split(","):
        label = YOUTH_SCHOOL_CODES.get(code.strip())
        if label:
            target_tags.append(label)

    earn_code = (item.get("earnCndSeCd") or "").strip()
    if earn_code == "0043002":
        earn_min = _youth_to_int(item.get("earnMinAmt"))
        earn_max = _youth_to_int(item.get("earnMaxAmt"))
        income = f"연소득 {earn_min:,}원 ~ {earn_max:,}원" if (earn_min or earn_max) else "연소득 조건 있음"
    elif earn_code == "0043003":
        income = (item.get("earnEtcCn") or "").strip() or "기타 소득 조건"
    else:
        income = ""

    if (item.get("bizPrdBgngYmd") or "").strip() and (item.get("bizPrdEndYmd") or "").strip():
        biz_period = f"{item['bizPrdBgngYmd'].strip()} ~ {item['bizPrdEndYmd'].strip()}"
    else:
        biz_period = (item.get("bizPrdEtcCn") or "").strip()

    return {
        "id": item.get("plcyNo"),
        "name": item.get("plcyNm") or "정책명 없음",
        "keywords": keywords,
        "summary": (item.get("plcyExplnCn") or "").strip(),
        "support": (item.get("plcySprtCn") or "").strip(),
        "category": (item.get("lclsfNm") or "").strip(),
        "subCategory": (item.get("mclsfNm") or "").strip(),
        "org": org,
        "regionLabel": region_label,
        "regionCodes": prefixes,
        "ageMin": None if age_unlimited else age_min,
        "ageMax": None if age_unlimited else age_max,
        "targetTags": target_tags,
        "income": income,
        "applyPeriod": (item.get("aplyYmd") or "").strip(),
        "applyStatus": status,
        "deadline": deadline,
        "dDay": d_day,
        "bizPeriod": biz_period,
        "applyMethod": (item.get("plcyAplyMthdCn") or "").strip(),
        "screening": (item.get("srngMthdCn") or "").strip(),
        "documents": (item.get("sbmsnDcmntCn") or "").strip(),
        "addQualification": (item.get("addAplyQlfcCndCn") or "").strip(),
        "etc": (item.get("etcMttrCn") or "").strip(),
        "applyUrl": _youth_clean_url(item.get("aplyUrlAddr")),
        "refUrl": _youth_clean_url(item.get("refUrlAddr1")) or _youth_clean_url(item.get("refUrlAddr2")),
    }


# 온통청년 사이트의 분류명(금융·복지·문화, 참여·기반)과 코드정의서의 옛 이름(복지문화,
# 참여권리)이 서로 달라서, API 필터(lclsfNm)에 어떤 철자를 넣어야 결과가 나오는지
# 확신할 수 없음 — 그래서 후보 이름들을 순서대로 시도해서, 실제로 그 분류 정책이
# 돌아오는 이름을 찾아 기억해두고 씀(가운뎃점 종류 ･ · ㆍ 차이도 여기서 흡수).
_YOUTH_CATEGORY_CANDIDATES = {
    "일자리": ["일자리"],
    "주거": ["주거"],
    "교육직업훈련": ["교육･직업훈련", "교육·직업훈련", "교육"],
    "금융복지문화": ["금융･복지･문화", "금융·복지·문화", "복지문화", "복지･문화"],
    "참여기반": ["참여･기반", "참여·기반", "참여권리", "참여･권리"],
}
_youth_category_resolved = {}


def _youth_norm(text: str) -> str:
    """가운뎃점 종류/공백 차이를 무시하고 비교하려고 구분 문자를 모두 제거."""
    return re.sub(r"[･·ㆍ・\s]", "", text or "")


def _youth_resolve_category(category: str) -> str:
    if not category:
        return ""
    key = _youth_norm(category)
    if key in _youth_category_resolved:
        return _youth_category_resolved[key]
    candidates = _YOUTH_CATEGORY_CANDIDATES.get(key, [category])
    for cand in candidates:
        items, _ = _youth_fetch_upstream(1, "", cand)
        if not items:
            continue
        # API가 모르는 lclsfNm을 무시하고 전체를 돌려주는 경우를 걸러내려고,
        # 실제 돌려받은 정책의 분류명이 후보와 일치하는지도 확인
        got = _youth_norm(items[0].get("lclsfNm"))
        want = _youth_norm(cand)
        if got.startswith(want) or want.startswith(got):
            _youth_category_resolved[key] = cand
            return cand
    print(f"  ⚠ [policies] 분류 '{category}'에 맞는 lclsfNm 값을 찾지 못함 (시도: {candidates})")
    return candidates[0]


def _youth_fetch_upstream(page: int, query: str, category: str):
    """온통청년 getPlcy 한 페이지 호출 -> (원본 리스트, 전체 건수). 결과는 30분 캐시."""
    cache_key = (page, query, category)
    now = time.time()
    with _youth_cache_lock:
        cached = _youth_cache.get(cache_key)
        if cached and (now - cached["fetched_at"]) < YOUTH_CACHE_TTL_SECONDS:
            return cached["items"], cached["total"]

    params = {
        "apiKeyNm": YOUTH_API_KEY,
        "pageNum": page,
        "pageSize": YOUTH_UPSTREAM_PAGE_SIZE,
        "rtnType": "json",
    }
    if query:
        params["plcyNm"] = query
    if category:
        params["lclsfNm"] = category

    try:
        res = requests.get(YOUTH_API_URL, params=params, timeout=20)
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        print(f"  ⚠ [policies] 호출 실패: {e}")
        raise HTTPException(status_code=502, detail="온통청년 API 호출에 실패했습니다.")

    if data.get("resultCode") != 200:
        print(f"  ⚠ [policies] API 오류: {data.get('resultMessage')}")
        raise HTTPException(status_code=502, detail=f"온통청년 API 오류: {data.get('resultMessage')}")

    result = data.get("result") or {}
    items = result.get("youthPolicyList") or []
    total = _youth_to_int((result.get("pagging") or {}).get("totCount"))

    with _youth_cache_lock:
        if len(_youth_cache) > 200:  # 메모리 보호 — 너무 쌓이면 통째로 비움
            _youth_cache.clear()
        _youth_cache[cache_key] = {"fetched_at": now, "items": items, "total": total}
    return items, total


@app.get("/api/policies")
def get_policies(
    page: int = 1,
    q: str = "",
    category: str = "",
    region: str = "",  # 시도 코드 앞 2자리, 콤마로 여러 개(예: 부산="26", 강원="51,42")
    age: Optional[int] = None,
    include_closed: bool = False,
):
    if not YOUTH_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="YOUTH_API_KEY 환경변수가 설정되지 않았습니다. Render(또는 로컬 .env)에 등록해주세요.",
        )

    q = q.strip()
    category = _youth_resolve_category(category.strip())
    region_codes = [c.strip() for c in region.split(",") if c.strip()]
    page = max(1, page)

    collected = []
    total = 0
    next_page = None
    fetched_pages = 0
    current = page
    while fetched_pages < YOUTH_MAX_UPSTREAM_PAGES_PER_REQUEST:
        raw_items, total = _youth_fetch_upstream(current, q, category)
        fetched_pages += 1
        for raw in raw_items:
            policy = _youth_transform(raw)
            # 승인된 정책만(0044002) — 임시저장/반려 상태는 일반 사용자에게 보이면 안 됨
            if (raw.get("plcyAprvSttsCd") or "").strip() not in ("", "0044002"):
                continue
            if not include_closed and policy["applyStatus"] == "마감":
                continue
            if region_codes and policy["regionCodes"] and not any(c in policy["regionCodes"] for c in region_codes):
                continue
            if age is not None and policy["ageMin"] is not None:
                if age < policy["ageMin"] or (policy["ageMax"] and age > policy["ageMax"]):
                    continue
            collected.append(policy)
        has_more = current * YOUTH_UPSTREAM_PAGE_SIZE < total and bool(raw_items)
        next_page = current + 1 if has_more else None
        current += 1
        if len(collected) >= YOUTH_RESULT_TARGET or not has_more:
            break

    return {
        "policies": collected,
        "count": len(collected),
        "totalCount": total,  # 온통청년 전체 건수(필터 전 기준 — 참고용)
        "nextPage": next_page,
    }
