import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './store/appContext'
import { AuthPage } from './features/auth/AuthPage'
import { Shell } from './features/layout/Shell'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { KnowledgePage } from './features/knowledge/KnowledgePage'
import { ReviewPage } from './features/review/ReviewPage'
import { ChatPage } from './features/chat/ChatPage'
import { FocusPage } from './features/focus/FocusPage'
import { ReportPage } from './features/report/ReportPage'
import { SettingsPage } from './features/settings/SettingsPage'

export default function App() {
  const { account, booting } = useApp()

  if (booting) {
    return (
      <div className="boot">
        <div className="boot-seal">时</div>
        <div className="boot-text">时习 · 加载中…</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={account ? <Navigate to="/" replace /> : <AuthPage />}
        />
        {account ? (
          <Route element={<Shell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/focus" element={<FocusPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" replace />} />
        )}
      </Routes>
    </HashRouter>
  )
}
