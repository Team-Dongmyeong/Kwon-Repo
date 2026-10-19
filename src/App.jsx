import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import PublicPageLayout from './pages/PublicPageLayout.jsx'
import AppLayout from './pages/app/AppLayout.jsx'
import Home from './pages/app/Home.jsx'
import Chat from './pages/app/Chat.jsx'
import Jobs from './pages/app/Jobs.jsx'
import Policies from './pages/app/Policies.jsx'   // ← 추가
import Notice from './pages/app/Notice.jsx'
import Guide from './pages/app/Guide.jsx'
import Faq from './pages/app/Faq.jsx'
import MyPage from './pages/app/MyPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* 비로그인 상태에서도 접근 가능한 공지사항/이용가이드/FAQ — 로그인 후에는
          /home/notice 등 AppLayout 쪽 경로를 그대로 사용하고, 이 경로들은
          상단 바에서 로그아웃 상태일 때만 연결됨. */}
      <Route path="/notice" element={<PublicPageLayout><Notice /></PublicPageLayout>} />
      <Route path="/guide" element={<PublicPageLayout><Guide /></PublicPageLayout>} />
      <Route path="/faq" element={<PublicPageLayout><Faq /></PublicPageLayout>} />

      <Route path="/home" element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="chat" element={<Chat />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="policies" element={<Policies />} />   {/* ← 추가 */}
        <Route path="notice" element={<Notice />} />
        <Route path="guide" element={<Guide />} />
        <Route path="faq" element={<Faq />} />
        <Route path="mypage" element={<MyPage />} />
      </Route>
    </Routes>
  )
}
