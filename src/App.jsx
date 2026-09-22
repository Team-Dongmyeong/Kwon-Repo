import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AppLayout from './pages/app/AppLayout.jsx'
import Home from './pages/app/Home.jsx'
import Chat from './pages/app/Chat.jsx'
import Jobs from './pages/app/Jobs.jsx'
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

      <Route path="/home" element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="chat" element={<Chat />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="notice" element={<Notice />} />
        <Route path="guide" element={<Guide />} />
        <Route path="faq" element={<Faq />} />
        <Route path="mypage" element={<MyPage />} />
      </Route>
    </Routes>
  )
}
