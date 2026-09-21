# React–FastAPI–Supabase 시스템 구축 및 배포 진행 보고서

> **작성 배경**: 로컬 환경에서 구동되던 회원가입/로그인 인프라를 외부 네트워크 접속 가능 구조로 전환(1번)하고, `.env` 기반 보안 환경 구축(4번)을 완료한 내역 및 문제 해결 과정과 차후 작업 단계를 정리한 문서.  
> **작성일**: 2026-09-21

---

## 1. 진행 완료 내역 및 문제 해결 과정

### [1번] 외부 접근 가능 인프라 구축 및 백엔드 배포 완료

외부 사용자가 프론트엔드에 접속하여 가입/로그인할 때 내 Supabase DB에 정상적으로 데이터가 기록되도록 백엔드를 클라우드에 배포함.

#### **진행 과정 및 문제 해결 (Troubleshooting)**
1. **GitHub 팀 저장소 권한 및 접근 문제 해결**:
   - **문제**: 기존 팀 저장소가 Organization 권한 문제로 인해 Render 서비스 생성 시 목록에 검색되지 않는 현상 발생.
   - **해결**: 팀 권한 승인 대기 대신, 내 PC의 `backend/` 폴더 코드를 전용 개인 GitHub 저장소(`capstone-backend`)로 분리하여 새로 `git push` 진행 및 Render와 즉시 연동.
2. **Render 배포 및 런타임 오설정(Node.js $\rightarrow$ Python 3) 해결**:
   - **문제**: Render 서비스 생성 후 배포 실행 시 `Failed deploy` 에러가 발생하며, Runtime이 파이썬이 아닌 `Node`로 오설정된 것을 확인.
   - **해결**: Render 웹 서비스 설정(`Settings`) 또는 서비스 재생성을 통해 **Runtime을 Python 3로 변경**하고, 아래 빌드/실행 스크립트를 올바르게 등록하여 배포 성공.
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main2:app --host 0.0.0.0 --port $PORT`
3. **최종 공개 백엔드 URL 발급 완료**:
   - `https://kwon-backend.onrender.com`

---

### [4번] `.env` 기반 보안 환경 구축 완료

`config.py` 내 하드코딩되어 있던 Supabase API Key 및 URL 유출 위험을 방지하기 위해 환경변수 관리 체계 도입.

#### **진행 과정 및 문제 해결 (Troubleshooting)**
1. **로컬 개발 환경 보안 파일 구성**:
   - `backend/.env` 특수 파일을 생성하고 `SUPABASE_URL`과 `SUPABASE_KEY`를 Key-Value 형태로 작성.
   - VS Code 내 `.env` 파일 저장 시 발생한 터미널 주입 관련 알림 문구 확인 후, 파이썬 코드 내 `python-dotenv` 패키지의 `load_dotenv()` 구문으로 자동 읽기가 처리됨을 확인 및 정상 적용.
2. **Git 유출 차단 설정**:
   - `backend/.gitignore` 파일에 `.env` 항목을 추가하여 GitHub 저장소에 보안 키가 올릴 수 없도록 완전 차단.
3. **`config.py` 코드 수정**:
   - `os.getenv("SUPABASE_URL")` 및 `os.getenv("SUPABASE_KEY")`로 수정하여 소스코드에서 비밀번호와 키 값을 완전 제거.
4. **운영 배포 환경 (Render) 보안 변수 적용**:
   - Render 대시보드의 `Environment` 메뉴에 접속하여 `Edit` 편집 모드로 전환.
   - `SUPABASE_URL` 및 `SUPABASE_KEY`에 실제 Supabase 주소와 Publishable Key 값(Key-Value)을 입력 및 저장하여 운영 환경 구축 완료.

---

## 2. 향후 진행 과정 (Next Steps)

### Step 1. 프론트엔드 API 호출 주소 변경 및 재배포
- **작업 내용**: 프론트엔드 담당 팀원에게 발급된 백엔드 URL 전달 후 프론트엔드 코드 수정 요청.
- **수정 위치**: `Signup.jsx` 및 `Login.jsx`
- **수정 코드**:
  - 기존: `http://localhost:8000/api/signup` / `http://localhost:8000/api/login`
  - 변경: `https://kwon-backend.onrender.com/api/signup` / `https://kwon-backend.onrender.com/api/login`
- 수정 완료 후 Vercel 재배포 진행.

---

### Step 2. Supabase 대시보드 URL 등록 (CORS 및 리다이렉트 허용)
- **작업 내용**: 프론트엔드 배포 도메인(`https://capstone-project-pied-seven.vercel.app`)을 Supabase 인증 정책에 등록.
- **설정 메뉴**: Supabase 대시보드 $\rightarrow$ `Authentication` $\rightarrow$ `URL Configuration`
  - `Site URL`: `https://capstone-project-pied-seven.vercel.app` 입력
  - `Redirect URLs`: `https://capstone-project-pied-seven.vercel.app` 추가 후 Save.

---

### Step 3. 외부 환경 통합 테스트
- **작업 내용**: 모바일 네트워크(LTE/5G) 또는 외부 PC에서 실제 회원가입 및 로그인 동작 검증.
- **검증 항목**:
  1. 외부 디바이스에서 프론트엔드 접속 후 가입 진행.
  2. Supabase `Authentication` $\rightarrow$ `Users`에 가입된 이메일 생성 확인.
  3. Supabase `Table Editor` $\rightarrow$ `profiles` 테이블에 유저 정보 동기화 기록 확인.

---

### Step 4. 이메일 6자리 OTP 인증 시스템 도입 (3번 항목 예정 작업)
- **작업 내용**: 이메일 가입 시 6자리 인증 코드를 발송하고, 프론트엔드에서 번호 입력 후 승인받는 방식 도입.
- **진행 절차**:
  1. Supabase `Authentication` $\rightarrow$ `Providers` $\rightarrow$ `Email`에서 `Confirm email` 옵션 비활성화 해제(ON).
  2. 백엔드 `supabase_client.py`에 OTP 발송(`auth.sign_up` / `auth.sign_in_with_otp`) 및 검증(`auth.verify_otp`) 함수 작성.
  3. 프론트엔드 UI에 인증번호 6자리 입력 폼 및 시간제한 로직 추가.