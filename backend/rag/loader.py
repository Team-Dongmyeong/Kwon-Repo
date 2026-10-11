"""
KcELECTRA(감정) / SBERT(임베딩) 모델과 직무 데이터를 '백그라운드'에서 로드합니다.

- 서버는 바로 켜지고(Render 포트 감지 지연 방지), 모델 로드가 끝나기 전에 온
  채팅은 기존처럼 GPT 단독으로 응답합니다.
- 로드에 실패해도 서버는 죽지 않고 GPT 단독 모드로 계속 동작합니다.
- 상태 확인: GET / 응답의 "rag" 값 (loading / ready / disabled / error: ...)

모델 경로 환경변수 값은 둘 중 하나:
  - 로컬 폴더:  models/kcelectra_emotion_final
  - Hugging Face 비공개 저장소 이름: 내아이디/kcelectra-emotion  (+ HF_TOKEN)
"""
from __future__ import annotations

import os
import threading
import traceback

EMOTION_MODEL_PATH = os.getenv("EMOTION_MODEL_PATH", "models/kcelectra_emotion_final")
SBERT_MODEL_PATH = os.getenv("SBERT_MODEL_PATH", "models/fine_tuned_kr_sbert_148_perfect")
HF_TOKEN = os.getenv("HF_TOKEN") or None

# 학습 때 label 번호 순서와 같아야 합니다. (config.json의 id2label이 LABEL_0 형식일 때만 사용)
FALLBACK_EMOTIONS = ["공포", "놀람", "분노", "슬픔", "중립", "행복", "혐오"]


class _State:
    status = "not_started"     # not_started / disabled / loading / ready / error: ...
    tokenizer = None
    emotion_model = None
    emotion_labels: list = []
    sbert = None


S = _State()


def _load() -> None:
    S.status = "loading"
    try:
        import torch
        from sentence_transformers import SentenceTransformer
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        from .job_lookup import load_jobs

        torch.set_num_threads(int(os.getenv("TORCH_THREADS", "2")))

        S.tokenizer = AutoTokenizer.from_pretrained(EMOTION_MODEL_PATH, token=HF_TOKEN)
        S.emotion_model = AutoModelForSequenceClassification.from_pretrained(
            EMOTION_MODEL_PATH, token=HF_TOKEN
        ).eval()
        id2label = S.emotion_model.config.id2label
        labels = [id2label[i] for i in range(len(id2label))]
        if all(str(l).startswith("LABEL_") for l in labels):
            print(f"[RAG] id2label이 기본값이라 FALLBACK_EMOTIONS 순서를 씁니다: {FALLBACK_EMOTIONS}")
            labels = FALLBACK_EMOTIONS
        S.emotion_labels = labels

        S.sbert = SentenceTransformer(SBERT_MODEL_PATH, token=HF_TOKEN, device="cpu")

        n_jobs = load_jobs()
        S.status = "ready"
        print(f"[RAG] 준비 완료 — 감정 라벨 {labels}, SBERT 차원 "
              f"{S.sbert.get_sentence_embedding_dimension()}, 직무 {n_jobs}개")
    except Exception as e:  # 실패해도 서버는 GPT 단독 모드로 계속
        S.status = f"error: {e!r}"
        print("[RAG] 로드 실패 → GPT 단독 모드로 동작합니다.")
        traceback.print_exc()


def start_background_load() -> None:
    if os.getenv("RAG_ENABLED", "true").lower() != "true":
        S.status = "disabled"
        print("[RAG] RAG_ENABLED=false → GPT 단독 모드")
        return
    threading.Thread(target=_load, daemon=True).start()


def is_ready() -> bool:
    return S.status == "ready"


def status() -> str:
    return S.status
