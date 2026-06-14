import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = 'muhammadsamb@gmail.com'

interface AdminUser {
  id: string
  email: string | undefined
  created_at: string
  last_sign_in_at: string | undefined
  banned_until: string | undefined
  email_confirmed_at: string | undefined
}

type ActionState = { type: 'idle' } | { type: 'confirm-delete'; userId: string; email: string }

interface CompanyRow {
  id: string
  name: string
  created_at: string
}

interface CompanyStat {
  agents: number
  totalLogs: number
  onSite: number
}

function isBanned(user: AdminUser): boolean {
  if (!user.banned_until) return false
  return new Date(user.banned_until) > new Date()
}

function fmt(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function callAdmin<T = unknown>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-percepta', { body })
  if (error) return { error: error.message }
  return { data: data as T }
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<ActionState>({ type: 'idle' })
  const [busy, setBusy] = useState<string | null>(null) // userId being acted on
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Multi-tenant : entreprises + stats par entreprise ─────────────────────
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [companyStats, setCompanyStats] = useState<Record<string, CompanyStat>>({})
  const [companiesLoading, setCompaniesLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<string>('all')

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true)
    // Le super-admin voit toutes les entreprises (RLS is_super_admin()).
    const [companiesRes, profilesRes, logsRes] = await Promise.all([
      supabase.from('companies').select('id, name, created_at').order('created_at', { ascending: true }),
      supabase.from('profiles').select('company_id'),
      supabase.from('access_logs').select('company_id, checkout_status'),
    ])

    const stats: Record<string, CompanyStat> = {}
    for (const c of companiesRes.data ?? []) {
      stats[c.id] = { agents: 0, totalLogs: 0, onSite: 0 }
    }
    for (const p of (profilesRes.data ?? []) as { company_id: string | null }[]) {
      if (p.company_id && stats[p.company_id]) stats[p.company_id].agents++
    }
    for (const l of (logsRes.data ?? []) as { company_id: string | null; checkout_status: string }[]) {
      if (l.company_id && stats[l.company_id]) {
        stats[l.company_id].totalLogs++
        if (l.checkout_status === 'present') stats[l.company_id].onSite++
      }
    }
    setCompanies((companiesRes.data ?? []) as CompanyRow[])
    setCompanyStats(stats)
    setCompaniesLoading(false)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await callAdmin<{ users: AdminUser[] }>({ action: 'listUsers' })
    if (error) {
      showToast(`Erreur chargement : ${error}`, false)
    } else {
      // Sort: non-admin first, then by created_at desc, admin last
      const sorted = (data!.users as AdminUser[]).sort((a, b) => {
        if (a.email === ADMIN_EMAIL) return 1
        if (b.email === ADMIN_EMAIL) return -1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      setUsers(sorted)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCompanies() }, [loadCompanies])

  const handleDelete = async (userId: string) => {
    setBusy(userId)
    const { error } = await callAdmin({ action: 'deleteUser', userId })
    if (error) {
      showToast(`Erreur suppression : ${error}`, false)
    } else {
      showToast('Compte supprimé.', true)
      setUsers((u) => u.filter((x) => x.id !== userId))
    }
    setActionState({ type: 'idle' })
    setBusy(null)
  }

  const handleToggleBan = async (user: AdminUser) => {
    const banned = isBanned(user)
    setBusy(user.id)
    const action = banned ? 'unbanUser' : 'banUser'
    const { error } = await callAdmin({ action, userId: user.id })
    if (error) {
      showToast(`Erreur : ${error}`, false)
    } else {
      showToast(banned ? 'Compte réactivé.' : 'Compte suspendu.', true)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, banned_until: banned ? undefined : new Date(Date.now() + 876000 * 3600 * 1000).toISOString() }
            : u,
        ),
      )
    }
    setBusy(null)
  }

  const total = users.length
  const active = users.filter((u) => !isBanned(u)).length
  const suspended = users.filter((u) => isBanned(u)).length

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestion des comptes — accès réservé au maintenancier
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="self-start sm:self-auto shrink-0 rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
        >
          {loading ? 'Chargement…' : '↻ Rafraîchir'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Comptes total', value: total, color: 'text-white' },
          { label: 'Actifs', value: active, color: 'text-green-400' },
          { label: 'Suspendus', value: suspended, color: 'text-orange-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-ardoise p-4 sm:p-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`mt-1 text-2xl sm:text-3xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Entreprises (multi-tenant) ──────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-ardoise overflow-hidden shadow-card">
        <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-300">
            Entreprises {companiesLoading ? '' : `(${companies.length})`}
          </h2>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="rounded-md border border-white/10 bg-nuit px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
          >
            <option value="all" className="bg-nuit">Toutes les entreprises</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id} className="bg-nuit">{c.name}</option>
            ))}
          </select>
        </div>

        {companiesLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full rounded-md" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">🏢</span>
            <p className="mt-3 text-sm font-medium text-slate-300">Aucune entreprise</p>
            <p className="mt-1 text-xs text-slate-500">Les entreprises sont créées automatiquement à l'inscription.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-medium">Entreprise</th>
                  <th className="px-6 py-3 text-left font-medium">Créée le</th>
                  <th className="px-6 py-3 text-right font-medium">Agents</th>
                  <th className="px-6 py-3 text-right font-medium">Entrées</th>
                  <th className="px-6 py-3 text-right font-medium">Sur site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {companies
                  .filter((c) => selectedCompany === 'all' || c.id === selectedCompany)
                  .map((c) => {
                    const st = companyStats[c.id] ?? { agents: 0, totalLogs: 0, onSite: 0 }
                    return (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                        <td className="px-6 py-4 text-slate-400">{fmt(c.created_at)}</td>
                        <td className="px-6 py-4 text-right text-slate-300">{st.agents}</td>
                        <td className="px-6 py-4 text-right text-slate-300">{st.totalLogs}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={st.onSite > 0 ? 'font-semibold text-accent' : 'text-slate-500'}>
                            {st.onSite}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-ardoise overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-slate-300">Comptes inscrits</h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Chargement…</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Aucun compte trouvé.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Inscription</th>
                  <th className="px-6 py-3 text-left font-medium">Dernière connexion</th>
                  <th className="px-6 py-3 text-left font-medium">Statut</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => {
                  const banned = isBanned(user)
                  const isAdmin = user.email === ADMIN_EMAIL
                  const isBusy = busy === user.id

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-medium text-white">{user.email ?? '—'}</span>
                        {isAdmin && (
                          <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                            Admin
                          </span>
                        )}
                        {!user.email_confirmed_at && (
                          <span className="ml-2 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                            Non confirmé
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{fmt(user.created_at)}</td>
                      <td className="px-6 py-4 text-slate-400">{fmt(user.last_sign_in_at)}</td>
                      <td className="px-6 py-4">
                        {banned ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            Suspendu
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isAdmin ? (
                          <span className="text-xs text-slate-600 italic">Protégé</span>
                        ) : actionState.type === 'confirm-delete' && actionState.userId === user.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-red-400">Confirmer ?</span>
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={isBusy}
                              className="rounded px-2.5 py-1 text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                              {isBusy ? '…' : 'Oui, supprimer'}
                            </button>
                            <button
                              onClick={() => setActionState({ type: 'idle' })}
                              className="rounded px-2.5 py-1 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleBan(user)}
                              disabled={isBusy}
                              className={`rounded px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-40 ${
                                banned
                                  ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                                  : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10'
                              }`}
                            >
                              {isBusy ? '…' : banned ? 'Réactiver' : 'Suspendre'}
                            </button>
                            <button
                              onClick={() =>
                                setActionState({ type: 'confirm-delete', userId: user.id, email: user.email ?? '' })
                              }
                              disabled={isBusy}
                              className="rounded px-3 py-1.5 text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                            >
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg border px-5 py-3 text-sm font-medium shadow-xl transition-all ${
            toast.ok
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
