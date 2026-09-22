import os
import uuid
from typing import Dict, List, Optional

from dotenv import load_dotenv, find_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

from prompts import SYSTEM_PROMPT

# 프로젝트 루트(capstone_project/.env)를 위로 올라가며 찾아서 로드.
# backend 폴더 안에서 uvicorn을 실행해도, 루트에 있는 .env를 그대로 찾습니다.
load_dotenv(find_dotenv())

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI(title="마음잇기 Chat API")

# 로컬 개발 주소(Vite) + 배포된 Vercel 프론트 주소를 기본으로 허용.
# Render 배포 시 ALLOWED_ORIGINS 환경변수에 콤마(,)로 추가 주소를 넣으면
# (예: 다른 브랜치 프리뷰 배포 주소 등) 코드 수정 없이 늘릴 수 있음.
_default_origins = [
    "http://localhost:5173",
    "kwon-repo-6mne-omzyd9u0h-45888.vercel.app",
]
_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
allow_origins = _default_origins + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: Supabase 연동 후 실제 DB로 교체 예정.
# 지금은 서버가 켜져 있는 동안만 세션별 대화 맥락을 메모리에 유지합니다
# (서버 재시작하면 사라짐 — 여러 대화 세션을 동시에 이어갈 수 있게 하기 위한
# 최소한의 구조이며, 감정/키워드 분석 결과 저장은 kcELECTRA/SBERT 서빙(/analyze)과
# Supabase가 붙는 다음 단계에서 이어집니다).
session_store: Dict[str, List[dict]] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # 없으면 새 세션으로 시작


class ChatResponse(BaseModel):
    session_id: str
    reply: str


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
