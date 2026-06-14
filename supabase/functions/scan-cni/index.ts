// Supabase Edge Function: proxies CNI/passport image analysis to Google Cloud Vision.
// The Vision API key lives only in this function's environment (GOOGLE_VISION_API_KEY secret).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanRequest {
  image: string // base64-encoded image, no data: prefix
}

interface CniExtraction {
  rawText: string
  type_piece: 'CNI' | 'PASSEPORT' | 'TITRE_SEJOUR' | 'PERMIS_CONDUIRE'
  fullName?: string
  firstName?: string
  idNumber?: string
  birthDate?: string
  expiryDate?: string
  nationality?: string
  sex?: string
}

// ── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_FR: Record<string, string> = {
  JANVIER: '01', FÉVRIER: '02', FEVRIER: '02', MARS: '03', AVRIL: '04',
  MAI: '05', JUIN: '06', JUILLET: '07', AOUT: '08', AOÛT: '08',
  SEPTEMBRE: '09', OCTOBRE: '10', NOVEMBRE: '11', DÉCEMBRE: '12', DECEMBRE: '12',
}

const NAT_CODES: Record<string, string> = {
  // Afrique de l'Ouest
  SEN: 'SÉNÉGALAISE', CIV: 'IVOIRIENNE', GIN: 'GUINÉENNE', MLI: 'MALIENNE',
  BFA: 'BURKINABÈ', MRT: 'MAURITANIENNE', GMB: 'GAMBIENNE', CMR: 'CAMEROUNAISE',
  NGA: 'NIGÉRIANE', GHA: 'GHANÉENNE', TGO: 'TOGOLAISE', BEN: 'BÉNINOISE',
  NER: 'NIGÉRIENNE', SLE: 'SIERRA-LÉONAISE', LBR: 'LIBÉRIENNE', GNB: 'BISSAU-GUINÉENNE',
  CPV: 'CAP-VERDIENNE', COD: 'CONGOLAISE', GAB: 'GABONAISE',
  // Europe
  FRA: 'FRANÇAISE', BEL: 'BELGE', CHE: 'SUISSE', LUX: 'LUXEMBOURGEOISE',
  DEU: 'ALLEMANDE', ITA: 'ITALIENNE', ESP: 'ESPAGNOLE', PRT: 'PORTUGAISE',
  GBR: 'BRITANNIQUE', NLD: 'NÉERLANDAISE', SWE: 'SUÉDOISE', NOR: 'NORVÉGIENNE',
  // Afrique du Nord
  MAR: 'MAROCAINE', TUN: 'TUNISIENNE', DZA: 'ALGÉRIENNE', EGY: 'ÉGYPTIENNE',
  // Amériques
  USA: 'AMÉRICAINE', CAN: 'CANADIENNE', BRA: 'BRÉSILIENNE',
}

// Labels qui signalent une nouvelle section — ne pas les retourner comme valeur
const SECTION_LABELS = /^(Prénoms?|Nom|Date de naissance|Date de délivrance|Date d['']expiration|Sexe|Taille|Lieu de naissance|Adresse du domicile|NIN|REPUBLIQUE|Numéro|N°)/i

// ── Helpers génériques ────────────────────────────────────────────────────────

function findLabel(lines: string[], pattern: RegExp): number {
  return lines.findIndex((l) => pattern.test(l.trim()))
}

function nextValue(lines: string[], labelIdx: number, maxLook = 4): string | undefined {
  for (let i = labelIdx + 1; i < Math.min(labelIdx + 1 + maxLook, lines.length); i++) {
    const val = lines[i].trim()
    if (val && val.length > 1 && !SECTION_LABELS.test(val)) return val
  }
}

function extractAfterLabel(lines: string[], pattern: RegExp): string | undefined {
  const idx = lines.findIndex((l) => pattern.test(l))
  if (idx < 0) return undefined
  const parts = lines[idx].split(/[:\-]/)
  if (parts.length > 1 && parts[1].trim()) return parts.slice(1).join(':').trim()
  for (let i = idx + 1; i < Math.min(idx + 3, lines.length); i++) {
    const val = lines[i].trim()
    if (val && val.length > 1 && !SECTION_LABELS.test(val)) return val
  }
}

// Convertit YYMMDD en JJ/MM/AAAA
function parseMrzDate(yymmdd: string, expiry = false): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined
  const yy = parseInt(yymmdd.substring(0, 2))
  const mm = yymmdd.substring(2, 4)
  const dd = yymmdd.substring(4, 6)
  if (parseInt(mm) < 1 || parseInt(mm) > 12 || parseInt(dd) < 1 || parseInt(dd) > 31) return undefined
  // Dates d'expiration → toujours 2000+ ; dates de naissance → siècle selon l'année courante
  const currentYear = new Date().getFullYear() % 100
  const yyyy = expiry ? 2000 + yy : (yy <= currentYear ? 2000 + yy : 1900 + yy)
  return `${dd}/${mm}/${yyyy}`
}

// ── Parsers MRZ ───────────────────────────────────────────────────────────────

// Passeport TD3 : 2 lignes de 44 caractères
//   Ligne 1 : P<PAYS NOM<<PRENOM<<<...
//   Ligne 2 : DOCNUM CHECK PAYS YYMMDD CHECK SEXE EXPIRY CHECK PERSONAL CHECK CHECK
function parseMrzTD3(lines: string[]): Partial<CniExtraction> | null {
  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i].replace(/\s/g, '')
    const l2 = lines[i + 1].replace(/\s/g, '')
    if (
      l1.length >= 42 && l1.length <= 46 &&
      /^P[A-Z<][A-Z<]{3}/.test(l1) && /^[A-Z<]+$/.test(l1) &&
      l2.length >= 42 && l2.length <= 46 &&
      /^[A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{6}[0-9][MF<]/.test(l2)
    ) {
      const nameParts = l1.substring(5).split('<<')
      const fullName = nameParts[0].replace(/</g, ' ').trim()
      const firstName = nameParts.slice(1).join(' ').replace(/</g, ' ').replace(/\s+/g, ' ').trim()
      const idNumber = l2.substring(0, 9).replace(/</g, '').trim()
      const natCode = l2.substring(10, 13).replace(/</g, '')
      const sex = l2[20] === 'M' ? 'M' : l2[20] === 'F' ? 'F' : undefined
      return {
        fullName: fullName || undefined,
        firstName: firstName || undefined,
        idNumber: idNumber || undefined,
        birthDate: parseMrzDate(l2.substring(13, 19), false),
        expiryDate: parseMrzDate(l2.substring(21, 27), true),
        nationality: NAT_CODES[natCode] ?? (natCode || undefined),
        sex,
      }
    }
  }
  return null
}

// CNI avec MRZ TD1 : 3 lignes de 30 caractères
//   Ligne 1 : TYPE(2) PAYS(3) DOCNUM(9) CHECK(1) OPTIONAL(15)
//   Ligne 2 : YYMMDD(6) CHECK(1) SEXE(1) EXPIRY(6) CHECK(1) NATIONALITE(3) OPTIONAL(10) CHECK(1)
//   Ligne 3 : NOM<<PRENOM<<<...
function parseMrzTD1(lines: string[]): Partial<CniExtraction> | null {
  for (let i = 0; i < lines.length - 2; i++) {
    const l1 = lines[i].replace(/\s/g, '')
    const l2 = lines[i + 1].replace(/\s/g, '')
    const l3 = lines[i + 2].replace(/\s/g, '')
    if (
      l1.length >= 28 && l1.length <= 32 &&
      /^[A-Z]{2}[A-Z<]{3}[A-Z0-9<]{9}[0-9]/.test(l1) && /^[A-Z0-9<]+$/.test(l1) &&
      l2.length >= 28 && l2.length <= 32 &&
      /^\d{6}[0-9][MF<]\d{6}[0-9][A-Z<]{3}/.test(l2) &&
      l3.length >= 28 && l3.length <= 32 && /^[A-Z<]+$/.test(l3)
    ) {
      const idNumber = l1.substring(5, 14).replace(/</g, '').trim()
      const natCode = l2.substring(15, 18).replace(/</g, '')
      const sex = l2[7] === 'M' ? 'M' : l2[7] === 'F' ? 'F' : undefined
      const nameParts = l3.split('<<')
      const fullName = nameParts[0].replace(/</g, ' ').trim()
      const firstName = nameParts.slice(1).join(' ').replace(/</g, ' ').replace(/\s+/g, ' ').trim()
      return {
        fullName: fullName || undefined,
        firstName: firstName || undefined,
        idNumber: idNumber || undefined,
        birthDate: parseMrzDate(l2.substring(0, 6), false),
        expiryDate: parseMrzDate(l2.substring(8, 14), true),
        nationality: NAT_CODES[natCode] ?? (natCode || undefined),
        sex,
      }
    }
  }
  return null
}

// ── Extracteurs label-based ───────────────────────────────────────────────────

function guessFullName(lines: string[]): string | undefined {
  // Format CEDEAO sénégalais / autre : "Nom" seul sur sa ligne → ligne suivante = valeur
  const cedeaoIdx = findLabel(lines, /^Nom$/i)
  if (cedeaoIdx >= 0) {
    const val = nextValue(lines, cedeaoIdx)
    if (val) return val
  }
  // Label inline : "NOM: DIALLO" ou "NOM DIALLO"
  const labelVal = extractAfterLabel(lines, /^NOM(\s|:|$)/i)
  if (labelVal) return labelVal
  // MRZ TD1/TD3 line 3 ou line 1 (fallback si parseMrz* non appelé)
  const mrzLine = lines.find((l) => /^[A-Z<]{20,}$/.test(l))
  if (mrzLine) {
    const surname = mrzLine.split('<<')[0].replace(/</g, ' ').trim()
    if (surname && !surname.startsWith('P')) return surname
  }
  // Dernier recours : première ligne tout-caps sans chiffres ni mot-clé document
  return lines.find((l) => {
    const t = l.trim()
    return (
      t.length > 3 && t === t.toUpperCase() &&
      /[A-ZÀÂÉÈÊËÏÎÔÙÛÜ]/.test(t) &&
      !/CARTE|NATIONALE|IDENTIT[EÉ]|REPUBLIQUE|SÉNÉGAL|SENEGAL|BIOMÉTRIQUE|VALIDE|EXPIRE|PASSPORT|PASSEPORT/i.test(t) &&
      !/\d/.test(t)
    )
  })
}

function guessFirstName(lines: string[]): string | undefined {
  // Format CEDEAO : "Prénoms" seul sur sa ligne
  const cedeaoIdx = findLabel(lines, /^Pr[eé]noms?$/i)
  if (cedeaoIdx >= 0) {
    const val = nextValue(lines, cedeaoIdx)
    if (val) return val
  }
  // Label inline
  const labelVal = extractAfterLabel(lines, /^PR[EÉ]NOMS?(\s|:|$)/i)
  if (labelVal) return labelVal
  // MRZ fallback : DIALLO<<MAMADOU → partie après <<
  const mrzLine = lines.find((l) => /^[A-Z<]{20,}$/.test(l))
  if (mrzLine) {
    const parts = mrzLine.split('<<')
    if (parts.length > 1) {
      const fn = parts.slice(1).join(' ').replace(/</g, ' ').trim()
      return fn || undefined
    }
  }
}

function guessIdNumber(rawText: string, lines: string[]): string | undefined {
  // NIN sénégalais sans espaces (ex. "NIN 1234567890123")
  const ninSimple = rawText.match(/\bNIN\s+([A-Z0-9]{8,15})\b/i)
  if (ninSimple) return ninSimple[1]
  // Label générique Numéro / N°
  const labelVal = extractAfterLabel(lines, /NUM[EÉ]RO|N°\s*(DE\s*)?(CARTE|CI|PIECE|PIÈCE)/i)
  if (labelVal) {
    const m = labelVal.match(/[\dA-Z]{6,15}/)
    if (m) return m[0]
  }
  // Séquences numériques par longueur décroissante
  const m13 = rawText.match(/\b\d{13}\b/)
  if (m13) return m13[0]
  const m10 = rawText.match(/\b\d{10}\b/)
  if (m10) return m10[0]
  const m = rawText.match(/\b\d{7,12}\b/)
  return m ? m[0] : undefined
}

function guessBirthDate(rawText: string, lines: string[]): string | undefined {
  // Format CEDEAO : label seul sur ligne → chercher la date dans les lignes suivantes
  const cedeaoIdx = findLabel(lines, /^Date de naissance$/i)
  if (cedeaoIdx >= 0) {
    for (let i = cedeaoIdx + 1; i < Math.min(cedeaoIdx + 6, lines.length); i++) {
      const dateMatch = lines[i].match(/\d{2}[\/\.]\d{2}[\/\.]\d{4}/)
      if (dateMatch) return dateMatch[0].replace(/\./g, '/')
      const wordMatch = lines[i].match(/(\d{1,2})\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ]{3,})\s+(\d{4})/i)
      if (wordMatch) {
        const month = MONTHS_FR[wordMatch[2].toUpperCase()]
        if (month) return `${wordMatch[1].padStart(2, '0')}/${month}/${wordMatch[3]}`
      }
    }
  }
  // Label générique DATE DE NAISSANCE inline
  const val = extractAfterLabel(lines, /DATE.*NAISS|NAISS.*DATE/i)
  if (val) {
    const slash = val.match(/\d{2}[\/\.\-]\d{2}[\/\.\-]\d{2,4}/)
    if (slash) return slash[0].replace(/\./g, '/')
    const words = val.match(/(\d{1,2})\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ]+)\s+(\d{4})/i)
    if (words) {
      const month = MONTHS_FR[words[2].toUpperCase()]
      if (month) return `${words[1].padStart(2, '0')}/${month}/${words[3]}`
    }
  }
  // Fallback MRZ TD1 ligne 2 brute (si parseMrzTD1 n'a pas matché)
  const mrzLine = lines.find((l) => /^\d{7}[MF<]/.test(l))
  if (mrzLine) {
    const result = parseMrzDate(mrzLine.substring(0, 6), false)
    if (result) return result
  }
  // Format texte dans le texte brut : "15 MARS 1985"
  const wordInText = rawText.match(/(\d{1,2})\s+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ]{3,})\s+(\d{4})/i)
  if (wordInText) {
    const month = MONTHS_FR[wordInText[2].toUpperCase()]
    if (month) return `${wordInText[1].padStart(2, '0')}/${month}/${wordInText[3]}`
  }
  const fallback = rawText.match(/\b\d{2}[\/\.]\d{2}[\/\.]\d{4}\b/)
  return fallback ? fallback[0].replace(/\./g, '/') : undefined
}

function guessNationality(rawText: string, lines: string[]): string | undefined {
  // CNI française : "NATIONALITÉ FRANÇAISE" apparaît littéralement sur la carte
  if (/NATIONALIT[EÉ]\s*FRAN[CÇ]AISE/i.test(rawText)) return 'FRANÇAISE'
  // Label NATIONALITÉ inline ou sur ligne séparée
  const val = extractAfterLabel(lines, /NATIONALIT[EÉ]/i)
  if (val && val.length > 2 && !/FRAN[CÇ]AISE/i.test(val)) return val
  if (val && /FRAN[CÇ]AISE/i.test(val)) return 'FRANÇAISE'
  // Fallback MRZ TD1 ligne 2 brute
  const mrzLine = lines.find((l) => /^\d{7}[MF<]\d{6}[A-Z]{3}/.test(l))
  if (mrzLine) {
    const code = mrzLine.substring(15, 18).replace(/</g, '')
    return NAT_CODES[code] ?? code
  }
  // Regex inline dans le texte brut
  const m = rawText.match(/NATIONALIT[EÉ]\s*[:\-]?\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ]{4,})/i)
  return m ? m[1] : undefined
}

// ── Détection du type de document ────────────────────────────────────────────

function detectDocumentType(
  rawText: string,
  lines: string[],
): 'CNI' | 'PASSEPORT' | 'TITRE_SEJOUR' | 'PERMIS_CONDUIRE' {
  if (/TITRE\s*(DE\s*)?S[EÉ]JOUR/i.test(rawText)) return 'TITRE_SEJOUR'
  if (/PERMIS\s*(DE\s*)?CONDUIRE/i.test(rawText)) return 'PERMIS_CONDUIRE'
  // MRZ passeport TD3 : ligne commençant par P + sous-type + code pays (44 chars, que des A-Z<)
  const hasPassportMrz = lines.some((l) => {
    const s = l.replace(/\s/g, '')
    return s.length >= 42 && s.length <= 46 && /^P[A-Z<][A-Z<]{3}/.test(s) && /^[A-Z<]+$/.test(s)
  })
  if (hasPassportMrz) return 'PASSEPORT'
  if (/\bPASSPORT\b|\bPASSEPORT\b/i.test(rawText)) return 'PASSEPORT'
  return 'CNI'
}

// ── Extracteur principal (dispatcher) ────────────────────────────────────────

function extractFields(rawText: string): CniExtraction {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const type_piece = detectDocumentType(rawText, lines)

  // Passeport : MRZ TD3 prioritaire, label-based en fallback
  if (type_piece === 'PASSEPORT') {
    const mrz = parseMrzTD3(lines)
    return {
      rawText,
      type_piece,
      fullName: mrz?.fullName ?? guessFullName(lines),
      firstName: mrz?.firstName ?? guessFirstName(lines),
      idNumber: mrz?.idNumber ?? guessIdNumber(rawText, lines),
      birthDate: mrz?.birthDate ?? guessBirthDate(rawText, lines),
      expiryDate: mrz?.expiryDate,
      nationality: mrz?.nationality ?? guessNationality(rawText, lines),
      sex: mrz?.sex,
    }
  }

  // CNI (sénégalaise CEDEAO, française, autre) et titres divers :
  // - MRZ TD1 pour idNumber/expiryDate/sex (plus fiable que label-based pour ces champs)
  // - label-based pour nom/prénom/date naissance/nationalité (meilleure précision en CEDEAO)
  const td1 = parseMrzTD1(lines)
  return {
    rawText,
    type_piece,
    fullName: guessFullName(lines) ?? td1?.fullName,
    firstName: guessFirstName(lines) ?? td1?.firstName,
    idNumber: td1?.idNumber ?? guessIdNumber(rawText, lines),
    birthDate: guessBirthDate(rawText, lines) ?? td1?.birthDate,
    expiryDate: td1?.expiryDate,
    nationality: guessNationality(rawText, lines) ?? td1?.nationality,
    sex: td1?.sex,
  }
}

// ── Handler Deno ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { image }: ScanRequest = await req.json()
    if (!image) {
      return new Response(JSON.stringify({ error: 'Missing "image" field' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GOOGLE_VISION_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ image: { content: image }, features: [{ type: 'TEXT_DETECTION' }] }],
        }),
      },
    )

    if (!visionResponse.ok) {
      const detail = await visionResponse.text()
      return new Response(JSON.stringify({ error: 'Vision API request failed', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const visionResult = await visionResponse.json()
    const rawText: string = visionResult.responses?.[0]?.fullTextAnnotation?.text ?? ''

    console.log('[scan-cni] raw text:', rawText)
    const parsedData = extractFields(rawText)

    // NIN verso sénégalais : "NIN 1770 1994 03910" (avec espaces entre groupes)
    // Priorité absolue sur tout autre idNumber extrait
    const ninMatch = rawText.match(/NIN\s+([\d][\d\s]{8,18}[\d])/)
    if (ninMatch) parsedData.idNumber = ninMatch[1].trim()

    console.log('[scan-cni] type:', parsedData.type_piece, '| idNumber:', parsedData.idNumber)

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unexpected error', detail: `${error}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
