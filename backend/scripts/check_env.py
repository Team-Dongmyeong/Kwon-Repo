"""
.env의 Supabase 주소/키가 올바른지 검사 (키 값 자체는 화면에 출력하지 않음)

  (backend 폴더에서) python scripts/check_env.py
"""
import base64
import json
import os

from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(), override=True)

url = os.getenv("SUPABASE_URL", "")
url_ref = url.split("//")[-1].split(".")[0] if url else ""
print(f"SUPABASE_URL 프로젝트 ID: {url_ref or '(비어 있음!)'}")
if url and not (url.startswith("https://") and ".supabase.co" in url):
    print("  ⚠ URL 형식이 https://xxxx.supabase.co 가 아닙니다.")


def inspect(name):
    v = os.getenv(name)
    if not v:
        print(f"\n[{name}] ⚠ 값이 없습니다.")
        return None
    print(f"\n[{name}] 길이 {len(v)}자")
    if v != v.strip():
        print("  ⚠ 앞이나 뒤에 공백이 있습니다.")
    if v.strip()[:1] in "\"'“”" or v.strip()[-1:] in "\"'“”":
        print("  ⚠ 따옴표가 값에 포함되어 있습니다. 따옴표를 지우세요.")
    v = v.strip().strip("\"'“”")

    if v.startswith("eyJ"):
        parts = v.split(".")
        if len(parts) != 3:
            print(f"  ⚠ 예전(JWT) 형식 키인데 조각이 {len(parts)}개입니다(정상 3개). 복사가 잘렸거나 다른 글자가 섞였어요.")
            return v
        try:
            payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
        except Exception:
            print("  ⚠ 키 내용을 해석할 수 없습니다. 복사가 잘못된 것 같아요.")
            return v
        role, ref = payload.get("role"), payload.get("ref")
        print(f"  종류: 예전(JWT) 형식 / role = {role} / 프로젝트 ID = {ref}")
        if url_ref and ref and ref != url_ref:
            print("  ⚠ 키의 프로젝트 ID가 SUPABASE_URL과 다릅니다! 다른 프로젝트의 키예요.")
        if name == "SUPABASE_SERVICE_ROLE_KEY" and role != "service_role":
            print(f"  ⚠ service_role 키가 아니라 '{role}' 키가 들어 있습니다.")
    elif v.startswith("sb_secret_"):
        print("  종류: 새 형식 secret 키 (service_role 역할)")
    elif v.startswith("sb_publishable_"):
        print("  종류: 새 형식 publishable 키 (anon 역할)")
        if name == "SUPABASE_SERVICE_ROLE_KEY":
            print("  ⚠ 여기에는 publishable이 아니라 secret(service_role) 키가 들어가야 합니다.")
    else:
        print("  ⚠ 알 수 없는 형식입니다 (eyJ / sb_secret_ / sb_publishable_ 로 시작해야 함).")
    return v


anon = inspect("SUPABASE_KEY")
service = inspect("SUPABASE_SERVICE_ROLE_KEY")

print("\n=== 실제 접속 테스트 ===")
try:
    from supabase import create_client

    for name, key in (("SUPABASE_KEY", anon), ("SUPABASE_SERVICE_ROLE_KEY", service)):
        if not key:
            continue
        try:
            create_client(url, key).table("job_profiles").select("id").limit(1).execute()
            print(f"[{name}] ✅ 접속 성공")
        except Exception as e:
            msg = str(e)
            if "Invalid API key" in msg:
                print(f"[{name}] ❌ Invalid API key — 키 값이 이 프로젝트에서 인정되지 않습니다.")
            elif "does not exist" in msg or "42P01" in msg:
                print(f"[{name}] ✅ 키는 정상 (job_profiles 테이블이 아직 없음 → 6단계 SQL 먼저 실행)")
            else:
                print(f"[{name}] ❌ {msg[:200]}")
except ImportError:
    print("supabase 패키지가 없습니다. venv가 켜져 있는지 확인하세요.")
