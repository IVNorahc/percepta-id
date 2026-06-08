// Supabase Edge Function: proxies CNI image analysis to Google Cloud Vision.
// The Vision API key lives only in this function's environment (GOOGLE_VISION_API_KEY secret)
// and is never exposed to the browser — the client only ever calls this endpoint.

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
  fullName?: string
  idNumber?: string
}

const ID_NUMBER_PATTERN = /\b\d[\d\s]{6,}\d\b/

function guessFullName(lines: string[]): string | undefined {
  const nameLine = lines.find((line) => /^(NOM|NAME|PRENOM|PRÉNOM)/i.test(line.trim()))
  if (nameLine) {
    const value = nameLine.split(/[:\-]/).slice(1).join(' ').trim()
    if (value) return value
  }
  // Fallback: the first all-caps line of reasonable length often is the holder's name on Senegalese CNIs.
  return lines.find((line) => {
    const trimmed = line.trim()
    return trimmed.length > 4 && trimmed === trimmed.toUpperCase() && /[A-ZÀ-Ý]/.test(trimmed)
  })
}

function guessIdNumber(rawText: string): string | undefined {
  const match = rawText.match(ID_NUMBER_PATTERN)
  return match ? match[0].replace(/\s+/g, '') : undefined
}

function extractFields(rawText: string): CniExtraction {
  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean)
  return {
    rawText,
    fullName: guessFullName(lines),
    idNumber: guessIdNumber(rawText),
  }
}

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

    // Verify the caller is an authenticated Percepta ID user before spending Vision API quota.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userError } = await supabase.auth.getUser()
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

    const visionResponse = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [{ type: 'TEXT_DETECTION' }],
          },
        ],
      }),
    })

    if (!visionResponse.ok) {
      const detail = await visionResponse.text()
      return new Response(JSON.stringify({ error: 'Vision API request failed', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const visionResult = await visionResponse.json()
    const rawText: string = visionResult.responses?.[0]?.fullTextAnnotation?.text ?? ''

    return new Response(JSON.stringify(extractFields(rawText)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unexpected error', detail: `${error}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
