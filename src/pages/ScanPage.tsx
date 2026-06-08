import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { extractCniFromImage } from '../lib/vision'

const ZONES = ['Entrée principale', 'Zone d\'extraction', 'Atelier', 'Bureaux administratifs', 'Zone de stockage']

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ScanPage() {
  const cniInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [cniFile, setCniFile] = useState<File | null>(null)
  const [cniPreview, setCniPreview] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [reason, setReason] = useState('')
  const [zone, setZone] = useState(ZONES[0])

  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleCniChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setCniFile(file)
    setCniPreview(URL.createObjectURL(file))

    setScanning(true)
    try {
      const base64 = await fileToBase64(file)
      const result = await extractCniFromImage(base64)
      if (result.fullName) setFullName(result.fullName)
      if (result.idNumber) setIdNumber(result.idNumber)
    } catch {
      setError("Impossible d'analyser automatiquement la pièce d'identité. Saisissez les informations manuellement.")
    } finally {
      setScanning(false)
    }
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const uploadIfPresent = async (file: File | null, bucket: string, prefix: string) => {
    if (!file) return null
    const path = `${prefix}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
    if (uploadError) throw uploadError
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const [cniUrl, photoUrl] = await Promise.all([
        uploadIfPresent(cniFile, 'documents', 'cni'),
        uploadIfPresent(photoFile, 'documents', 'photos'),
      ])

      const { error: insertError } = await supabase.from('access_logs').insert({
        full_name: fullName,
        id_number: idNumber,
        reason,
        zone,
        cni_url: cniUrl,
        photo_url: photoUrl,
        checked_in_at: new Date().toISOString(),
      })

      if (insertError) throw insertError

      setSuccess(true)
      setFullName('')
      setIdNumber('')
      setReason('')
      setZone(ZONES[0])
      setCniFile(null)
      setCniPreview(null)
      setPhotoFile(null)
      setPhotoPreview(null)
      if (cniInputRef.current) cniInputRef.current.value = ''
      if (photoInputRef.current) photoInputRef.current.value = ''
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError("L'enregistrement a échoué. Vérifiez les informations et réessayez.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Scanner une entrée</h1>
      <p className="mt-1 text-sm text-gray-400">
        Scannez la CNI pour pré-remplir les informations, puis complétez le motif et la zone d'accès.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-lg border border-white/10 p-6">
          <label className="block text-sm font-medium text-gray-300">Pièce d'identité (CNI)</label>
          <p className="mt-1 text-xs text-gray-500">
            Une photo de la CNI sera analysée automatiquement via Google Cloud Vision pour extraire le nom et le numéro.
          </p>
          <input
            ref={cniInputRef}
            type="file"
            accept="image/*"
            onChange={handleCniChange}
            className="mt-3 block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-or file:px-4 file:py-2 file:text-sm file:font-medium file:text-noir hover:file:bg-or/90"
          />
          {cniPreview && (
            <img src={cniPreview} alt="Aperçu CNI" className="mt-4 h-40 rounded-md border border-white/10 object-cover" />
          )}
          {scanning && <p className="mt-2 text-sm text-or">Analyse de la pièce d'identité en cours...</p>}
        </div>

        <div className="rounded-lg border border-white/10 p-6">
          <label className="block text-sm font-medium text-gray-300">Photo de la personne (optionnel)</label>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="mt-3 block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
          />
          {photoPreview && (
            <img src={photoPreview} alt="Aperçu photo" className="mt-4 h-40 rounded-md border border-white/10 object-cover" />
          )}
        </div>

        <div className="rounded-lg border border-white/10 p-6 space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm text-gray-300">
              Nom complet
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
            />
          </div>

          <div>
            <label htmlFor="idNumber" className="block text-sm text-gray-300">
              Numéro de la CNI
            </label>
            <input
              id="idNumber"
              type="text"
              required
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
            />
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm text-gray-300">
              Motif de la visite
            </label>
            <input
              id="reason"
              type="text"
              required
              placeholder="Livraison, intervention technique, rendez-vous..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
            />
          </div>

          <div>
            <label htmlFor="zone" className="block text-sm text-gray-300">
              Zone d'accès
            </label>
            <select
              id="zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
            >
              {ZONES.map((option) => (
                <option key={option} value={option} className="bg-noir">
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-or">Entrée enregistrée avec succès.</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-or px-6 py-3 font-medium text-noir hover:bg-or/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Enregistrement...' : 'Enregistrer l\'entrée'}
        </button>
      </form>
    </div>
  )
}
