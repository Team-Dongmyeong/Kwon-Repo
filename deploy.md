# 마음잇기 — 배포(Deploy) 가이드

> 최종 갱신: 2026-09-20 · 담당: 경민
> 이 문서는 "로컬에서 명령어 쳐서 켜야만 동작하던 상태"에서 "주소창에 URL만 치면 바로 동작하는 상태"까지 실제로 밟았던 과정을 순서대로 정리한 것. 새로 세팅하거나(다른 PC/노트북), 팀원이 이어받아야 할 때 이 문서 하나로 처음부터 끝까지 따라갈 수 있게 작성함.

## 0. 전체 그림

```
[로컬 개발]                         [배포]
Vite 개발서버(5173) ──┐             Vercel(프론트, 정적 빌드)
                      ├─ 배포 ──►         │  VITE_API_URL로 백엔드 주소를 앎
uvicorn 개발서버(8000)┘             Render(백엔드, FastAPI 상시 실행)
                                          │  CORS로 프론트 주소를 허용해줌
                                    GPT-4o mini(OpenAI API)
```

프론트와 백엔드는 서로 독립적인 서비스에 배포되고, **서로의 주소를 양쪽에서 알고 있어야** 정상 동작한다.
- 프론트 → 백엔드: 프론트가 `VITE_API_URL` 환경변수로 백엔드 주소를 알아야 API를 호출할 수 있음
- 백엔드 → 프론트: 백엔드가 CORS 설정에 프론트 주소를 허용 목록으로 넣어놔야, 브라우저가 그 요청을 막지 않음

이 둘 중 하나라도 빠지면 "배포는 됐는데 서로 연결이 안 되는" 상태가 된다 (실제로 이 프로젝트에서 이 문제로 여러 번 막혔음 — 7장 참고).

## 1. 로컬 개발 환경 (배포 이전 단계)

배포를 이해하려면 먼저 로컬에서 뭘 하고 있었는지부터 알아야 한다.

### 1-1. 프로젝트 구조

- 저장소 루트(`C:\Git\capstone_project`)가 **프론트엔드**(React + Vite)
- 그 안의 `backend/` 폴더가 **백엔드**(FastAPI) — `main.py`, `prompts.py`, `requirements.txt`
- 이 둘은 완전히 별개의 프로세스라서, 로컬에서 테스트하려면 **터미널 창을 두 개** 띄워서 각각 따로 실행해야 했음

### 1-2. 환경변수(`.env`) 준비

- 저장소 루트에 `.env` 파일을 만들고 `OPENAI_API_KEY=sk-...` 값을 넣음
- `.env`는 `.gitignore`에 등록되어 있어서 **git에 절대 올라가지 않음** — 즉 다른 PC(노트북 등)로 저장소를 옮기면 `.env`는 따라오지 않고, 그 PC에서 매번 새로 만들어줘야 함 (API 키가 깃허브에 노출되는 걸 막기 위한 의도적인 설계)
- 백엔드(`main.py`)는 `load_dotenv(find_dotenv())`로 이 파일을 자동으로 찾아서 읽음

### 1-3. 백엔드 로컬 실행

1. `backend` 폴더로 이동
2. 패키지 설치(최초 1회): `pip install -r requirements.txt`
   - Windows PowerShell에서 `pip`가 "명령어를 찾을 수 없음"으로 뜨는 경우가 있었음(PATH 문제) → 이럴 땐 `py -m pip install -r requirements.txt`로 대체
3. 서버 실행: `uvicorn main:app --reload`
   - 마찬가지로 PATH 문제 있으면 `py -m uvicorn main:app --reload`
   - `--reload`는 코드 수정 시 자동 재시작해주는 **개발 전용 옵션** — 배포할 땐 빼야 함(4장 참고)
4. 확인: 브라우저에서 `http://localhost:8000/docs` 접속 → FastAPI가 자동 생성해주는 Swagger UI에서 `/chat` 엔드포인트를 직접 테스트해볼 수 있음. `http://localhost:8000/`은 헬스체크용(`{"status":"ok",...}` JSON만 반환)

### 1-4. 프론트엔드 로컬 실행

1. 저장소 루트에서 패키지 설치(최초 1회): `npm install`
2. 서버 실행: `npm run dev`
3. `http://localhost:5173` 접속 — 이때 프론트의 `src/lib/chatApi.js`가 `VITE_API_URL` 환경변수가 없으면 기본값으로 `http://localhost:8000`을 호출하도록 되어 있어서, **백엔드(uvicorn)도 같이 켜져 있어야** 채팅이 동작함

### 1-5. 로컬 개발의 한계

이 상태는 "내 컴퓨터에서 두 터미널 창을 계속 켜놓고 있어야만" 동작하는 상태다. 배포의 목적은 이 두 서버를 각각 **항상 켜져 있는 서비스**로 옮겨서, 로컬 명령어 없이 그냥 주소창에 URL만 쳐도 동작하게 만드는 것.

## 2. GitHub 저장소 준비

Vercel과 Render 둘 다 "GitHub 저장소를 연결해두면, push할 때마다 자동으로 재배포"하는 방식으로 동작한다. 그래서 배포 전에 최신 코드가 GitHub에 올라가 있어야 한다.

```
git add <파일>
git commit -m "설명"
git push
```

**주의**: `.env`는 원래도 안 올라가는 게 맞고(gitignore), 코드를 수정한 뒤에 `git status`로 실제로 변경사항이 반영됐는지 확인하는 습관이 중요하다 (에디터가 파일을 원래대로 되돌려놓는 사고가 실제로 있었음 — 7-1 참고).

## 3. 백엔드 배포 — Render

### 3-1. 가입 및 서비스 생성

1. https://render.com 접속 → GitHub 계정으로 가입/로그인
2. 대시보드에서 "New +" → "Web Service" 선택
3. GitHub 저장소 목록에서 프로젝트 저장소 선택 (처음이면 Render가 해당 저장소에 접근할 수 있게 GitHub 권한 허용 필요)

### 3-2. 설정값

| 항목 | 값 |
|---|---|
| Name | 아무 이름 (예: `capstone_project`) |
| Language/Runtime | Python 3 |
| Branch | `main` |
| Region | Singapore (한국에서 제일 가까움) |
| Root Directory | `backend` — 저장소 루트가 아니라 백엔드 코드가 있는 폴더를 지정 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` — 로컬과 달리 `--reload`는 빼고, `--host 0.0.0.0 --port $PORT`를 추가(Render가 할당하는 포트를 그대로 써야 함) |
| Instance Type | Free |

### 3-3. 환경변수 등록

같은 화면(또는 생성 후 "Environment" 메뉴)에서 "Add Environment Variable":

- Key: `OPENAI_API_KEY`
- Value: 로컬 `.env`에 있던 것과 같은 실제 API 키 값

이게 배포 환경에서의 `.env` 역할을 한다 — 파일을 올리는 게 아니라, 대시보드에 값만 직접 입력하는 방식.

### 3-4. 배포 및 주소 확인

"Create Web Service" 누르면 빌드·배포가 자동 시작된다. 로그에 `Application startup complete`, `Your service is live 🎉`가 뜨면 성공.

**중요**: 이때 Render가 자동으로 배정하는 주소(예: `https://capstone-project-XXXX.onrender.com`)를 정확히 확인해야 한다. 이 프로젝트에서는 스크린샷 속 글씨를 잘못 읽어서(`1`을 `f`로 착각) 한참을 엉뚱한 주소로 테스트하며 헤맨 적이 있다. **반드시 대시보드의 파란 하이퍼링크(`Available at your primary URL` 아래 링크)를 직접 클릭해서, 새로 열리는 탭의 주소창에 뜨는 텍스트를 그대로 복사**해서 써야 한다.

### 3-5. 무료 플랜 특성

Render 무료 플랜은 **15분 동안 요청이 없으면 서버가 잠든다(spin down)**. 잠든 상태에서 다음 요청이 오면 다시 깨어나는 데 **30~50초 정도** 걸린다 — 이 시간 동안 응답이 느리거나 일시적으로 이상해 보일 수 있는데, 이건 에러가 아니라 정상 동작이다. 발표/시연처럼 즉각 응답이 필요한 순간에는 미리 한번 요청을 보내서 깨워두는 게 좋다. (상시 실행이 필요하면 유료 플랜으로 업그레이드하면 해결됨.)

## 4. 프론트엔드 배포 — Vercel

(저장소를 Vercel 프로젝트로 처음 연결하는 것 자체는 더 이전 단계에서 이미 완료된 상태 — 여기서는 "백엔드 주소를 프론트에 알려주는" 부분만 다룸.)

### 4-1. 환경변수 등록

1. https://vercel.com 대시보드 → 해당 프론트엔드 프로젝트 클릭
2. **Settings → Environments** (예전엔 "Environment Variables"가 사이드바에 별도로 있었는데, 최근 Vercel UI 개편으로 **Environments 메뉴 안, 각 환경(Production 등)의 상세 페이지 안**으로 옮겨짐)
3. **Production** 환경 클릭 → 페이지 아래쪽 **"Environment Variables"** 섹션에서 **"Add Environment Variable"** 클릭
4. 입력:
   - Key: `VITE_API_URL`
   - Value: 3-4에서 확인한 정확한 Render 주소 (예: `https://capstone-project-wq1u.onrender.com`, 끝에 슬래시 없이)
   - **Type은 "Config"로 선택** — "Secret"으로 저장하려 하면 경고가 뜸(`VITE_` 접두사가 붙은 값은 어차피 브라우저에 그대로 노출되는 값이라, "저장 후 다시 볼 수 없는" Secret 타입과 맞지 않기 때문. 경고 팝업에 있는 "Change to Config" 버튼을 누르면 됨)
5. Save

### 4-2. 재배포(Redeploy)

환경변수는 추가만 해서는 반영되지 않고, **재배포해야 적용**된다.

1. **Deployments** 탭 이동
2. 맨 위(최신) 배포 항목 오른쪽 점 3개(⋯) 클릭
3. **Redeploy** 선택 → 확인
4. 1~2분 기다리면 빌드 완료(상태 "Ready")

## 5. 백엔드 CORS 설정 (왜 필요하고 어떻게 했는지)

로컬 개발 중에는 `backend/main.py`의 CORS 설정이 `http://localhost:5173`만 허용하도록 되어 있었다. 배포된 Vercel 주소에서 오는 요청은 브라우저가 기본적으로 **CORS 정책 위반으로 차단**하기 때문에, 백엔드 코드에 Vercel 주소를 허용 목록에 반드시 추가해야 한다.

최종적으로 이렇게 구성함:

```python
_default_origins = [
    "http://localhost:5173",
    "https://capstone-project-pied-seven.vercel.app",
]
_extra_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
allow_origins = _default_origins + _extra_origins
```

기본 허용 목록(로컬 + 배포된 프론트 주소)은 코드에 직접 넣어두고, 추가로 허용할 주소가 생기면 코드를 안 고치고 Render의 `ALLOWED_ORIGINS` 환경변수(콤마로 구분)에 추가할 수 있게 만들어둠.

**주의**: 이 코드를 고친 뒤에는 로컬 파일만 저장해서는 아무 의미가 없고, **반드시 `git push`까지 해야 Render가 그 변경사항을 감지해서 재배포**한다. 로컬 파일은 고쳐졌는데 git push를 깜빡해서, 배포된 백엔드는 계속 예전 CORS 설정으로 돌아가고 있었던 적이 있다 (7-2 참고).

## 6. 최종 확인

로컬에서 `npm run dev`나 `uvicorn` 둘 다 켜지 않은 상태로:

1. 프론트 주소(`https://capstone-project-pied-seven.vercel.app`) 접속
2. 로그인 → 채팅 페이지에서 메시지 전송
3. GPT-4o mini 응답이 오면 배포 완료

## 7. 실제로 겪었던 문제와 해결 (트러블슈팅 기록)

다음에 비슷한 상황이 오면 바로 참고할 수 있도록, 이번 배포 과정에서 실제로 막혔던 지점들을 원인과 함께 정리.

### 7-1. 원격으로 고친 파일이 다시 예전 내용으로 돌아가 있었음

파일을 코드로 직접 수정해서 PC에 반영했는데도, `git status`가 "변경사항 없음(clean)"으로 뜨고 실제 파일 내용도 예전 그대로였던 적이 두 번 있었다(`Chat.jsx`, `backend/main.py` 각각). 원인은 **그 파일이 VS Code에 열려있는 상태에서 자동저장(또는 실수로 Ctrl+S)이 일어나면서, 에디터에 남아있던 옛날 버전 내용이 다시 덮어써진 것**. 해결: 파일을 외부에서 수정한 뒤에는 그 파일이 에디터에 열려있는지 확인하고, 열려있다면 "Revert File"이나 탭을 닫아서 최신 내용으로 다시 불러온 뒤 git 작업을 진행할 것.

### 7-2. CORS 에러 + 404가 동시에 뜸

배포된 프론트에서 백엔드를 호출할 때 브라우저 콘솔에 CORS 차단 에러와 404가 함께 떴다. 원인이 두 가지가 겹쳐 있었음:

1. 코드는 로컬에서 CORS 허용 목록에 Vercel 주소를 추가해뒀지만, **`git push`를 하지 않아서** GitHub·Render에는 반영이 안 된 상태(7-1의 자동저장 문제와 겹쳐서 한 번 더 발생)
2. 그 와중에 **Render 백엔드 주소 자체를 잘못 읽고 있었음** — 대시보드 화면의 글씨를 보고 `wqfu`로 착각했는데 실제로는 `wq1u`였음. 그래서 CORS를 제대로 고쳐도 애초에 존재하지 않는 주소로 요청을 보내고 있었으니 당연히 실패

해결: 1) `git status`로 실제 커밋 여부 확인 후 push, 2) Render 대시보드의 링크를 직접 클릭해서 주소창에 뜨는 정확한 텍스트로 재확인, 3) Vercel `VITE_API_URL`을 정확한 주소로 수정 후 재배포.

### 7-3. Render 무료 플랜 슬립으로 인한 일시적 오류처럼 보이는 현상

15분간 요청이 없어 서버가 잠들었다가 다음 요청에 깨어나는 동안 응답이 느리거나 루트 주소(`/`)가 일시적으로 "Not Found"처럼 보인 적이 있었다. 실제로는 에러가 아니라 정상적인 콜드스타트 지연이었음(3-5 참고). 판단 기준: Render의 "Logs"/"Events" 탭에서 서비스가 `Live` 상태이고 크래시 로그가 없다면, 단순 슬립/깨어남 지연으로 보고 재시도하면 됨.

### 7-4. Vercel 환경변수 UI 위치 변경

최근 Vercel이 UI를 개편해서 "Environment Variables"가 더 이상 사이드바에 독립 메뉴로 있지 않고, **Settings → Environments → (Production 등 환경 선택)** 안에 들어가 있음. 예전 가이드/캡처를 그대로 따라가면 못 찾을 수 있으니, 4-1처럼 "Environments" 메뉴를 통해 들어가야 함.

### 7-5. "Secret" vs "Config" 환경변수 타입

Vercel에 `VITE_API_URL`을 등록할 때 "Secret" 타입으로 저장하려 하면 경고가 뜬다. `VITE_` 접두사가 붙은 값은 Vite 빌드 시 브라우저 번들에 그대로 노출되는 값이라(민감정보 아님), "저장 후 값을 다시 볼 수 없는" Secret 타입과 맞지 않기 때문. **"Config" 타입으로 바꿔서 저장**하면 된다(4-1 참고). 반대로 `OPENAI_API_KEY`처럼 진짜 민감한 값(Render 쪽)은 Secret 성격 그대로 두면 됨.

## 8. 로컬 개발 vs 배포 대응표

| 항목 | 로컬 개발 | 배포(Production) |
|---|---|---|
| 백엔드 실행 | `py -m uvicorn main:app --reload` | Render Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| 프론트엔드 실행 | `npm run dev` | Vercel이 push마다 자동 빌드·배포 |
| API 키 저장 위치 | 로컬 PC의 `.env` 파일(기기마다 직접 생성, git에 없음) | Render 대시보드 Environment Variables |
| 백엔드 주소 지정 | 프론트 기본값 `http://localhost:8000` | Vercel 환경변수 `VITE_API_URL` |
| CORS 허용 대상 | `http://localhost:5173`만 | 위 주소 + 배포된 Vercel 주소(`ALLOWED_ORIGINS`로 확장 가능) |
| 접속 주소 예시 | `http://localhost:5173` / `http://localhost:8000` | `https://capstone-project-pied-seven.vercel.app` / `https://capstone-project-wq1u.onrender.com` |

## 9. 최종 체크리스트

- [ ] 로컬에서 수정한 코드가 실제로 `git status`에서 확인되고, `git push`까지 완료됐는가
- [ ] Render: Root Directory=`backend`, Start Command에 `--host 0.0.0.0 --port $PORT` 포함, `OPENAI_API_KEY` 환경변수 등록, 정확한 배포 주소를 링크 클릭으로 재확인했는가
- [ ] `backend/main.py`의 CORS 허용 목록에 배포된 Vercel 주소가 들어있고, 그 변경사항이 git push까지 반영됐는가
- [ ] Vercel: `VITE_API_URL`이 Render의 정확한 주소로 설정되고(Config 타입), Redeploy까지 완료됐는가
- [ ] 로컬 명령어 없이 Vercel 주소 접속 → 로그인 → 채팅 메시지 전송 → GPT 응답까지 정상 확인했는가
