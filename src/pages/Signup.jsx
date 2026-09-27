// import { useState } from 'react'
// import { Link, useNavigate } from 'react-router-dom'
// import { User, Envelope, LockKey } from '@phosphor-icons/react'
// import Header from '../components/Header.jsx'
// import Footer from '../components/Footer.jsx'
// import { useAuth } from '../context/AuthContext.jsx'

// const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// export default function Signup() {
//   const navigate = useNavigate()
//   const { login } = useAuth()
//   const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' })
//   const [agreed, setAgreed] = useState(false)
//   const [errors, setErrors] = useState({})
//   const [submitting, setSubmitting] = useState(false)

//   function handleChange(field) {
//     return (event) => {
//       const { value } = event.target
//       setForm((prev) => ({ ...prev, [field]: value }))
//       setErrors((prev) => ({ ...prev, [field]: undefined }))
//     }
//   }

//   function validate() {
//     const next = {}
//     if (!form.name.trim()) next.name = '이름을 입력해주세요.'

//     if (!form.email.trim()) next.email = '이메일을 입력해주세요.'
//     else if (!EMAIL_PATTERN.test(form.email)) next.email = '올바른 이메일 형식이 아니에요.'

//     if (!form.password) next.password = '비밀번호를 입력해주세요.'
//     else if (form.password.length < 8) next.password = '비밀번호는 8자 이상이어야 해요.'

//     if (!form.passwordConfirm) next.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
//     else if (form.passwordConfirm !== form.password) next.passwordConfirm = '비밀번호가 일치하지 않아요.'

//     if (!agreed) next.agreed = '이용약관 및 개인정보처리방침에 동의해주세요.'

//     return next
//   }

//   function handleSubmit(event) {
//     event.preventDefault()
//     const nextErrors = validate()
//     setErrors(nextErrors)
//     if (Object.keys(nextErrors).length > 0) return

//     // TODO: FastAPI 회원가입 API 연동 전 임시 처리 — 입력 형식만 검증되면 가입 성공으로 간주
//     setSubmitting(true)
//     login({ email: form.email, name: form.name })
//     navigate('/home', { replace: true })
//   }

//   return (
//     <div className="min-h-dvh bg-canvas">
//       <Header />

//       {/* 랜딩과 동일한 Header/Footer 사이에 회원가입 섹션을 배치 — 별도 화면처럼 붕 뜨지 않고
//           사이트 전체 내비게이션(이용가이드, 로그인 버튼 등)을 그대로 유지한 채 이동 */}
//       <main className="mx-auto flex max-w-content justify-center px-4 py-16 sm:px-6 sm:py-24">
//         <div className="w-full max-w-[420px] rounded-card bg-white p-8 shadow-2 sm:p-10">
//           <p className="eyebrow-label justify-center">
//             <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
//             회원가입
//           </p>
//           <h1 className="mt-4 text-center text-h3 text-ink">마음잇기와 첫 대화를 시작해요</h1>
//           <p className="mt-3 text-center text-body text-slate">
//             간단한 정보만 입력하면 바로 시작할 수 있어요.
//           </p>

//           <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
//             <div>
//               <label htmlFor="signup-name" className="mb-1.5 block text-[14px] font-semibold text-ink">
//                 이름
//               </label>
//               <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
//                 <User size={18} className="shrink-0 text-slate" aria-hidden="true" />
//                 <input
//                   id="signup-name"
//                   type="text"
//                   autoComplete="name"
//                   placeholder="홍길동"
//                   className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
//                   value={form.name}
//                   onChange={handleChange('name')}
//                   aria-invalid={!!errors.name}
//                   aria-describedby={errors.name ? 'signup-name-error' : undefined}
//                 />
//               </div>
//               {errors.name && (
//                 <p id="signup-name-error" className="mt-1.5 text-[13px] text-coral-deep">
//                   {errors.name}
//                 </p>
//               )}
//             </div>

//             <div>
//               <label htmlFor="signup-email" className="mb-1.5 block text-[14px] font-semibold text-ink">
//                 이메일
//               </label>
//               <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
//                 <Envelope size={18} className="shrink-0 text-slate" aria-hidden="true" />
//                 <input
//                   id="signup-email"
//                   type="email"
//                   autoComplete="email"
//                   placeholder="you@example.com"
//                   className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
//                   value={form.email}
//                   onChange={handleChange('email')}
//                   aria-invalid={!!errors.email}
//                   aria-describedby={errors.email ? 'signup-email-error' : undefined}
//                 />
//               </div>
//               {errors.email && (
//                 <p id="signup-email-error" className="mt-1.5 text-[13px] text-coral-deep">
//                   {errors.email}
//                 </p>
//               )}
//             </div>

//             <div>
//               <label htmlFor="signup-password" className="mb-1.5 block text-[14px] font-semibold text-ink">
//                 비밀번호
//               </label>
//               <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
//                 <LockKey size={18} className="shrink-0 text-slate" aria-hidden="true" />
//                 <input
//                   id="signup-password"
//                   type="password"
//                   autoComplete="new-password"
//                   placeholder="8자 이상 입력해주세요"
//                   className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
//                   value={form.password}
//                   onChange={handleChange('password')}
//                   aria-invalid={!!errors.password}
//                   aria-describedby={errors.password ? 'signup-password-error' : undefined}
//                 />
//               </div>
//               {errors.password && (
//                 <p id="signup-password-error" className="mt-1.5 text-[13px] text-coral-deep">
//                   {errors.password}
//                 </p>
//               )}
//             </div>

//             <div>
//               <label htmlFor="signup-password-confirm" className="mb-1.5 block text-[14px] font-semibold text-ink">
//                 비밀번호 확인
//               </label>
//               <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
//                 <LockKey size={18} className="shrink-0 text-slate" aria-hidden="true" />
//                 <input
//                   id="signup-password-confirm"
//                   type="password"
//                   autoComplete="new-password"
//                   placeholder="비밀번호를 다시 입력해주세요"
//                   className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
//                   value={form.passwordConfirm}
//                   onChange={handleChange('passwordConfirm')}
//                   aria-invalid={!!errors.passwordConfirm}
//                   aria-describedby={errors.passwordConfirm ? 'signup-password-confirm-error' : undefined}
//                 />
//               </div>
//               {errors.passwordConfirm && (
//                 <p id="signup-password-confirm-error" className="mt-1.5 text-[13px] text-coral-deep">
//                   {errors.passwordConfirm}
//                 </p>
//               )}
//             </div>

//             <div>
//               <label className="flex items-start gap-2 text-[13px] text-slate">
//                 <input
//                   type="checkbox"
//                   className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-coral focus:ring-coral"
//                   checked={agreed}
//                   onChange={(event) => {
//                     setAgreed(event.target.checked)
//                     setErrors((prev) => ({ ...prev, agreed: undefined }))
//                   }}
//                   aria-invalid={!!errors.agreed}
//                   aria-describedby={errors.agreed ? 'signup-agreed-error' : undefined}
//                 />
//                 <span>
//                   <Link to="#" className="font-semibold text-ink hover:underline">
//                     이용약관
//                   </Link>{' '}
//                   및{' '}
//                   <Link to="#" className="font-semibold text-ink hover:underline">
//                     개인정보처리방침
//                   </Link>
//                   에 동의합니다.
//                 </span>
//               </label>
//               {errors.agreed && (
//                 <p id="signup-agreed-error" className="mt-1.5 text-[13px] text-coral-deep">
//                   {errors.agreed}
//                 </p>
//               )}
//             </div>

//             <button type="submit" className="btn-accent w-full" disabled={submitting}>
//               {submitting ? '가입 중...' : '회원가입'}
//             </button>
//           </form>

//           <p className="mt-6 text-center text-[14px] text-slate">
//             이미 계정이 있으신가요?{' '}
//             <Link to="/login" className="font-semibold text-coral hover:underline">
//               로그인
//             </Link>
//           </p>
//         </div>
//       </main>

//       <Footer />
//     </div>
//   )
// }

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Envelope, LockKey } from '@phosphor-icons/react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// [추가] 백엔드 주소 — chatApi.js와 같은 방식 (배포: Vercel의 VITE_API_URL / 로컬: 8000번)
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

// [추가] FastAPI 에러 응답(detail)을 사람이 읽을 문장으로 변환
function toErrorMessage(detail) {
  if (!detail) return '회원가입에 실패했어요. 잠시 후 다시 시도해주세요.'
  if (typeof detail === 'string') {
    if (detail.includes('already registered')) return '이미 가입된 이메일이에요.'
    if (detail.includes('rate limit')) return '요청이 너무 많아요. 잠시 후 다시 시도해주세요.'
    return detail
  }
  if (Array.isArray(detail)) return '입력값 형식이 올바르지 않아요.' // 422 검증 에러
  return '회원가입에 실패했어요.'
}

export default function Signup() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('') // [추가] 서버에서 온 에러 표시용

  function handleChange(field) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
      setServerError('')
    }
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = '이름을 입력해주세요.'

    if (!form.email.trim()) next.email = '이메일을 입력해주세요.'
    else if (!EMAIL_PATTERN.test(form.email)) next.email = '올바른 이메일 형식이 아니에요.'

    if (!form.password) next.password = '비밀번호를 입력해주세요.'
    else if (form.password.length < 8) next.password = '비밀번호는 8자 이상이어야 해요.'

    if (!form.passwordConfirm) next.passwordConfirm = '비밀번호를 한 번 더 입력해주세요.'
    else if (form.passwordConfirm !== form.password) next.passwordConfirm = '비밀번호가 일치하지 않아요.'

    if (!agreed) next.agreed = '이용약관 및 개인정보처리방침에 동의해주세요.'

    return next
  }

  // [변경] 임시 처리 → 실제 백엔드(/auth/register, /auth/login) 호출
  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    setServerError('')

    try {
      // 1) 회원가입 — main.py의 RegisterRequest 필드 이름과 맞춰서 전송
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          password_confirm: form.passwordConfirm,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(toErrorMessage(data.detail))
        return
      }

      // 2) 가입 직후 자동 로그인 시도
      //    Supabase 이메일 인증이 켜져 있으면 인증 전이라 실패 → 로그인 페이지로 안내
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      })
      const loginData = await loginRes.json().catch(() => ({}))

      if (loginRes.ok && loginData.success) {
        login({
          id: loginData.user.id,
          email: loginData.user.email,
          name: loginData.user.name,
          accessToken: loginData.session.access_token, // 채팅/마이페이지 호출 시 사용
          refreshToken: loginData.session.refresh_token, // 1시간마다 토큰 자동 갱신용
        })
        navigate('/home', { replace: true })
      } else {
        alert('회원가입이 완료됐어요! 이메일 인증 후 로그인해주세요.')
        navigate('/login', { replace: true })
      }
    } catch {
      // 네트워크 오류 / CORS 차단 / Render 슬립 중
      setServerError('서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      {/* 랜딩과 동일한 Header/Footer 사이에 회원가입 섹션을 배치 — 별도 화면처럼 붕 뜨지 않고
          사이트 전체 내비게이션(이용가이드, 로그인 버튼 등)을 그대로 유지한 채 이동 */}
      <main className="mx-auto flex max-w-content justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="w-full max-w-[420px] rounded-card bg-white p-8 shadow-2 sm:p-10">
          <p className="eyebrow-label justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            회원가입
          </p>
          <h1 className="mt-4 text-center text-h3 text-ink">마음잇기와 첫 대화를 시작해요</h1>
          <p className="mt-3 text-center text-body text-slate">
            간단한 정보만 입력하면 바로 시작할 수 있어요.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="signup-name" className="mb-1.5 block text-[14px] font-semibold text-ink">
                이름
              </label>
              <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
                <User size={18} className="shrink-0 text-slate" aria-hidden="true" />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="홍길동"
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
                  value={form.name}
                  onChange={handleChange('name')}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'signup-name-error' : undefined}
                />
              </div>
              {errors.name && (
                <p id="signup-name-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-[14px] font-semibold text-ink">
                이메일
              </label>
              <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
                <Envelope size={18} className="shrink-0 text-slate" aria-hidden="true" />
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
                  value={form.email}
                  onChange={handleChange('email')}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'signup-email-error' : undefined}
                />
              </div>
              {errors.email && (
                <p id="signup-email-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-[14px] font-semibold text-ink">
                비밀번호
              </label>
              <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
                <LockKey size={18} className="shrink-0 text-slate" aria-hidden="true" />
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8자 이상 입력해주세요"
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
                  value={form.password}
                  onChange={handleChange('password')}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'signup-password-error' : undefined}
                />
              </div>
              {errors.password && (
                <p id="signup-password-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="signup-password-confirm" className="mb-1.5 block text-[14px] font-semibold text-ink">
                비밀번호 확인
              </label>
              <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
                <LockKey size={18} className="shrink-0 text-slate" aria-hidden="true" />
                <input
                  id="signup-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="비밀번호를 다시 입력해주세요"
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
                  value={form.passwordConfirm}
                  onChange={handleChange('passwordConfirm')}
                  aria-invalid={!!errors.passwordConfirm}
                  aria-describedby={errors.passwordConfirm ? 'signup-password-confirm-error' : undefined}
                />
              </div>
              {errors.passwordConfirm && (
                <p id="signup-password-confirm-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.passwordConfirm}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-2 text-[13px] text-slate">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/30 text-coral focus:ring-coral"
                  checked={agreed}
                  onChange={(event) => {
                    setAgreed(event.target.checked)
                    setErrors((prev) => ({ ...prev, agreed: undefined }))
                  }}
                  aria-invalid={!!errors.agreed}
                  aria-describedby={errors.agreed ? 'signup-agreed-error' : undefined}
                />
                <span>
                  <Link to="#" className="font-semibold text-ink hover:underline">
                    이용약관
                  </Link>{' '}
                  및{' '}
                  <Link to="#" className="font-semibold text-ink hover:underline">
                    개인정보처리방침
                  </Link>
                  에 동의합니다.
                </span>
              </label>
              {errors.agreed && (
                <p id="signup-agreed-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.agreed}
                </p>
              )}
            </div>

            {/* [추가] 서버 에러 메시지 */}
            {serverError && (
              <p role="alert" className="text-center text-[13px] text-coral-deep">
                {serverError}
              </p>
            )}

            <button type="submit" className="btn-accent w-full" disabled={submitting}>
              {submitting ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="mt-6 text-center text-[14px] text-slate">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-semibold text-coral hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
