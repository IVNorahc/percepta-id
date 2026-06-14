// Supabase Edge Function: admin operations for Percepta ID
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by the Supabase runtime.
// Caller must be authenticated as muhammadsamb@gmail.com — verified via JWT before any action.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ADMIN_EMAIL = 'muhammadsamb@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'listUsers' | 'deleteUser' | 'banUser' | 'unbanUser'

interface RequestBody {
  action: Action
  userId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    // ── 1. Verify caller identity ────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non authentifié' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

    // Verify JWT and extract caller's identity
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) return json({ error: 'Token invalide' }, 401)
    if (caller.email !== ADMIN_EMAIL) return json({ error: 'Accès refusé' }, 403)

    // ── 2. Admin client (service role) ──────────────────────────────
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 3. Dispatch action ──────────────────────────────────────────
    const body = (await req.json()) as RequestBody
    const { action, userId } = body

    if (action === 'listUsers') {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
      if (error) return json({ error: error.message }, 500)
      return json({ users: data.users })
    }

    if (!userId) return json({ error: 'userId requis' }, 400)

    // Prevent admin from acting on their own account
    if (userId === caller.id) return json({ error: 'Impossible d\'agir sur son propre compte' }, 400)

    if (action === 'deleteUser') {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'banUser') {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h', // ~100 years = effectively permanent
      })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    if (action === 'unbanUser') {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      })
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (err) {
    console.error('admin-percepta error:', err)
    return json({ error: 'Erreur serveur interne' }, 500)
  }
})
