/**
 * Extraction de texte depuis une image de CNI via Google Cloud Vision.
 *
 * La clé API Google Cloud ne doit jamais être exposée côté client : cet appel
 * doit transiter par une fonction serveur (ex. Supabase Edge Function) qui
 * détient la clé et relaie la requête vers l'API Vision.
 */

import { supabase } from './supabase'

export interface CniExtraction {
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

const VISION_PROXY_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-cni`

export async function extractCniFromImage(imageBase64: string): Promise<CniExtraction> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch(VISION_PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ image: imageBase64 }),
  })

  if (!response.ok) {
    throw new Error("L'analyse de la pièce d'identité a échoué")
  }

  return response.json()
}
