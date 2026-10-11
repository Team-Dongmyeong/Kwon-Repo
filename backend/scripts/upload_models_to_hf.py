"""
모델 폴더 2개를 Hugging Face '비공개' 저장소에 올리기 (배포용, 1번만)
모델 파일은 수백 MB라 GitHub(파일당 100MB 제한)에 올릴 수 없기 때문입니다.

준비: https://huggingface.co 가입 → Settings → Access Tokens → 'Write' 토큰 발급
  pip install huggingface_hub
  (backend 폴더에서) python scripts/upload_models_to_hf.py 내HF아이디 hf_토큰값
"""
import sys

from huggingface_hub import HfApi

user, token = sys.argv[1], sys.argv[2]
api = HfApi(token=token)

for folder, repo in [
    ("models/kcelectra_emotion_final", f"{user}/kcelectra-emotion-final"),
    ("models/fine_tuned_kr_sbert_148_perfect", f"{user}/kr-sbert-148-perfect"),
]:
    api.create_repo(repo, private=True, exist_ok=True)
    api.upload_folder(folder_path=folder, repo_id=repo,
                      ignore_patterns=["checkpoint-*", "*.pt", "optimizer*", "runs/*"])
    print(f"업로드 완료: {folder} → {repo}")

print("\nRender 환경변수에 아래처럼 넣으세요:")
print(f"  EMOTION_MODEL_PATH={user}/kcelectra-emotion-final")
print(f"  SBERT_MODEL_PATH={user}/kr-sbert-148-perfect")
print("  HF_TOKEN=(Read 권한 토큰)")
