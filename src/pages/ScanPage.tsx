import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { extractCniFromImage, type CniExtraction } from '../lib/vision'
import BadgeModal, { type BadgeData } from '../components/BadgeModal'
import { useSettings } from '../lib/settings'

type ScanStep = 'recto' | 'verso' | 'form'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function Field({
  id, label, required, value, onChange, placeholder, type = 'text',
}: {
  id: string; label: string; required?: boolean; value: string
  onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-300">
        {label}{required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <input
        id={id} type={type} required={required} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
      />
    </div>
  )
}

export default function ScanPage() {
  const { settings } = useSettings()
  const zones = settings.zones.map((z) => z.name)

  const cniInputRef = useRef<HTMLInputElement>(null)
  const versoInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [scanStep, setScanStep] = useState<ScanStep>('recto')
  const [rectoPreview, setRectoPreview] = useState<string | null>(null)
  const [versoPreview, setVersoPreview] = useState<string | null>(null)
  const [cniFile, setCniFile] = useState<File | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const [fullName, setFullName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [nationality, setNationality] = useState('')
  const [sex, setSex] = useState('')
  const [typePiece, setTypePiece] = useState('')
  const [company, setCompany] = useState('')
  const [reason, setReason] = useState('')
  const [zone, setZone] = useState('')

  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null)

  // Init zone selection once settings load
  useEffect(() => {
    if (zones.length > 0 && !zone) setZone(zones[0])
  }, [zones, zone])

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [cameraActive, stream])

  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
  }, [stream])

  const startCamera = async () => {
    setError(null)
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      setStream(mediaStream)
      setCameraActive(true)
    } catch {
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions du navigateur.")
    }
  }

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    setCameraActive(false)
  }

  const applyRectoResult = (result: CniExtraction) => {
    if (result.fullName) setFullName(result.fullName)
    if (result.firstName) setFirstName(result.firstName)
    if (result.idNumber) setIdNumber(result.idNumber)
    if (result.birthDate) setBirthDate(result.birthDate)
    if (result.expiryDate) setExpiryDate(result.expiryDate)
    if (result.nationality) setNationality(result.nationality)
    if (result.sex) setSex(result.sex)
    if (result.type_piece) setTypePiece(result.type_piece)
    // Les passeports n'ont pas de verso NIN — aller directement au formulaire
    setScanStep(result.type_piece === 'PASSEPORT' ? 'form' : 'verso')
  }

  const applyVersoResult = (result: CniExtraction) => {
    // Le verso fournit le NIN — écrase l'idNumber du recto si présent
    if (result.idNumber) setIdNumber(result.idNumber)
    setScanStep('form')
  }

  const scanBase64 = async (base64: string, step: ScanStep) => {
    setScanning(true)
    setError(null)
    try {
      const result = await extractCniFromImage(base64)
      if (step === 'recto') applyRectoResult(result)
      else applyVersoResult(result)
    } catch {
      setError("Analyse automatique impossible. Vérifiez la qualité de l'image ou saisissez les informations manuellement.")
      // Avancer quand même pour ne pas bloquer le flux
      if (step === 'recto') setScanStep('verso')
      else setScanStep('form')
    } finally {
      setScanning(false)
    }
  }

  // Capture une frame depuis le flux vidéo et lance l'analyse
  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const base64 = dataUrl.split(',')[1] ?? ''
    const capturedStep = scanStep
    stopCamera()
    if (capturedStep === 'recto') {
      setRectoPreview(dataUrl)
      canvas.toBlob(
        (blob) => { if (blob) setCniFile(new File([blob], 'cni-recto.jpg', { type: 'image/jpeg' })) },
        'image/jpeg', 0.92,
      )
    } else {
      setVersoPreview(dataUrl)
    }
    await scanBase64(base64, capturedStep)
  }

  const handleRectoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCniFile(file)
    setRectoPreview(URL.createObjectURL(file))
    await scanBase64(await fileToBase64(file), 'recto')
  }

  const handleVersoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVersoPreview(URL.createObjectURL(file))
    await scanBase64(await fileToBase64(file), 'verso')
  }

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
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

  const resetAll = () => {
    setFullName(''); setFirstName(''); setIdNumber(''); setBirthDate(''); setExpiryDate('')
    setNationality(''); setSex(''); setTypePiece('')
    setCompany(''); setReason(''); setZone(zones[0] ?? '')
    setCniFile(null); setRectoPreview(null); setVersoPreview(null)
    setPhotoFile(null); setPhotoPreview(null)
    setScanStep('recto'); setError(null)
    if (cniInputRef.current) cniInputRef.current.value = ''
    if (versoInputRef.current) versoInputRef.current.value = ''
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleBadgeClose = () => {
    setBadgeData(null)
    resetAll()
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
      const { data: inserted, error: insertError } = await supabase
        .from('access_logs')
        .insert({
          full_name: fullName, first_name: firstName || null, id_number: idNumber,
          birth_date: birthDate || null, expiry_date: expiryDate || null,
          nationality: nationality || null, sex: sex || null,
          type_piece: typePiece || null,
          company: company || null, reason, zone,
          cni_url: cniUrl, photo_url: photoUrl,
          checked_in_at: new Date().toISOString(),
          checkout_status: 'present',
        })
        .select('id, checked_in_at')
        .single()
      if (insertError) throw insertError
      setBadgeData({
        logId: inserted.id,
        fullName,
        firstName: firstName || null,
        zone,
        checkedInAt: inserted.checked_in_at,
        photoUrl: photoUrl ?? photoPreview,
      })
    } catch {
      setError("L'enregistrement a échoué. Vérifiez les informations et réessayez.")
    } finally {
      setSubmitting(false)
    }
  }

  // Bloc caméra inline — partagé entre recto et verso via scanStep courant
  const cameraBlock = (
    <div className="mt-3 space-y-3">
      <div className="relative overflow-hidden rounded-md border border-white/10 bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-contain" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={captureAndScan}
          disabled={scanning}
          className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sombre transition-colors disabled:opacity-50"
        >
          {scanning ? 'Analyse...' : 'Prendre la photo'}
        </button>
        <button
          type="button"
          onClick={stopCamera}
          className="rounded-md border border-white/20 px-4 py-2.5 text-sm text-slate-300 hover:border-white/40 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Scanner une entrée</h1>
      <p className="mt-1 text-sm text-slate-400">
        Scannez la CNI pour pré-remplir automatiquement les informations de la personne.
      </p>

      {/* ── Étape 1 : Recto ── */}
      {scanStep === 'recto' && (
        <div className="mt-6 rounded-lg border border-white/10 bg-ardoise p-4 sm:p-6">
          <p className="text-sm font-medium text-slate-300">Étape 1 — Recto de la CNI</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Pointez la caméra sur le recto (face avec photo et nom).
          </p>
          {cameraActive ? cameraBlock : (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sombre transition-colors"
              >
                Ouvrir la caméra
              </button>
              <label className="flex-1 cursor-pointer rounded-md border border-white/20 px-4 py-2.5 text-center text-sm text-slate-300 hover:border-white/40 transition-colors">
                Importer un fichier
                <input ref={cniInputRef} type="file" accept="image/*" onChange={handleRectoFile} className="sr-only" />
              </label>
            </div>
          )}
          {scanning && <p className="mt-2 text-sm text-accent">Analyse du recto...</p>}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* ── Étape 2 : Verso ── */}
      {scanStep === 'verso' && (
        <div className="mt-6 space-y-4">
          {/* Confirmation recto */}
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-400">CNI détectée !</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Retournez la carte pour scanner le verso et extraire le NIN.
              </p>
              {(fullName || firstName) && (
                <p className="mt-1.5 text-sm text-white">{firstName} {fullName}</p>
              )}
            </div>
            {rectoPreview && (
              <img src={rectoPreview} alt="Recto CNI" className="h-20 w-auto shrink-0 rounded-md border border-white/10 object-cover opacity-80" />
            )}
          </div>

          {/* Scan verso */}
          <div className="rounded-lg border border-white/10 bg-ardoise p-4 sm:p-6">
            <p className="text-sm font-medium text-slate-300">Étape 2 — Verso de la CNI</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Le verso contient le NIN (Numéro d'Identification National) sous le code-barres.
            </p>
            {cameraActive ? cameraBlock : (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sombre transition-colors"
                >
                  Scanner le verso
                </button>
                <label className="flex-1 cursor-pointer rounded-md border border-white/20 px-4 py-2.5 text-center text-sm text-slate-300 hover:border-white/40 transition-colors">
                  Importer le verso
                  <input ref={versoInputRef} type="file" accept="image/*" onChange={handleVersoFile} className="sr-only" />
                </label>
              </div>
            )}
            {scanning && <p className="mt-2 text-sm text-accent">Extraction du NIN...</p>}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {!cameraActive && !scanning && (
              <button
                type="button"
                onClick={() => setScanStep('form')}
                className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
              >
                Passer le verso (continuer sans NIN)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Étape 3 : Formulaire final ── */}
      {scanStep === 'form' && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">

          {/* Aperçus recto / verso + bouton rescanner */}
          {(rectoPreview || versoPreview) && (
            <div className="flex items-end gap-3">
              {rectoPreview && (
                <div className="flex-1 min-w-0">
                  <p className="mb-1 text-xs text-slate-500">Recto</p>
                  <img src={rectoPreview} alt="Recto" className="h-20 w-full rounded-md border border-white/10 object-cover" />
                </div>
              )}
              {versoPreview && (
                <div className="flex-1 min-w-0">
                  <p className="mb-1 text-xs text-slate-500">Verso</p>
                  <img src={versoPreview} alt="Verso" className="h-20 w-full rounded-md border border-white/10 object-cover" />
                </div>
              )}
              <button
                type="button"
                onClick={resetAll}
                className="mb-0.5 shrink-0 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
              >
                Rescanner
              </button>
            </div>
          )}

          {/* Photo de la personne */}
          <div className="rounded-lg border border-white/10 bg-ardoise p-4 sm:p-6">
            <p className="text-sm font-medium text-slate-300">
              Photo de la personne <span className="text-slate-500 font-normal">(optionnel)</span>
            </p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="mt-3 block w-full text-sm text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/20"
            />
            {photoPreview && (
              <img src={photoPreview} alt="Aperçu photo" className="mt-4 h-40 w-auto rounded-md border border-white/10 object-cover" />
            )}
          </div>

          {/* Informations d'identité */}
          <div className="rounded-lg border border-white/10 bg-ardoise p-4 sm:p-6 space-y-4">
            <p className="text-sm font-medium text-slate-300">Informations d'identité</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="fullName" label="Nom (famille)" required value={fullName} onChange={setFullName} placeholder="DIALLO" />
              <Field id="firstName" label="Prénom(s)" value={firstName} onChange={setFirstName} placeholder="Mamadou" />
              <Field id="idNumber" label="NIN / Numéro" required value={idNumber} onChange={setIdNumber} placeholder="1234567890123" />
              <Field id="birthDate" label="Date de naissance" value={birthDate} onChange={setBirthDate} placeholder="15/03/1985" />
              <Field id="expiryDate" label="Date d'expiration" value={expiryDate} onChange={setExpiryDate} placeholder="31/12/2030" />
              <Field id="nationality" label="Nationalité" value={nationality} onChange={setNationality} placeholder="SÉNÉGALAISE" />
              <div>
                <label htmlFor="sex" className="block text-sm text-slate-300">Sexe</label>
                <select
                  id="sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
                >
                  <option value="" className="bg-nuit">—</option>
                  <option value="M" className="bg-nuit">M — Masculin</option>
                  <option value="F" className="bg-nuit">F — Féminin</option>
                </select>
              </div>
            </div>
          </div>

          {/* Informations de la visite */}
          <div className="rounded-lg border border-white/10 bg-ardoise p-4 sm:p-6 space-y-4">
            <p className="text-sm font-medium text-slate-300">Informations de la visite</p>
            <Field
              id="company"
              label="Entreprise / Prestataire"
              value={company}
              onChange={setCompany}
              placeholder="Société ABC, Sous-traitant XYZ..."
            />
            <Field
              id="reason"
              label="Motif de la visite"
              required
              value={reason}
              onChange={setReason}
              placeholder="Livraison, intervention technique, réunion..."
            />
            <div>
              <label htmlFor="zone" className="block text-sm text-slate-300">
                Zone d'accès <span className="text-red-400">*</span>
              </label>
              <select
                id="zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {zones.map((z) => (
                  <option key={z} value={z} className="bg-nuit">{z}</option>
                ))}
              </select>
              {settings.zones.find((z) => z.name === zone)?.isDanger && (
                <p className="mt-1 text-xs text-amber-400">Accès soumis à équipements de protection obligatoires.</p>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || scanning}
            className="w-full sm:w-auto rounded-md bg-accent px-6 py-3 font-medium text-white hover:bg-accent-sombre transition-colors disabled:opacity-50"
          >
            {submitting ? 'Enregistrement...' : "Enregistrer l'entrée"}
          </button>
        </form>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {badgeData && <BadgeModal data={badgeData} onClose={handleBadgeClose} />}
    </div>
  )
}
