import { supabase } from './supabase'

// Bucket privé : les photos/logos ne sont accessibles que via URL signée.
const BUCKET = 'documents'
const PUBLIC_MARKER = `/object/public/${BUCKET}/`
const SIGN_MARKER = `/object/sign/${BUCKET}/`

// Cache des URLs signées (path → url + expiration) pour éviter de re-signer
// à chaque rendu. On renouvelle 1 min avant l'expiration réelle.
const cache = new Map<string, { url: string; exp: number }>()

// Extrait le chemin interne au bucket depuis une valeur stockée, qu'il
// s'agisse d'un chemin nu ("photos/123.jpg") ou d'une ancienne URL publique.
export function extractStoragePath(value: string): string | null {
  if (!value) return null
  if (!value.startsWith('http')) return value.replace(/^\/+/, '')
  const pub = value.indexOf(PUBLIC_MARKER)
  if (pub !== -1) return value.slice(pub + PUBLIC_MARKER.length).split('?')[0]
  const sgn = value.indexOf(SIGN_MARKER)
  if (sgn !== -1) return value.slice(sgn + SIGN_MARKER.length).split('?')[0]
  return null
}

export async function getSignedUrl(
  value: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!value) return null
  const path = extractStoragePath(value)
  if (!path) return null

  const now = Date.now()
  const hit = cache.get(path)
  if (hit && hit.exp > now + 60_000) return hit.url

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error || !data) return null
  cache.set(path, { url: data.signedUrl, exp: now + expiresIn * 1000 })
  return data.signedUrl
}
