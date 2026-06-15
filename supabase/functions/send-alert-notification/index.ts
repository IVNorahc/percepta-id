// Supabase Edge Function: notifie par email les responsables d'une entreprise
// lorsqu'une alerte se déclenche (sur-séjour 8h/12h, zone dangereuse, pièce expirée).
//
// Secrets requis :
//   - RESEND_API_KEY     (partagé avec les autres fonctions email)
//   - SERVICE_ROLE_KEY    (renommé : Supabase interdit le préfixe SUPABASE_)
// SUPABASE_URL et SUPABASE_ANON_KEY sont auto-injectés par le runtime.
//
// Le destinataire est résolu côté serveur (service role) à partir du company_id
// → emails des profils actifs (manager/admin) de l'entreprise. Le client ne
// transmet jamais d'adresse email.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AlertPayload {
  type: 'over_8h' | 'over_12h' | 'zone_danger_4h' | 'id_expired'
  label: string
  fullName: string
  zone: string
  checkedInAt?: string
}

interface RequestBody {
  companyId: string
  alert: AlertPayload
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const SEVERITY: Record<AlertPayload['type'], { color: string; tag: string }> = {
  over_8h: { color: '#F59E0B', tag: 'Sur-séjour' },
  over_12h: { color: '#EF4444', tag: 'Sur-séjour critique' },
  zone_danger_4h: { color: '#EF4444', tag: 'Zone dangereuse' },
  id_expired: { color: '#EF4444', tag: 'Pièce expirée' },
}

function buildHtml(companyName: string, alert: AlertPayload): string {
  const sev = SEVERITY[alert.type] ?? { color: '#EF4444', tag: 'Alerte' }
  const checkedIn = alert.checkedInAt
    ? new Date(alert.checkedInAt).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Alerte Percepta ID</title></head>
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
            <div style="text-align:center;margin-bottom:20px;">
              <span style="display:inline-block;background:${sev.color}1a;color:${sev.color};font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">⚠ ${escapeHtml(sev.tag)}</span>
            </div>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;text-align:center;line-height:1.3;">${escapeHtml(alert.label)}</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#64748B;text-align:center;">Une alerte vient de se déclencher sur votre site.</p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:12px 16px;font-size:13px;color:#64748B;border-bottom:1px solid #E2E8F0;width:140px;">Personne</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1E293B;border-bottom:1px solid #E2E8F0;">${escapeHtml(alert.fullName)}</td></tr>
              <tr><td style="padding:12px 16px;font-size:13px;color:#64748B;border-bottom:1px solid #E2E8F0;">Zone</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1E293B;border-bottom:1px solid #E2E8F0;">${escapeHtml(alert.zone)}</td></tr>
              <tr><td style="padding:12px 16px;font-size:13px;color:#64748B;">Entrée enregistrée</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#1E293B;">${escapeHtml(checkedIn)}</td></tr>
            </table>
            <div style="text-align:center;margin-top:28px;">
              <a href="https://percepta-id.vercel.app/alertes" style="display:inline-block;background:#3B82F6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">Voir les alertes →</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;">${escapeHtml(companyName)} &middot; Notification automatique Percepta ID</p>
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
    // ── 1. Vérifier l'appelant (authentifié) ─────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Non authentifié' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) return json({ error: 'Token invalide' }, 401)

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set')
      return json({ error: 'Service email non configuré' }, 500)
    }

    const body = (await req.json()) as RequestBody
    const { companyId, alert } = body
    if (!companyId || !alert?.type) return json({ error: 'Paramètres invalides' }, 400)

    // ── 2. Client service role : vérifie l'appartenance + résout les destinataires ──
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // L'appelant doit appartenir à l'entreprise concernée (anti-usurpation).
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('company_id, email')
      .eq('id', caller.id)
      .single()
    const isSuperAdmin = caller.email === 'muhammadsamb@gmail.com'
    if (!isSuperAdmin && callerProfile?.company_id !== companyId) {
      return json({ error: 'Accès refusé' }, 403)
    }

    // Responsables de l'entreprise (managers/admins actifs).
    const { data: recipients } = await admin
      .from('profiles')
      .select('email')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .in('role', ['manager', 'admin'])

    const emails = (recipients ?? [])
      .map((r) => r.email)
      .filter((e): e is string => !!e)
    if (emails.length === 0) return json({ ok: true, skipped: 'no_recipient' })

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()
    const companyName = company?.name ?? 'Votre entreprise'

    // ── 3. Envoi via Resend ──────────────────────────────────────────
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Percepta ID <noreply@checkinexpress.app>',
        to: emails,
        subject: `⚠ Alerte Percepta ID — ${alert.fullName}`,
        html: buildHtml(companyName, alert),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Resend API error:', text)
      return json({ error: "Erreur lors de l'envoi de l'email" }, 502)
    }

    return json({ ok: true, sent: emails.length })
  } catch (err) {
    console.error('send-alert-notification error:', err)
    return json({ error: 'Erreur serveur interne' }, 500)
  }
})
