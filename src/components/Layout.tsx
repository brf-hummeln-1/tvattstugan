import { NavLink, Outlet } from 'react-router-dom'
import { CalendarIcon, ChatIcon, InfoIcon, MoreIcon, WasherIcon } from './icons'

const tabs = [
  { to: '/', label: 'Boka', Icon: CalendarIcon },
  { to: '/min-bokning', label: 'Min tid', Icon: WasherIcon },
  { to: '/chatt', label: 'Chatt', Icon: ChatIcon },
  { to: '/info', label: 'Info', Icon: InfoIcon },
  { to: '/mer', label: 'Mer', Icon: MoreIcon },
]

export function Layout() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))]">
        <Outlet />
      </main>
      {/* Flytande glasflikrad */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ul className="glass pointer-events-auto flex w-full max-w-md rounded-full px-1 py-1">
          {tabs.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `pressable flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium ${
                    isActive ? 'text-ios-tint' : 'text-ios-label-2'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon filled={isActive} className={isActive ? 'h-7 w-7' : 'h-7 w-7'} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
