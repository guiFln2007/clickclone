import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://ratoads.com.br'
const STARTER_URL = 'https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9'

export async function sendWelcomeEmail(email: string, name: string, tempPassword: string) {
  if (!process.env.SMTP_USER) return

  const firstName = name ? name.split(' ')[0] : ''

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu acesso ao RatoAds está pronto ⚡',
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bem-vindo ao RatoAds</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">

    <div style="text-align:center;margin-bottom:32px">
      <img src="${BASE_URL}/logo.png" alt="RatoAds" height="32" style="height:32px;width:auto"/>
    </div>

    <div style="background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">

      <div style="background:linear-gradient(135deg,#E8692A 0%,#f07340 100%);padding:32px 32px 28px">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Acesso ativado</div>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;line-height:1.2">
          ${firstName ? `Olá, ${firstName}! 👋` : 'Bem-vindo! 👋'}
        </h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,.85)">
          Sua conta no RatoAds foi criada. Use os dados abaixo para entrar.
        </p>
      </div>

      <div style="padding:32px">

        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">Suas credenciais</div>
          <div style="margin-bottom:12px">
            <div style="font-size:12px;color:#555;margin-bottom:4px">Login</div>
            <div style="font-size:15px;color:#ccc;font-weight:500">${email}</div>
          </div>
          <div style="border-top:1px solid #222;padding-top:12px">
            <div style="font-size:12px;color:#555;margin-bottom:4px">Senha temporária</div>
            <div style="display:inline-block;background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:8px 14px;font-family:monospace;font-size:18px;font-weight:700;color:#E8692A;letter-spacing:2px">${tempPassword}</div>
          </div>
        </div>

        <div style="background:#1a1500;border:1px solid #2a2000;border-radius:8px;padding:12px 16px;margin-bottom:24px">
          <div style="font-size:13px;color:#b8860b">⚠️ &nbsp;No primeiro acesso, você pode definir sua senha definitiva.</div>
        </div>

        <div style="margin-bottom:28px">
          <div style="font-size:11px;font-weight:700;color:#444;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">Seu plano inclui</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${[
              ['🔍', 'Análise completa de ofertas escaladas'],
              ['⚡', 'Mineração automática por palavra-chave'],
              ['📊', 'Rastreamento diário de concorrentes'],
            ].map(([icon, text]) => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:32px;height:32px;border-radius:8px;background:#1a1a1a;border:1px solid #2a2a2a;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${icon}</div>
              <span style="font-size:14px;color:#999">${text}</span>
            </div>`).join('')}
          </div>
        </div>

        <a href="${BASE_URL}/login"
           style="display:block;text-align:center;background:#E8692A;color:#fff;padding:16px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
          Entrar no RatoAds →
        </a>

      </div>
    </div>

    <div style="text-align:center;margin-top:24px">
      <p style="font-size:12px;color:#333;margin:0 0 6px">
        Dúvidas? Responda este email que te ajudamos.
      </p>
      <a href="${BASE_URL}" style="font-size:12px;color:#555;text-decoration:none">${BASE_URL}</a>
    </div>

  </div>
</body>
</html>`,
  })
}

export async function sendTrialEmail(email: string, tempPassword: string) {
  if (!process.env.SMTP_USER) return

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu teste grátis do RatoAds está ativo',
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Teste Grátis - RatoAds</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">

    <div style="text-align:center;margin-bottom:32px">
      <img src="${BASE_URL}/logo.png" alt="RatoAds" height="32" style="height:32px;width:auto"/>
    </div>

    <div style="background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">

      <div style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:32px 32px 28px">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Teste gratuito</div>
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;line-height:1.2">
          Seu acesso está pronto
        </h1>
        <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,.85)">
          Você tem <strong>30 dias</strong> para testar o RatoAds sem pagar nada.
        </p>
      </div>

      <div style="padding:32px">

        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">Suas credenciais</div>
          <div style="margin-bottom:12px">
            <div style="font-size:12px;color:#555;margin-bottom:4px">Login</div>
            <div style="font-size:15px;color:#ccc;font-weight:500">${email}</div>
          </div>
          <div style="border-top:1px solid #222;padding-top:12px">
            <div style="font-size:12px;color:#555;margin-bottom:4px">Senha temporária</div>
            <div style="display:inline-block;background:#0a0a0a;border:1px solid #333;border-radius:8px;padding:8px 14px;font-family:monospace;font-size:18px;font-weight:700;color:#10B981;letter-spacing:2px">${tempPassword}</div>
          </div>
        </div>

        <div style="margin-bottom:28px">
          <div style="font-size:11px;font-weight:700;color:#444;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">Seu teste inclui</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${[
              ['1x', 'Análise completa de oferta'],
              ['1x', 'Mineração automática'],
              ['1x', 'Slot de rastreamento'],
            ].map(([n, text]) => `
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:32px;height:32px;border-radius:8px;background:#1a1a1a;border:1px solid #2a2a2a;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#10B981;flex-shrink:0">${n}</div>
              <span style="font-size:14px;color:#999">${text}</span>
            </div>`).join('')}
          </div>
        </div>

        <a href="${BASE_URL}/login"
           style="display:block;text-align:center;background:#10B981;color:#fff;padding:16px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
          Entrar no RatoAds →
        </a>

        <div style="background:#1a1500;border:1px solid #2a2000;border-radius:8px;padding:12px 16px;margin-top:20px">
          <div style="font-size:13px;color:#b8860b">Gostou? Assine o Starter (R$57,90/mês) e desbloqueie 10 análises, 10 minerações e 5 slots de radar.</div>
        </div>

      </div>
    </div>

    <div style="text-align:center;margin-top:24px">
      <p style="font-size:12px;color:#333;margin:0 0 6px">
        Dúvidas? Responda este email.
      </p>
      <a href="${BASE_URL}" style="font-size:12px;color:#555;text-decoration:none">${BASE_URL}</a>
    </div>

  </div>
</body>
</html>`,
  })
}

export async function sendTrialDiscountEmail(email: string, reason: 'quota' | 'expiring' | 'expired') {
  if (!process.env.SMTP_USER) return

  const subjects: Record<string, string> = {
    quota: 'Sua cota acabou — 10% OFF pra desbloquear o RatoAds',
    expiring: 'Seu teste acaba em breve — garanta 10% OFF',
    expired: 'Seu teste expirou — última chance: 10% de desconto',
  }

  const headlines: Record<string, string> = {
    quota: 'Você usou toda sua cota gratuita',
    expiring: 'Seu teste acaba em poucos dias',
    expired: 'Seu teste gratuito expirou',
  }

  const bodyCopy: Record<string, string> = {
    quota: 'Você já testou o RatoAds e viu o poder da ferramenta. Agora imagina com <strong>10 análises, 10 minerações e 5 slots de radar</strong> todo mês.',
    expiring: 'Em breve seu acesso gratuito vai expirar. Não perde o ritmo — assine agora e continue espionando seus concorrentes.',
    expired: 'Seu acesso foi encerrado, mas seus dados ainda estão aqui. Assine e volte de onde parou — com 10x mais recursos.',
  }

  const urgencyColor = reason === 'expired' ? '#ef4444' : reason === 'expiring' ? '#f59e0b' : '#E8692A'

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subjects[reason],
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">

    <div style="text-align:center;margin-bottom:32px">
      <img src="${BASE_URL}/logo.png" alt="RatoAds" height="32" style="height:32px;width:auto"/>
    </div>

    <div style="background:#111;border:1px solid #222;border-radius:16px;overflow:hidden">

      <div style="background:linear-gradient(135deg,${urgencyColor} 0%,${urgencyColor}cc 100%);padding:32px 32px 28px">
        <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Oferta exclusiva</div>
        <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.2">
          ${headlines[reason]}
        </h1>
      </div>

      <div style="padding:32px">

        <p style="font-size:15px;color:#999;line-height:1.7;margin:0 0 24px">
          ${bodyCopy[reason]}
        </p>

        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
          <div style="font-size:13px;color:#666;margin-bottom:8px;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Desconto exclusivo do trial</div>
          <div style="font-size:48px;font-weight:800;color:#E8692A;line-height:1">10% OFF</div>
          <div style="font-size:14px;color:#888;margin-top:8px">
            De <span style="text-decoration:line-through;color:#555">R$57,90</span> por <strong style="color:#fff">R$52,11</strong>/mês
          </div>
          <div style="font-size:12px;color:#444;margin-top:6px">Plano Starter — 10 análises, 10 minerações, 5 slots</div>
        </div>

        <div style="margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;color:#444;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px">O que você desbloqueia</div>
          ${[
            ['10x', 'Análises completas por mês'],
            ['10x', 'Minerações automáticas'],
            ['5x', 'Slots de rastreamento diário'],
          ].map(([n, text]) => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:#1a1a1a;border:1px solid #2a2a2a;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#E8692A;flex-shrink:0">${n}</div>
            <span style="font-size:14px;color:#999">${text}</span>
          </div>`).join('')}
        </div>

        <a href="${STARTER_URL}"
           style="display:block;text-align:center;background:#E8692A;color:#fff;padding:16px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
          Assinar o Starter →
        </a>

        <div style="background:#0a0a0a;border:1px solid #333;border-radius:10px;padding:16px;margin-top:16px;text-align:center">
          <div style="font-size:12px;color:#666;margin-bottom:6px">Use o cupom no checkout:</div>
          <div style="font-family:monospace;font-size:22px;font-weight:800;color:#E8692A;letter-spacing:3px">DESCONTO10</div>
        </div>

        <p style="text-align:center;font-size:12px;color:#333;margin-top:14px">
          Oferta válida por tempo limitado
        </p>

      </div>
    </div>

    <div style="text-align:center;margin-top:24px">
      <p style="font-size:12px;color:#333;margin:0 0 6px">Dúvidas? Responda este email.</p>
      <a href="${BASE_URL}" style="font-size:12px;color:#555;text-decoration:none">${BASE_URL}</a>
    </div>

  </div>
</body>
</html>`,
  })
}
