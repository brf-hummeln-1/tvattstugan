import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: 'Boka', icon: '📅' },
  { to: '/min-bokning', label: 'Min tid', icon: '🧺' },
  { to: '/chatt', label: 'Chatt', icon: '💬' },
  { to: '/info', label: 'Info', icon: 'ℹ️' },
  { to: '/mer', label: 'Mer', icon: '⚙️' },
]

export function Layout() {
  const { resident } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="flex">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-medium ${
                    isActive ? 'text-sky-700' : 'text-slate-500'
                  }`
                }
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
                {tab.to === '/mer' && resident?.is_admin && <span className="sr-only"> (admin)</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
