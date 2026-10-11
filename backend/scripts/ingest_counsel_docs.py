"""
(선택) 고민 문장 데이터(취업진로/역량부족 라벨이 붙은 문장들) → Supabase kb_documents
사용자 말과 비슷한 고민을 찾아 '고민 유형'을 추정하는 데 씁니다.
없으면 건너뛰어도 RAG는 동작합니다(고민 유형은 키워드로만 추정).

  (backend 폴더에서)
  python scripts/ingest_counsel_docs.py data/고민문장.csv --text 문장 --type 고민유형

--text: 문장이 들어 있는 열 이름 / --type: '취업진로' 또는 '역량부족' 값이 들어 있는 열 이름
"""
import argparse
import os

import pandas as pd
from dotenv import find_dotenv, load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client

load_dotenv(find_dotenv())
SBERT = os.getenv("SBERT_MODEL_PATH", "models/fine_tuned_kr_sbert_148_perfect")

def read_table(path):
    """.xlsx / .csv 둘 다 지원. 엑셀에서 저장한 한글 CSV(cp949)도 읽음"""
    if not path.lower().endswith(".csv"):
        return pd.read_excel(path)
    for enc in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=enc)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"CSV 인코딩을 읽을 수 없습니다: {path}")


p = argparse.ArgumentParser()
p.add_argument("path")
p.add_argument("--text", required=True)
p.add_argument("--type", required=True)
a = p.parse_args()

df = read_table(a.path)
df = df.dropna(subset=[a.text, a.type])
df[a.text] = df[a.text].astype(str).str.strip()
df = df.drop_duplicates(subset=[a.text])

model = SentenceTransformer(SBERT, device="cpu")
embs = model.encode(df[a.text].tolist(), batch_size=32, normalize_embeddings=True, show_progress_bar=True)

rows = [{"concern_type": t, "content": c, "source": os.path.basename(a.path), "embedding": e.tolist()}
        for t, c, e in zip(df[a.type], df[a.text], embs)]
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
for i in range(0, len(rows), 200):
    sb.table("kb_documents").insert(rows[i:i + 200]).execute()
print(f"{len(rows)}개 저장 완료. 유형별:", df[a.type].value_counts().to_dict())
