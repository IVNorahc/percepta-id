import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useAlerts } from '../../lib/alerts'
import { useSettings } from '../../lib/settings'

const ADMIN_EMAIL = 'muhammadsamb@gmail.com'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tableau de bord' },
  { to: '/scan', label: 'Scanner' },
  { to: '/personnel', label: 'Personnel' },
  { to: '/rapports', label: 'Rapports' },
  { to: '/alertes', label: 'Alertes' },
  { to: '/parametres', label: 'Paramètres' },
]

function NavLinks({
  onClose,
  alertCount,
  isAdmin,
}: {
  onClose?: () => void
  alertCount: number
  isAdmin: boolean
}) {
  const items = isAdmin ? [...NAV_ITEMS, { to: '/admin', label: 'Admin' }] : NAV_ITEMS
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-accent/10 text-accent font-medium'
                : item.to === '/admin'
                  ? 'text-accent/70 hover:bg-accent/5 hover:text-accent'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <span>{item.label}</span>
          {item.to === '/alertes' && alertCount > 0 && (
            <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white leading-none">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </NavLink>
      ))}
    </>
  )
}

function Brand({ logoUrl, name, sizeCls }: { logoUrl: string | null; name: string; sizeCls: string }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      {logoUrl && (
        <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
      )}
      <span className={`${sizeCls} font-display font-bold tracking-tight truncate`}>{name}</span>
    </span>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { alerts } = useAlerts()
  const { settings } = useSettings()
  const alertCount = alerts.filter((a) => !a.isAcked).length
  const isAdmin = user?.email === ADMIN_EMAIL

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-nuit text-white flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-white/10 flex-col bg-ardoise">
        <div className="px-6 py-5 border-b border-white/10">
          <Brand logoUrl={settings.logoUrl} name={settings.companyName} sizeCls="text-xl" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks alertCount={alertCount} isAdmin={isAdmin} />
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-accent hover:text-accent transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-ardoise border-r border-white/10 flex flex-col transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <Brand logoUrl={settings.logoUrl} name={settings.companyName} sizeCls="text-xl" />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-slate-400 hover:text-white"
            aria-label="Fermer le menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks onClose={() => setMobileOpen(false)} alertCount={alertCount} isAdmin={isAdmin} />
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 w-full rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-accent hover:text-accent transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden border-b border-white/10 bg-ardoise px-4 py-4 flex items-center justify-between">
          <Brand logoUrl={settings.logoUrl} name={settings.companyName} sizeCls="text-lg" />
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Ouvrir le menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
