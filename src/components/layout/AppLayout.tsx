import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/scan', label: 'Scanner' },
  { to: '/personnel', label: 'Personnel' },
  { to: '/rapports', label: 'Rapports' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-noir text-white flex">
      <aside className="w-64 shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-6 py-5 border-b border-white/10">
          <span className="text-xl font-semibold tracking-tight">
            Percepta <span className="text-or">ID</span>
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-or/10 text-or font-medium'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-sm text-gray-300 hover:border-or hover:text-or transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
