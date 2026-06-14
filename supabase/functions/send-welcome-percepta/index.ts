// Supabase Edge Function: send welcome email after successful signup
// Required secret: RESEND_API_KEY (shared with send-contact function)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WelcomeBody {
  email: string
  companyName?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildHtml(displayName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Bienvenue sur Percepta ID</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

          <!-- ── Header ──────────────────────────────────────── -->
          <tr>
            <td style="background:#0F172A;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Percepta&nbsp;<span style="color:#3B82F6;">ID</span>
              </span>
            </td>
          </tr>

          <!-- ── Body ───────────────────────────────────────── -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <!-- Badge -->
              <div style="text-align:center;margin-bottom:24px;">
                <span style="display:inline-block;background:#EFF6FF;color:#3B82F6;font-size:11px;font-weight:700;padding:5px 14px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase;">
                  Compte activé ✓
                </span>
              </div>

              <!-- Title -->
              <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#0F172A;text-align:center;line-height:1.3;">
                Bienvenue, ${displayName}&nbsp;!
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#64748B;text-align:center;line-height:1.6;">
                Votre compte Percepta ID est activé et prêt à l'emploi.
              </p>

              <hr style="border:none;border-top:1px solid #E2E8F0;margin:0 0 28px;">

              <!-- Steps label -->
              <p style="margin:0 0 18px;font-size:14px;font-weight:700;color:#0F172A;">
                3 étapes pour démarrer :
              </p>

              <!-- Step 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
                <tr>
                  <td width="44" valign="top">
                    <div style="width:30px;height:30px;background:#3B82F6;border-radius:50%;text-align:center;line-height:30px;font-size:13px;font-weight:700;color:#ffffff;">1</div>
                  </td>
                  <td valign="top" style="padding-top:3px;">
                    <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#1E293B;">Configurez votre entreprise</p>
                    <p style="margin:0 0 4px;font-size:13px;color:#64748B;line-height:1.5;">Ajoutez le nom, le logo et les zones d'accès de votre site.</p>
                    <a href="https://percepta-id.vercel.app/parametres" style="font-size:12px;color:#3B82F6;text-decoration:none;font-weight:600;">→ Ouvrir les paramètres</a>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:16px;">
                <tr>
                  <td width="44" valign="top">
                    <div style="width:30px;height:30px;background:#3B82F6;border-radius:50%;text-align:center;line-height:30px;font-size:13px;font-weight:700;color:#ffffff;">2</div>
                  </td>
                  <td valign="top" style="padding-top:3px;">
                    <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#1E293B;">Enregistrez votre premier agent</p>
                    <p style="margin:0 0 4px;font-size:13px;color:#64748B;line-height:1.5;">Scannez une CNI ou un passeport pour enregistrer une entrée sur site.</p>
                    <a href="https://percepta-id.vercel.app/scan" style="font-size:12px;color:#3B82F6;text-decoration:none;font-weight:600;">→ Ouvrir le scanner</a>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:36px;">
                <tr>
                  <td width="44" valign="top">
                    <div style="width:30px;height:30px;background:#3B82F6;border-radius:50%;text-align:center;line-height:30px;font-size:13px;font-weight:700;color:#ffffff;">3</div>
                  </td>
                  <td valign="top" style="padding-top:3px;">
                    <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#1E293B;">Consultez vos rapports</p>
                    <p style="margin:0 0 4px;font-size:13px;color:#64748B;line-height:1.5;">Visualisez les présences, exportez en PDF ou Excel à tout moment.</p>
                    <a href="https://percepta-id.vercel.app/rapports" style="font-size:12px;color:#3B82F6;text-decoration:none;font-weight:600;">→ Ouvrir les rapports</a>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <div style="text-align:center;">
                <a href="https://percepta-id.vercel.app/dashboard"
                   style="display:inline-block;background:#3B82F6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:15px 40px;border-radius:8px;letter-spacing:0.01em;">
                  Accéder à Percepta ID →
                </a>
              </div>

            </td>
          </tr>

          <!-- ── Footer ──────────────────────────────────────── -->
          <tr>
            <td style="background:#F8FAFC;border-radius:0 0 12px 12px;padding:22px 40px;border-top:1px solid #E2E8F0;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748B;text-align:center;">
                Support :
                <a href="mailto:perceptasn@gmail.com" style="color:#3B82F6;text-decoration:none;">perceptasn@gmail.com</a>
                &nbsp;&middot;&nbsp;
                WhatsApp :
                <a href="https://wa.me/221711279503" style="color:#3B82F6;text-decoration:none;">+221 71 127 95 03</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#94A3B8;text-align:center;">
                &copy; 2026 Percepta &mdash; Solution de contr&ocirc;le d'acc&egrave;s pour les industries extractives
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = (await req.json()) as WelcomeBody
    const { email, companyName } = body

    if (!email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Email requis' }),
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

    const displayName = escapeHtml(companyName?.trim() || email.split('@')[0])
    const html = buildHtml(displayName)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Percepta ID <noreply@checkinexpress.app>',
        to: [email],
        subject: 'Bienvenue sur Percepta ID — Votre accès est activé',
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
    console.error('send-welcome-percepta error:', err)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur interne' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
