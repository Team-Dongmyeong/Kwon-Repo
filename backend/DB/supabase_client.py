from DB.config import supabase

# 1. 회원가입 (Auth + profiles 자동 연결)
def register_user(email: str, password: str, name: str):
    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": { "name": name }  # SQL 트리거를 통해 profiles 테이블로 전달됨
            }
        })
        return {"success": True, "data": response}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 2. 로그인
def login_user(email: str, password: str):
    try:
        # Supabase Auth 비밀번호 검증 로그인
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        return {
            "success": True, 
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "name": response.user.user_metadata.get("name", "사용자")
            },
            "session": {
                "access_token": response.session.access_token
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

# 3. 마이페이지 프로필 및 감정 데이터 조회
def get_user_info_query(user_id: str):
    try:
        # Supabase 파이썬 SDK를 통해 profiles 테이블에서 해당 user_id 정보 조회
        response = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user_id)
            .execute()
        )
        return {"success": True, "data": response.data}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 4. 분석된 감정 점수 업데이트 (KcELECTRA 분석 후 사용)
def update_emotion_scores(user_id: str, scores: dict):
    try:
        response = supabase.table("profiles").update(scores).eq("id", user_id).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    