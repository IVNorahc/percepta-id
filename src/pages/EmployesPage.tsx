import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../lib/settings'
import { extractCniFromImage } from '../lib/vision'
import EmployeeBadgeModal, { type EmployeeBadge } from '../components/EmployeeBadgeModal'
import StorageImage from '../components/StorageImage'

interface Employee {
  id: string
  nom: string
  prenoms: string
  photo_url: string | null
  poste: string | null
  zone_autorisee: string | null
  badge_qr_code: string
  date_embauche: string | null
  statut: 'actif' | 'inactif'
  nin: string | null
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const emptyForm = {
  nom: '',
  prenoms: '',
  poste: '',
  zone_autorisee: '',
  nin: '',
  date_embauche: '',
}

export default function EmployesPage() {
  const { companyId } = useAuth()
  const { settings } = useSettings()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [badge, setBadge] = useState<EmployeeBadge | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    setEmployees((data ?? []) as Employee[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) =>
      `${e.prenoms} ${e.nom} ${e.poste ?? ''} ${e.nin ?? ''}`.toLowerCase().includes(q),
    )
  }, [employees, search])

  const set = (k: keyof typeof emptyForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleCniScan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setFormError(null)
    try {
      const res = await extractCniFromImage(await fileToBase64(file))
      setForm((f) => ({
        ...f,
        nom: res.fullName || f.nom,
        prenoms: res.firstName || f.prenoms,
        nin: res.idNumber || f.nin,
      }))
    } catch {
      setFormError("Analyse de la CNI impossible. Saisissez les informations manuellement.")
    } finally {
      setScanning(false)
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setPhotoFile(null)
    setPhotoPreview(null)
    setFormError(null)
  }

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.prenoms.trim()) {
      setFormError('Le nom et les prénoms sont obligatoires.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      let photoUrl: string | null = null
      if (photoFile) {
        const path = `employees/${Date.now()}-${photoFile.name}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, photoFile)
        if (upErr) throw upErr
        photoUrl = path // bucket privé : on stocke le chemin, affichage via URL signée
      }
      const { error } = await supabase.from('employees').insert({
        company_id: companyId,
        nom: form.nom.trim(),
        prenoms: form.prenoms.trim(),
        poste: form.poste.trim() || null,
        zone_autorisee: form.zone_autorisee || null,
        nin: form.nin.trim() || null,
        date_embauche: form.date_embauche || null,
        photo_url: photoUrl,
      })
      if (error) throw error
      setShowForm(false)
      resetForm()
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "L'enregistrement a échoué.")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatut = async (emp: Employee) => {
    setToggling(emp.id)
    const next = emp.statut === 'actif' ? 'inactif' : 'actif'
    const { error } = await supabase.from('employees').update({ statut: next }).eq('id', emp.id)
    if (!error) {
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, statut: next } : e)))
    }
    setToggling(null)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employés</h1>
          <p className="mt-1 text-sm text-slate-400">
            {employees.filter((e) => e.statut === 'actif').length} employé(s) actif(s).
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="self-start sm:self-auto rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-sombre transition-colors"
        >
          + Ajouter un employé
        </button>
      </div>

      <input
        type="search"
        placeholder="Rechercher par nom, poste, NIN…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full rounded-lg border border-white/10 bg-ardoise px-3 py-2 text-sm text-white outline-none focus:border-accent placeholder:text-slate-600"
      />

      {/* Liste */}
      <div className="mt-4 rounded-xl border border-white/10 shadow-card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-ardoise text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Employé</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Poste</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Zone</th>
              <th className="px-4 py-3 text-left font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="skeleton h-8 w-40" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="skeleton h-3.5 w-20" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="skeleton h-3.5 w-16" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-5 w-14 rounded-full" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-6 w-28 rounded-md ml-auto" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">👷</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">Aucun employé</p>
                    <p className="mt-1 text-xs text-slate-500">Ajoutez votre premier employé pour générer son badge.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <StorageImage
                        src={emp.photo_url}
                        className="h-9 w-9 rounded-full object-cover border border-white/10"
                        fallback={<div className="flex h-9 w-9 items-center justify-center rounded-full bg-nuit border border-white/10 text-slate-500">👤</div>}
                      />
                      <div className="min-w-0">
                        <p className="text-white truncate">{emp.prenoms} {emp.nom}</p>
                        <p className="text-xs text-slate-500 sm:hidden">{emp.poste ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{emp.poste ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{emp.zone_autorisee ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      emp.statut === 'actif' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-500'
                    }`}>
                      {emp.statut === 'actif' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setBadge({
                          id: emp.id, nom: emp.nom, prenoms: emp.prenoms, poste: emp.poste,
                          zoneAutorisee: emp.zone_autorisee, photoUrl: emp.photo_url, badgeQrCode: emp.badge_qr_code,
                        })}
                        className="rounded px-2.5 py-1 text-xs border border-white/15 text-slate-300 hover:border-accent hover:text-accent transition-colors whitespace-nowrap"
                      >
                        Voir le badge
                      </button>
                      <button
                        onClick={() => toggleStatut(emp)}
                        disabled={toggling === emp.id}
                        className={`rounded px-2.5 py-1 text-xs border transition-colors disabled:opacity-40 whitespace-nowrap ${
                          emp.statut === 'actif'
                            ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {toggling === emp.id ? '…' : emp.statut === 'actif' ? 'Désactiver' : 'Réactiver'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {badge && <EmployeeBadgeModal data={badge} onClose={() => setBadge(null)} />}

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ardoise p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Ajouter un employé</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Scan CNI optionnel */}
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-3 text-sm text-slate-300 hover:border-accent hover:text-accent transition-colors">
              {scanning ? 'Analyse de la CNI…' : '📷 Scanner une CNI pour pré-remplir (optionnel)'}
              <input type="file" accept="image/*" onChange={handleCniScan} className="sr-only" disabled={scanning} />
            </label>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nom *" value={form.nom} onChange={set('nom')} placeholder="DIALLO" />
              <Field label="Prénoms *" value={form.prenoms} onChange={set('prenoms')} placeholder="Mamadou" />
              <Field label="Poste" value={form.poste} onChange={set('poste')} placeholder="Opérateur" />
              <div>
                <label className="block text-sm text-slate-300 mb-1">Zone autorisée</label>
                <select
                  value={form.zone_autorisee}
                  onChange={set('zone_autorisee')}
                  className="w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
                >
                  <option value="" className="bg-nuit">—</option>
                  {settings.zones.map((z) => (
                    <option key={z.name} value={z.name} className="bg-nuit">{z.name}</option>
                  ))}
                </select>
              </div>
              <Field label="NIN" value={form.nin} onChange={set('nin')} placeholder="1234567890123" />
              <div>
                <label className="block text-sm text-slate-300 mb-1">Date d'embauche</label>
                <input
                  type="date"
                  value={form.date_embauche}
                  onChange={set('date_embauche')}
                  className="w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Photo */}
            <div className="mt-4">
              <label className="block text-sm text-slate-300 mb-1">Photo (optionnel)</label>
              <div className="flex items-center gap-3">
                {photoPreview && <img src={photoPreview} alt="" className="h-14 w-14 rounded-lg object-cover border border-white/10" />}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
                />
              </div>
            </div>

            {formError && <p className="mt-4 text-sm text-red-400">{formError}</p>}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-sombre transition-colors disabled:opacity-50"
              >
                {submitting ? 'Enregistrement…' : 'Créer l\'employé'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-white/20 px-4 py-2.5 text-sm text-slate-300 hover:border-white/40 transition-colors"
              >
                Annuler
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Un badge QR unique est généré automatiquement à la création.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
      />
    </div>
  )
}
