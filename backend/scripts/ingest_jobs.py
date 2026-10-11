"""
job_profiles.jsonl → SBERT 임베딩 → Supabase job_profiles 테이블 (내 컴퓨터에서 1번만 실행)

  (backend 폴더에서) python scripts/ingest_jobs.py data/job_profiles.jsonl

엑셀을 고치면 build_job_profiles.py → ingest_jobs.py 를 다시 실행 (upsert라 중복 안 생김)
"""
import json
import os
import sys

from dotenv import find_dotenv, load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client

load_dotenv(find_dotenv())
SBERT = os.getenv("SBERT_MODEL_PATH", "models/fine_tuned_kr_sbert_148_perfect")


def main(path):
    rows = [json.loads(l) for l in open(path, encoding="utf-8")]
    model = SentenceTransformer(SBERT, device="cpu")
    embs = model.encode([r["profile_text"] for r in rows], batch_size=16,
                        normalize_embeddings=True, show_progress_bar=True)
    for r, e in zip(rows, embs):
        r["embedding"] = e.tolist()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    sb.table("job_profiles").upsert(rows, on_conflict="category,job_name").execute()
    print(f"{len(rows)}개 저장 완료 (임베딩 차원 {len(rows[0]['embedding'])})")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/job_profiles.jsonl")
