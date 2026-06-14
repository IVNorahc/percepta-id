// Supabase Edge Function: contact form → Resend → perceptasn@gmail.com
// Required secret: RESEND_API_KEY (set via `supabase secrets set RESEND_API_KEY=re_...`)
// Note: Resend free tier requires the `from` domain to be verified.
//       For testing, keep from: 'onboarding@resend.dev' and ensure perceptasn@gmail.com
//       is the verified email on the Resend account.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ContactBody {
  name: string
  company?: string
  email: string
  phone?: string
  message: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as ContactBody
    const { name, company, email, phone, message } = body

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Champs requis manquants (nom, email, message)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set')
      return new Response(
        JSON.stringify({ error: 'Service email non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:system-ui,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc}
  .card{background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0}
  h1{color:#3b82f6;font-size:20px;margin:0 0 4px}
  .sub{color:#64748b;font-size:13px;margin:0 0 20px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;vertical-align:top}
  td:first-child{color:#64748b;font-weight:600;width:110px;padding-right:16px}
  .msg-label{font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
  .msg{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:14px;line-height:1.7;white-space:pre-wrap;color:#334155}
  .footer{margin-top:24px;font-size:12px;color:#94a3b8;text-align:center}
</style></head>
<body>
  <div class="card">
    <h1>Nouvelle demande de démo</h1>
    <p class="sub">Reçu via le formulaire Percepta ID</p>
    <table>
      <tr><td>Nom</td><td>${escapeHtml(name)}</td></tr>
      <tr><td>Entreprise</td><td>${company ? escapeHtml(company) : '—'}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${escapeHtml(email)}" style="color:#3b82f6">${escapeHtml(email)}</a></td></tr>
      <tr><td>Téléphone</td><td>${phone ? escapeHtml(phone) : '—'}</td></tr>
    </table>
    <div class="msg-label">Message</div>
    <div class="msg">${escapeHtml(message)}</div>
  </div>
  <div class="footer">Percepta ID — perceptasn@gmail.com — +221 71 127 95 03</div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Percepta ID <noreply@checkinexpress.app>',
        to: ['perceptasn@gmail.com'],
        reply_to: email,
        subject: `Demande de démo — ${name}${company ? ` (${company})` : ''}`,
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Resend API error:', text)
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'envoi de l'email" }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-contact error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur interne' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
