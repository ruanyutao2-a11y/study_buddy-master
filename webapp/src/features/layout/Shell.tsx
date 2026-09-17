import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../store/appContext'
import { BRAND } from '../../lib/brand'

const NAV = [
  { to: '/', label: '首页', ico: '🏠' },
  { to: '/knowledge', label: '知识库', ico: '📚' },
  { to: '/review', label: '复习', ico: '🎯' },
  { to: '/chat', label: '问答', ico: '💬' },
  { to: '/focus', label: '专注', ico: '⏱' },
  { to: '/report', label: '日报', ico: '📊' },
  { to: '/settings', label: '设置', ico: '⚙️' },
]

export function Shell() {
  const { account, accounts, logout, switchAccount } = useApp()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  const handleSwitch = async (id: string) => {
    await switchAccount(id)
    closeMenu()
    navigate('/')
  }

  const handleLogout = () => {
    logout()
    closeMenu()
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand" onClick={() => navigate('/')}>
            <div className="brand-seal">时</div>
            <div className="brand-name">{BRAND.name}</div>
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="ico">{n.ico}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-right">
            <button className="user-chip" onClick={() => setMenuOpen((v) => !v)}>
              <span className="avatar">{account?.displayName?.slice(0, 1) || '时'}</span>
              <span>{account?.displayName}</span>
              <span className="faint">▾</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={closeMenu} />
            <div className="header-menu">
              <div className="menu-label">切换账号</div>
              {accounts.map((a) => (
                <button
                  key={a.id}
                  className={`menu-item${a.id === account?.id ? ' active' : ''}`}
                  onClick={() => void handleSwitch(a.id)}
                >
                  <span className="avatar">{a.displayName.slice(0, 1)}</span>
                  <span className="menu-item-name">{a.displayName}</span>
                  {a.id === account?.id && <span className="muted">✓</span>}
                </button>
              ))}
              <div className="menu-divider" />
              <button className="menu-item" onClick={() => { closeMenu(); navigate('/settings') }}>
                <span>⚙️</span>
                <span className="menu-item-name">设置</span>
              </button>
              <button className="menu-item danger" onClick={handleLogout}>
                <span>⎋</span>
                <span className="menu-item-name">退出登录</span>
              </button>
            </div>
          </>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <div className="bn-inner">
          {NAV.slice(0, 6).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}
            >
              <span className="ico">{n.ico}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
