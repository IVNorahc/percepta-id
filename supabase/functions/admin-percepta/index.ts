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

type Action = 'listUsers' | 'deleteUser' | 'banUser' | 'unbanUser' | 'createUser'

interface RequestBody {
  action: Action
  userId?: string
  // createUser
  email?: string
  displayName?: string
  role?: 'manager' | 'agent'
  companyId?: string
}

// Mot de passe temporaire lisible (lettres + chiffres, pas de caractères ambigus).
function generateTempPassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += alphabet[bytes[i] % alphabet.length]
  return pwd
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildCredentialsEmail(opts: {
  displayName: string
  email: string
  password: string
  companyName: string
  role: string
}): string {
  const roleLabel = opts.role === 'manager' ? 'Responsable' : 'Agent'
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Votre accès Percepta ID</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#0F172A;border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Percepta&nbsp;<span style="color:#3B82F6;">ID</span></span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;text-align:center;line-height:1.3;">Bienvenue, ${escapeHtml(opts.displayName)}&nbsp;!</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#64748B;text-align:center;line-height:1.6;">
              Un compte <strong>${escapeHtml(roleLabel)}</strong> a été créé pour vous sur ${escapeHtml(opts.companyName)}.
              Voici vos identifiants de connexion.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr><td style="padding:12px 16px;font-size:13px;color:#64748B;border-bottom:1px solid #E2E8F0;width:160px;">Email</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1E293B;border-bottom:1px solid #E2E8F0;">${escapeHtml(opts.email)}</td></tr>
              <tr><td style="padding:12px 16px;font-size:13px;color:#64748B;">Mot de passe temporaire</td><td style="padding:12px 16px;font-size:14px;font-weight:700;color:#0F172A;font-family:monospace;letter-spacing:0.5px;">${escapeHtml(opts.password)}</td></tr>
            </table>
            <p style="margin:0 0 24px;font-size:13px;color:#64748B;line-height:1.6;text-align:center;">
              Par sécurité, modifiez ce mot de passe dès votre première connexion.
            </p>
            <div style="text-align:center;">
              <a href="https://percepta-id.vercel.app/login" style="display:inline-block;background:#3B82F6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">Se connecter →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;">${escapeHtml(opts.companyName)} &middot; Percepta ID</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
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

    if (action === 'createUser') {
      const email = body.email?.trim().toLowerCase()
      const displayName = body.displayName?.trim() || email?.split('@')[0] || ''
      const role = body.role === 'manager' ? 'manager' : 'agent'
      const companyId = body.companyId

      if (!email) return json({ error: 'Email requis' }, 400)
      if (!companyId) return json({ error: 'Entreprise requise' }, 400)

      // ── Verrou d'exclusivité : une seule entreprise cliente par instance ────
      // On ne peut ajouter des utilisateurs qu'à l'entreprise déjà existante.
      const { data: allCompanies, error: companiesErr } = await admin
        .from('companies')
        .select('id, name')
        .order('created_at', { ascending: true })
      if (companiesErr) return json({ error: companiesErr.message }, 500)

      const company = (allCompanies ?? []).find((c) => c.id === companyId)
      if (!company) {
        // Si une entreprise existe déjà, refuser toute nouvelle entreprise.
        if ((allCompanies ?? []).length > 0) {
          return json(
            { error: "Limite d'entreprise atteinte — Cette instance est exclusive à une seule entreprise cliente" },
            403,
          )
        }
        return json({ error: 'Entreprise introuvable' }, 400)
      }

      // Création du compte : le trigger handle_new_user lira company_id/role/display_name.
      const password = generateTempPassword()
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { company_id: companyId, role, display_name: displayName },
      })
      if (createErr || !created?.user) {
        return json({ error: createErr?.message ?? 'Échec de la création' }, 400)
      }

      // Email d'identifiants (best-effort : ne bloque pas la création).
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
      let emailSent = false
      if (RESEND_API_KEY) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Percepta ID <noreply@checkinexpress.app>',
              to: [email],
              subject: 'Votre accès Percepta ID',
              html: buildCredentialsEmail({ displayName, email, password, companyName: company.name, role }),
            }),
          })
          emailSent = res.ok
          if (!res.ok) console.error('Resend createUser email error:', await res.text())
        } catch (e) {
          console.error('Resend createUser fetch error:', e)
        }
      }

      return json({ ok: true, userId: created.user.id, emailSent })
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
