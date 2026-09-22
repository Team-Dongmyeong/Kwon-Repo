import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Envelope, LockKey } from '@phosphor-icons/react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(field) {
    return (event) => {
      const { value } = event.target
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function validate() {
    const next = {}
    if (!form.email.trim()) next.email = '이메일을 입력해주세요.'
    else if (!EMAIL_PATTERN.test(form.email)) next.email = '올바른 이메일 형식이 아니에요.'

    if (!form.password) next.password = '비밀번호를 입력해주세요.'
    else if (form.password.length < 8) next.password = '비밀번호는 8자 이상이어야 해요.'

    return next
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    // TODO: FastAPI 인증 API 연동 전 임시 처리 — 입력 형식만 검증되면 로그인 성공으로 간주
    setSubmitting(true)
    login({ email: form.email })
    navigate('/home', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <Header />

      {/* 랜딩과 동일한 Header/Footer 사이에 로그인 섹션을 배치 — 별도 화면처럼 붕 뜨지 않고
          사이트 전체 내비게이션(이용가이드, 로그인 버튼 등)을 그대로 유지한 채 이동 */}
      <main className="mx-auto flex max-w-content justify-center px-4 py-16 sm:px-6 sm:py-24">
        <div className="w-full max-w-[420px] rounded-card bg-white p-8 shadow-2 sm:p-10">
          <p className="eyebrow-label justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            로그인
          </p>
          <h1 className="mt-4 text-center text-h3 text-ink">다시 만나서 반가워요</h1>
          <p className="mt-3 text-center text-body text-slate">
            마음잇기 계정으로 로그인하고 대화를 이어가세요.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-[14px] font-semibold text-ink">
                이메일
              </label>
              <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
                <Envelope size={18} className="shrink-0 text-slate" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
                  value={form.email}
                  onChange={handleChange('email')}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                />
              </div>
              {errors.email && (
                <p id="login-email-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-[14px] font-semibold text-ink">
                비밀번호
              </label>
              <div className="flex items-center gap-2 rounded-btn border border-ink/15 bg-canvas px-4 py-2.5 focus-within:border-coral">
                <LockKey size={18} className="shrink-0 text-slate" aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="8자 이상 입력해주세요"
                  className="w-full bg-transparent text-[15px] text-ink placeholder:text-taupe focus:outline-none"
                  value={form.password}
                  onChange={handleChange('password')}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
              </div>
              {errors.password && (
                <p id="login-password-error" className="mt-1.5 text-[13px] text-coral-deep">
                  {errors.password}
                </p>
              )}
            </div>

            <button type="submit" className="btn-accent w-full" disabled={submitting}>
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-6 text-center text-[14px] text-slate">
            아직 계정이 없으신가요?{' '}
            <Link to="/signup" className="font-semibold text-coral hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
