import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings, type ZoneConfig } from '../lib/settings'

// ── Zone colors ──────────────────────────────────────────────────────────────

const ZONE_COLORS = {
  blue:   { dot: 'bg-blue-500',   text: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10',   label: 'Bleu' },
  green:  { dot: 'bg-green-500',  text: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10',  label: 'Vert' },
  orange: { dot: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', label: 'Orange' },
  red:    { dot: 'bg-red-500',    text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/10',    label: 'Rouge' },
  gray:   { dot: 'bg-slate-400',  text: 'text-slate-400',  border: 'border-slate-500/30',  bg: 'bg-slate-500/10',  label: 'Gris' },
} as const
type ZoneColor = keyof typeof ZONE_COLORS

// ── Profile type ─────────────────────────────────────────────────────────────

interface Profile {
  id: string
  email: string | null
  display_name: string | null
  role: 'admin' | 'agent'
  is_active: boolean
  created_at: string
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-ardoise p-6 shadow-card">
      <div className="mb-6 border-b border-white/10 pb-4">
        <h2 className="text-base font-display font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent'

function SaveRow({ saving, saved, error, onSave }: {
  saving: boolean; saved: boolean; error: string | null; onSave: () => void
}) {
  return (
    <div className="mt-6 flex items-center gap-4">
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : 'Sauvegarder'}
      </button>
      {saved && <span className="text-sm text-emerald-400">✓ Enregistré</span>}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const { user } = useAuth()
  const { settings, loading, save } = useSettings()
  const syncedRef = useRef(false)

  // ── Section 1 : Entreprise ────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('')
  const [siteAddress, setSiteAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savedCompany, setSavedCompany] = useState(false)
  const [errorCompany, setErrorCompany] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ── Section 2 : Zones ─────────────────────────────────────────────────────
  const [zones, setZones] = useState<ZoneConfig[]>([])
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneColor, setNewZoneColor] = useState<ZoneColor>('blue')
  const [newZoneDanger, setNewZoneDanger] = useState(false)
  const [savingZones, setSavingZones] = useState(false)
  const [savedZones, setSavedZones] = useState(false)
  const [errorZones, setErrorZones] = useState<string | null>(null)

  // ── Section 3 : Alertes ──────────────────────────────────────────────────
  const [warningH, setWarningH] = useState(8)
  const [criticalH, setCriticalH] = useState(12)
  const [dangerH, setDangerH] = useState(4)
  const [savingAlerts, setSavingAlerts] = useState(false)
  const [savedAlerts, setSavedAlerts] = useState(false)
  const [errorAlerts, setErrorAlerts] = useState<string | null>(null)

  // ── Section 4 : Utilisateurs ─────────────────────────────────────────────
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Sync form states from settings once loaded
  useEffect(() => {
    if (!loading && !syncedRef.current) {
      syncedRef.current = true
      setCompanyName(settings.companyName)
      setSiteAddress(settings.siteAddress ?? '')
      setPhone(settings.phone ?? '')
      setEmail(settings.email ?? '')
      setLogoUrl(settings.logoUrl)
      setZones(settings.zones)
      setWarningH(settings.thresholdWarningH)
      setCriticalH(settings.thresholdCriticalH)
      setDangerH(settings.thresholdDangerH)
    }
  }, [loading, settings])

  // Load user profiles
  useEffect(() => {
    async function loadProfiles() {
      // Upsert current user to ensure they appear in the list
      if (user) {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      setProfiles((data ?? []) as Profile[])
      setProfilesLoading(false)
    }
    loadProfiles()
  }, [user])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `logos/company-logo.${ext}`
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('documents').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
      await save({ logoUrl: data.publicUrl })
    }
    setLogoUploading(false)
    // reset input so same file can be re-selected
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleSaveCompany() {
    setSavingCompany(true)
    setSavedCompany(false)
    setErrorCompany(null)
    const err = await save({
      companyName: companyName.trim() || 'Percepta ID',
      siteAddress: siteAddress.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    })
    setSavingCompany(false)
    if (err) { setErrorCompany(err) } else { setSavedCompany(true); setTimeout(() => setSavedCompany(false), 2500) }
  }

  async function handleSaveZones() {
    if (zones.length === 0) { setErrorZones('Au moins une zone est requise.'); return }
    setSavingZones(true)
    setSavedZones(false)
    setErrorZones(null)
    const err = await save({ zones })
    setSavingZones(false)
    if (err) { setErrorZones(err) } else { setSavedZones(true); setTimeout(() => setSavedZones(false), 2500) }
  }

  async function handleSaveAlerts() {
    if (warningH <= 0 || criticalH <= 0 || dangerH <= 0) {
      setErrorAlerts('Les seuils doivent être supérieurs à 0.')
      return
    }
    if (warningH >= criticalH) {
      setErrorAlerts("Le seuil orange doit être inférieur au seuil rouge.")
      return
    }
    setSavingAlerts(true)
    setSavedAlerts(false)
    setErrorAlerts(null)
    const err = await save({ thresholdWarningH: warningH, thresholdCriticalH: criticalH, thresholdDangerH: dangerH })
    setSavingAlerts(false)
    if (err) { setErrorAlerts(err) } else { setSavedAlerts(true); setTimeout(() => setSavedAlerts(false), 2500) }
  }

  function addZone() {
    const name = newZoneName.trim()
    if (!name) return
    if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      setErrorZones('Une zone avec ce nom existe déjà.')
      return
    }
    setErrorZones(null)
    setZones((prev) => [...prev, { name, color: newZoneColor, isDanger: newZoneDanger }])
    setNewZoneName('')
    setNewZoneColor('blue')
    setNewZoneDanger(false)
  }

  function removeZone(idx: number) {
    setZones((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateZone(idx: number, patch: Partial<ZoneConfig>) {
    setZones((prev) => prev.map((z, i) => (i === idx ? { ...z, ...patch } : z)))
  }

  async function handleInvite() {
    const emailTrimmed = inviteEmail.trim()
    if (!emailTrimmed) return
    setInviteSending(true)
    setInviteMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: emailTrimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setInviteMsg({ ok: false, text: error.message })
    } else {
      setInviteMsg({
        ok: true,
        text: `Lien de connexion envoyé à ${emailTrimmed}. L'agent pourra accéder à Percepta ID en cliquant sur ce lien.`,
      })
      setInviteEmail('')
    }
    setInviteSending(false)
  }

  async function toggleActive(profile: Profile) {
    if (profile.id === user?.id) return
    setToggling(profile.id)
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id)
    if (!error) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, is_active: !p.is_active } : p)),
      )
    }
    setToggling(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        Chargement des paramètres…
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-400">Configuration de la plateforme Percepta ID.</p>
      </div>

      {/* ── 1. Informations entreprise ──────────────────────────────────── */}
      <SectionCard
        title="Informations entreprise"
        description="Ces informations apparaissent sur les badges et les rapports."
      >
        {/* Logo */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-6">
          <div className="w-20 h-20 rounded-lg border border-white/10 bg-nuit flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl text-slate-600">🏢</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-300 mb-2">Logo de l'entreprise</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-slate-300 hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
              >
                {logoUploading ? 'Envoi…' : logoUrl ? 'Changer le logo' : 'Téléverser un logo'}
              </button>
              {logoUrl && (
                <button
                  onClick={async () => { setLogoUrl(null); await save({ logoUrl: null }) }}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-500 hover:border-red-500/40 hover:text-red-400 transition-colors"
                >
                  Supprimer
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">PNG, JPG, SVG — max 2 Mo</p>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nom de l'entreprise">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Mine d'Or du Sahel"
              className={inputCls}
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@entreprise.com"
              className={inputCls}
            />
          </FormField>
          <FormField label="Téléphone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+221 77 000 00 00"
              className={inputCls}
            />
          </FormField>
          <FormField label="Adresse du site">
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Km 42, Route de la Mine, Région X"
              className={inputCls}
            />
          </FormField>
        </div>
        <SaveRow saving={savingCompany} saved={savedCompany} error={errorCompany} onSave={handleSaveCompany} />
      </SectionCard>

      {/* ── 2. Zones d'accès ────────────────────────────────────────────── */}
      <SectionCard
        title="Zones d'accès"
        description="Définissez les zones du site. Marquez une zone comme 'Dangereuse' pour appliquer le seuil d'alerte réduit."
      >
        <div className="space-y-2">
          {zones.map((zone, idx) => {
            const c = ZONE_COLORS[zone.color as ZoneColor] ?? ZONE_COLORS.gray
            return (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-md border border-white/10 bg-nuit px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
              >
                {/* Color dot + name */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-sm text-white truncate">{zone.name}</span>
                </div>

                {/* Controls — wrap below name on mobile */}
                <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                  {/* Danger badge / toggle */}
                  <button
                    onClick={() => updateZone(idx, { isDanger: !zone.isDanger })}
                    className={`shrink-0 rounded px-2 py-0.5 text-xs border transition-colors ${
                      zone.isDanger
                        ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/5'
                        : 'bg-white/5 text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-400'
                    }`}
                    title="Basculer zone dangereuse"
                  >
                    {zone.isDanger ? '⚠ Dangereuse' : 'Standard'}
                  </button>

                  {/* Color picker */}
                  <select
                    value={zone.color}
                    onChange={(e) => updateZone(idx, { color: e.target.value as ZoneColor })}
                    className="shrink-0 rounded border border-white/10 bg-ardoise px-2 py-1 text-xs text-slate-300 outline-none focus:border-accent"
                  >
                    {(Object.entries(ZONE_COLORS) as [ZoneColor, typeof ZONE_COLORS[ZoneColor]][]).map(([key, val]) => (
                      <option key={key} value={key} className="bg-nuit">{val.label}</option>
                    ))}
                  </select>

                  {/* Delete */}
                  <button
                    onClick={() => removeZone(idx)}
                    className="shrink-0 rounded p-1 text-slate-600 hover:text-red-400 transition-colors ml-auto sm:ml-0"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add zone */}
        <div className="mt-4 flex gap-2 flex-wrap">
          <input
            type="text"
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addZone()}
            placeholder="Nom de la nouvelle zone"
            className="flex-1 min-w-0 rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
          />
          <select
            value={newZoneColor}
            onChange={(e) => setNewZoneColor(e.target.value as ZoneColor)}
            className="rounded-md border border-white/10 bg-ardoise px-3 py-2 text-sm text-slate-300 outline-none focus:border-accent"
          >
            {(Object.entries(ZONE_COLORS) as [ZoneColor, typeof ZONE_COLORS[ZoneColor]][]).map(([key, val]) => (
              <option key={key} value={key} className="bg-nuit">{val.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newZoneDanger}
              onChange={(e) => setNewZoneDanger(e.target.checked)}
              className="accent-red-500"
            />
            Dangereuse
          </label>
          <button
            onClick={addZone}
            disabled={!newZoneName.trim()}
            className="rounded-md border border-accent/40 px-3 py-2 text-sm text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            + Ajouter
          </button>
        </div>

        <SaveRow saving={savingZones} saved={savedZones} error={errorZones} onSave={handleSaveZones} />
      </SectionCard>

      {/* ── 3. Paramètres d'alertes ─────────────────────────────────────── */}
      <SectionCard
        title="Paramètres d'alertes"
        description="Durées de présence déclenchant des alertes. Les modifications sont prises en compte immédiatement."
      >
        <div className="space-y-4">
          <ThresholdField
            label="Alerte orange (avertissement)"
            description="Durée maximale de présence avant avertissement."
            color="amber"
            value={warningH}
            onChange={setWarningH}
          />
          <ThresholdField
            label="Alerte rouge (critique)"
            description="Durée maximale de présence avant alerte critique."
            color="red"
            value={criticalH}
            onChange={setCriticalH}
          />
          <ThresholdField
            label="Zone dangereuse"
            description="Durée maximale en zone dangereuse avant alerte critique."
            color="red"
            value={dangerH}
            onChange={setDangerH}
          />
        </div>
        <SaveRow saving={savingAlerts} saved={savedAlerts} error={errorAlerts} onSave={handleSaveAlerts} />
      </SectionCard>

      {/* ── 4. Gestion des utilisateurs ─────────────────────────────────── */}
      <SectionCard
        title="Gestion des agents"
        description="Agents de sécurité ayant accès à Percepta ID."
      >
        {/* Agents list */}
        {profilesLoading ? (
          <div className="mb-6 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-12 w-full rounded-md" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="mb-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-lg">👥</span>
            <p className="mt-2 text-sm font-medium text-slate-300">Aucun agent enregistré</p>
            <p className="mt-1 text-xs text-slate-500">Invitez un agent ci-dessous pour démarrer.</p>
          </div>
        ) : (
          <div className="mb-6 rounded-md border border-white/10 overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="bg-nuit text-slate-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Agent</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden sm:table-cell">Rôle</th>
                  <th className="text-left font-medium px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {profiles.map((profile) => {
                  const isMe = profile.id === user?.id
                  return (
                    <tr key={profile.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white max-w-[160px]">
                        <p className="truncate">{profile.display_name || profile.email || '—'}</p>
                        {profile.display_name && (
                          <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                        )}
                        {isMe && (
                          <span className="text-xs text-accent">(vous)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize hidden sm:table-cell">
                        {profile.role}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          profile.is_active
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-white/5 text-slate-500 line-through'
                        }`}>
                          {profile.is_active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isMe && (
                          <button
                            onClick={() => toggleActive(profile)}
                            disabled={toggling === profile.id}
                            className={`text-xs rounded border px-2.5 py-1 transition-colors disabled:opacity-40 ${
                              profile.is_active
                                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {toggling === profile.id ? '…' : profile.is_active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Invite form */}
        <div className="border-t border-white/10 pt-5">
          <p className="text-sm font-medium text-white mb-3">Inviter un nouvel agent</p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="agent@entreprise.com"
              className="flex-1 min-w-0 rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
            />
            <button
              onClick={handleInvite}
              disabled={inviteSending || !inviteEmail.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {inviteSending ? 'Envoi…' : 'Envoyer l\'invitation'}
            </button>
          </div>
          {inviteMsg && (
            <p className={`mt-2 text-sm ${inviteMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {inviteMsg.text}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            L'agent recevra un lien de connexion par e-mail. Il sera ajouté à la liste lors de sa première connexion.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

// ── ThresholdField ────────────────────────────────────────────────────────────

function ThresholdField({ label, description, color, value, onChange }: {
  label: string
  description: string
  color: 'amber' | 'red'
  value: number
  onChange: (v: number) => void
}) {
  const dotCls = color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-4 rounded-md border border-white/10 bg-nuit px-4 py-3">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotCls}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          min={1}
          max={72}
          value={value}
          onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded-md border border-white/10 bg-ardoise px-2 py-1 text-sm text-white text-center outline-none focus:border-accent"
        />
        <span className="text-sm text-slate-400">heure{value > 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
