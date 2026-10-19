import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

// 비로그인 상태에서도 접근 가능한 정적 페이지(공지사항/이용가이드/FAQ) 공통 레이아웃.
// 로그인 후 전용 레이아웃(AppLayout)과 달리 인증 가드가 없고, 랜딩 페이지와 동일한
// Header/Footer를 그대로 사용 — Header는 내부에서 로그인 여부에 따라 메뉴만 스스로 바뀜.
export default function PublicPageLayout({ children }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <Header />
      <main className="mx-auto max-w-content px-4 py-8 sm:px-6">{children}</main>
      <Footer />
    </div>
  )
}
