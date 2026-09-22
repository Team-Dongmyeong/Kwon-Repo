# 마음잇기 — PROJECT_STATE

> 최종 갱신: 2026-09-20 · 저장소: `C:\Git\capstone_project`
> 새 대화를 열 때는 이 파일부터 읽고 시작할 것. 대화 로그 옮겨적기 금지 — 항상 압축된 최신 상태만 유지.

## 1. 현재 아키텍처

- 프론트엔드(React 18 + Vite 5 + react-router-dom 6, 아이콘은 `@phosphor-icons/react`) + **백엔드(FastAPI) + GPT-4o mini 연동까지 완료되어 실배포 상태**. Supabase+pgvector 기반 RAG는 아직 미착수 — 다음 단계.
- 스타일링: Tailwind 3. `tailwind.config.js`의 `canvas`(배경)는 완전 화이트(`#FFFFFF`), `canvas-lift`는 `#F6F6F5`. `ink`(#141413)/`coral`(#CF4500 계열)/`bone`/`slate`/`taupe`/`link` 토큰 유지. 공통 클래스는 `src/index.css`에 `.btn-primary`/`.btn-secondary`/`.btn-accent`/`.eyebrow-label` + `.animate-fade-up` 유틸리티.
- 라우팅(`src/App.jsx`): `/`(Landing), `/login`, `/signup`, `/home/*`(로그인 후 영역, `AppLayout` 하위 중첩 라우트: `index`=Home, `chat`, `jobs`, `notice`, `guide`, `faq`, `mypage`).
- 인증: 백엔드 인증 API가 아직 없어 `src/context/AuthContext.jsx`의 모의(mock) 인증으로 대체(`login({email,name})` → localStorage `maeum:auth-user`). `AppLayout`이 `isAuthenticated=false`면 `/login`으로 리다이렉트.
- **백엔드(`backend/`)**: FastAPI + OpenAI `gpt-4o-mini`. `main.py`에 `/chat`(POST, 세션 기반 대화)과 `/`(GET, 헬스체크) 엔드포인트. `session_id` 기준으로 세션별 대화 히스토리를 메모리(`session_store: Dict[str, List[dict]]`)에 유지 — **서버 재시작하면 사라지는 임시 구조**(Supabase 연동 전까지). 시스템 프롬프트는 `backend/prompts.py`의 `SYSTEM_PROMPT`(마음잇기 상담사 페르소나).
- **프론트-백엔드 연결**: `src/lib/chatApi.js`가 `VITE_API_URL` 환경변수(없으면 로컬 `http://localhost:8000`)로 `/chat`에 POST 요청. `Chat.jsx`가 세션 여러 개(Claude/Gemini 스타일)를 좌측 목록으로 관리하고 localStorage(`maeum:chat-sessions`)에 저장 — **Supabase 연동 전까지 임시로 브라우저 로컬에만 저장**, 다른 기기/브라우저와 공유 안 됨.
- **배포**: 프론트엔드는 Vercel(`https://capstone-project-pied-seven.vercel.app`), 백엔드는 Render 무료 플랜(`https://capstone-project-wq1u.onrender.com`)에 배포 완료. CORS는 `backend/main.py`에 로컬 주소 + Vercel 프로덕션 주소를 기본 허용 목록으로 넣고, `ALLOWED_ORIGINS` 환경변수로 추가 origin을 코드 수정 없이 확장할 수 있게 구성. Render 무료 플랜 특성상 **15분 미사용 시 서버가 슬립 → 재요청 시 30~50초 지연**은 정상 동작(에러 아님).
- **환경변수 관리**: 로컬 개발은 각자 PC에 `.env`를 직접 생성(git에 커밋 안 됨 — `.gitignore` 처리, 기기 옮길 때마다 재생성 필요). 배포 환경은 Render 대시보드(백엔드, `OPENAI_API_KEY`)와 Vercel 대시보드(프론트, `VITE_API_URL`)의 Environment Variables에 각각 등록.
- **헤더 구조**: 로그인 전용 `Header.jsx`와 로그인 후 전용 `AppHeader.jsx`를 하나의 `Header.jsx`로 통합(`useAuth().isAuthenticated`로 전체 분기), `AppHeader.jsx`는 삭제됨. 로그인 후 페이지는 Footer 미노출.
- **헤더 레이아웃**: 한 줄 압축(`flex flex-wrap`) — 로고 → 메인 메뉴 → (로그인 전만) 유틸 링크 → 로그인/로그아웃. 로그인 전 메뉴는 Phosphor `duotone` 아이콘, 로그인 후 메뉴(7개)는 아이콘 없이 텍스트만. 선택 항목은 `bg-coral text-white` 필 배경.
- **신규 로그인 후 페이지**: `Home.jsx`(히어로 + 4칸 바로가기 카드), `Notice.jsx`, `Guide.jsx`, `Faq.jsx`(아코디언) — 팀원 목업 참고해 coral/ink/white 톤으로 재구성.
- **MyPage.jsx**: 탭 순서 개인정보 → 감정상태 → 채팅로그 → 추천직업(개인정보가 기본 진입). 감정상태 탭은 외부 라이브러리 없이 순수 SVG `EmotionRadar`/`TrendChart` 커스텀 컴포넌트.
- **아이콘 방향성**: 로그인 전=아이콘 있음(Phosphor duotone), 로그인 후=아이콘 없음(텍스트만)으로 확정. 연파란색(periwinkle) 후보 아이콘 세트는 미채택.
- 참고 문서: 저장소 루트 `getdesign.md`, itdaa.net, 팀원 목업(`main.html`/`style.css`/`script.js` — 수현, `mypage.html` — 병철), Project Knowledge의 `구성도.png`, 결과보고서 PDF들, `마음잇기_개발_로드맵.md`.

## 2. 완료된 작업

- Landing 페이지 전체 섹션 조립, `HomeBanner.jsx` 캐러셀(트랙 translateX, 5초 자동전환+hover 정지, 화살표/점 인디케이터).
- `Login.jsx` / `Signup.jsx` 실제 폼 구현.
- 헤더 통합 + 단일 행 압축 + Footer 로그인 후 제거, 배경 화이트 전환(`canvas: #FFFFFF`).
- 로그인 후 메뉴 확장: 홈/공지사항/이용가이드/FAQ 4개 신규 페이지 + 라우트.
- `MyPage.jsx` 대폭 확장(4탭 구조, 개인정보 3카드 레이아웃).
- 아이콘 방향 확정 및 연파란색 후보 아이콘 세트 미채택 결정.
- **`Chat.jsx` 실제 채팅 UI 구현 및 백엔드 연동 완료**(기존엔 안내 문구만 있는 자리표시자였음) — 세션 사이드바(열기/닫기, "오늘"/"지난 대화" 그룹핑), 화이트/coral 톤 말풍선, 세션별 독립 대화 컨텍스트, Enter 전송/Shift+Enter 줄바꿈, 전송 중 로딩 표시("생각하는 중…"), 백엔드 연결 실패 시 안내 문구.
- **대화 세션 삭제 기능**: 사이드바 항목에 마우스 hover 시 X 버튼 노출 → 클릭 시 해당 세션만 삭제, 활성 세션 삭제 시 남은 세션 중 최신 것으로 자동 전환.
- **신규 유저 빈 상태 처리**: 저장된 세션이 없는 완전 신규 방문자는 빈 "새 대화"를 미리 만들어두지 않고 목록을 비워둔 채 시작 — "새 대화 시작하기" 클릭 또는 첫 메시지 전송 시점에만 세션 생성, 이미 빈 세션이 있으면 중복 생성하지 않음.
- **FastAPI 백엔드 스켈레톤 + GPT-4o mini 연동 완료**: `/chat`(세션별 히스토리 유지) · `/`(헬스체크) 엔드포인트, CORS 미들웨어 구성.
- **배포 완료**: 프론트엔드 Vercel, 백엔드 Render(무료 플랜) — 로컬 명령어(`npm run dev`/`uvicorn`) 없이 실제 배포 주소만으로 프론트→백엔드→GPT-4o mini 전체 채팅 파이프라인 동작 확인 완료.

## 3. 주요 결정 사항

- 캐러셀은 외부 라이브러리 대신 직접 구현.
- 이미지 자산은 1200px 폭 WebP 통일.
- 상태관리는 Context API(`AuthContext`)로 시작 — 실제 인증 백엔드 붙기 전까지 localStorage 기반 모의 로그인.
- 로그인/회원가입은 서버 검증 없이 "형식만 맞으면 통과"하는 모의 처리.
- 배경색 순수 화이트 전환, 나머지 컬러링(coral/ink)은 유지.
- 로그인 전/후 헤더 통합, Footer는 로그인 후 완전 제거.
- 헤더 1줄 압축, 로그인 후 메뉴는 텍스트만 사용.
- 연파란색 후보 아이콘 세트 미채택, Phosphor `duotone` 유지(로그인 전 메뉴만).
- **채팅은 하나의 연속 스레드가 아니라 세션 여러 개(Claude/Gemini 스타일)로 관리** — 사용자가 주제별로 대화를 분리해서 시작할 수 있게 하고, 장기적으로는 세션마다 감정/키워드 분석 결과를 따로 누적해 추천에 반영하는 것이 목표(현재는 감정/키워드 분석이 아직 연결 안 됨 — kcELECTRA/SBERT 서빙 붙는 다음 단계 몫).
- 세션/메시지 데이터는 Supabase 연동 전까지 **localStorage에만 저장**하기로 결정 — 새로고침엔 유지되지만 기기/브라우저 간 공유는 안 되는 임시 구조.
- 백엔드 배포는 무료 플랜(Render)으로 우선 진행 — 콜드스타트 지연(30~50초)은 감안, 필요 시 유료 전환은 추후 논의.
- CORS 허용 origin은 코드 하드코딩 + `ALLOWED_ORIGINS` 환경변수 조합으로 구성 — 배포 주소가 늘어나도 코드 수정 없이 대응 가능하도록.

## 4. 다음 작업 (Todo)

- [ ] **Supabase 연동**: 병철이 이미 구축한 로그인용 Supabase 프로젝트에 팀원으로 초대받아, `conversations`/`messages` 테이블을 추가하고 채팅 세션·메시지를 localStorage 대신 DB에 영구 저장하도록 교체 (경민 담당, 다음 우선순위 — 별도 계정으로 새 프로젝트 만들지 않고 기존 프로젝트에 합류하는 것으로 결정)
- [ ] kcELECTRA(감정 분류)/SBERT(키워드 분류) 서빙 엔드포인트(`/analyze` 등)를 백엔드에 붙여서, 세션별 감정/키워드 태그를 채팅 UI에 반영하고 맞춤 채용정보 추천에 연결
- [ ] RAG(Supabase+pgvector) 파이프라인 실제 구현 — 아직 미착수
- [ ] `Jobs.jsx`에 채용공고 리스트/카드 UI 붙이기 — 현재는 안내 문구만 있는 자리표시자.
- [ ] `Notice.jsx`/`Guide.jsx`/`Faq.jsx`는 더미 콘텐츠 상태 — 실제 콘텐츠로 교체 필요.
- [ ] `MyPage.jsx` 개인정보 탭의 "내 정보" 카드와 편집 폼을 실제 사용자 데이터/API에 연결 — 현재는 컴포넌트 로컬 state(더미).
- [ ] 실제 인증 API 연동 시 `AuthContext.jsx`의 `login`/`logout`을 서버 호출로 교체하고, 토큰 저장 방식(httpOnly 쿠키 등) 재검토.
- [ ] `.btn-accent`(coral CTA)를 로그인/회원가입 외 다른 곳까지 확대 적용할지 결정.
- [ ] 미사용 파일 정리(로컬에서 수동 삭제 필요): `src/components/ThemeToggle.jsx`, `src/hooks/useDarkMode.js`, `src/components/Hero.jsx`, `src/components/HomeBanner-1.jsx`, `src/assets/banner-chat.jpg`, `src/assets/banner-chat-dark.webp`, `src/hooks/useInView.js`.
- [ ] `README.md` 파일 트리 최신화 (Home/Notice/Guide/Faq, 통합 Header, backend 폴더 등 반영 안 됨).
- [ ] 연파란색 후보 아이콘 세트를 다시 쓰려면 색상 재작업(coral/ink 톤) 선행 필요 — 현재는 이미지 파일이라 코드에서 직접 재색상 불가.
