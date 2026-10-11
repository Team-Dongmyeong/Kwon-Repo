"""
모델 2개가 제대로 불러와지는지, 라벨 순서와 임베딩 차원을 확인 (내 컴퓨터에서)

  (backend 폴더에서) python scripts/check_models.py
"""
import os
import sys

import torch
from dotenv import find_dotenv, load_dotenv
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForSequenceClassification, AutoTokenizer

EMO = os.getenv("EMOTION_MODEL_PATH", "models/kcelectra_emotion_final")
SB = os.getenv("SBERT_MODEL_PATH", "models/fine_tuned_kr_sbert_148_perfect")

load_dotenv(find_dotenv())  # .env의 EMOTION_MODEL_PATH / SBERT_MODEL_PATH 반영
EMO = os.getenv("EMOTION_MODEL_PATH", EMO)
SB = os.getenv("SBERT_MODEL_PATH", SB)

# 로컬 경로처럼 보이는데 config.json이 없으면 Hugging Face로 넘어가 401 오류가 나므로 미리 확인
for path in (EMO, SB):
    if path.startswith(("models/", "./", "C:", "c:")) and not os.path.isfile(os.path.join(path, "config.json")):
        print(f"[오류] '{path}/config.json' 이 없습니다. 모델 폴더 위치/이름을 확인하세요.")
        print("       현재 위치:", os.getcwd())
        print("       models 폴더 안:", os.listdir("models") if os.path.isdir("models") else "models 폴더가 없음")
        sys.exit(1)

tok = AutoTokenizer.from_pretrained(EMO)
m = AutoModelForSequenceClassification.from_pretrained(EMO).eval()
print("감정 라벨(id2label):", m.config.id2label)
print("  → LABEL_0 형식이면 rag/loader.py의 FALLBACK_EMOTIONS 순서가 학습 순서와 같은지 확인!")
for s in ["면접에서 또 떨어져서 너무 우울해요", "합격했어요!! 너무 기뻐요", "백엔드 개발자 연봉이 궁금해요"]:
    with torch.no_grad():
        p = torch.softmax(m(**tok(s, return_tensors="pt")).logits, -1)[0]
    i = int(p.argmax())
    print(f"  {s} → {m.config.id2label[i]} ({p[i]:.2f})")

sb = SentenceTransformer(SB, device="cpu")
print("SBERT 임베딩 차원:", sb.get_sentence_embedding_dimension(), "→ sql/rag_setup.sql의 vector(768) 숫자와 같아야 함")
