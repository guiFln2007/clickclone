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

// Minimal wrapper — plain-looking email that lands in Primary inbox
function wrap(body: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.7">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
${body}
  </div>
</body>
</html>`
}

export async function sendWelcomeEmail(email: string, name: string, tempPassword: string) {
  if (!process.env.SMTP_USER) return

  const firstName = name ? name.split(' ')[0] : ''

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu acesso ao RatoAds',
    html: wrap(`
    <p>Fala${firstName ? ` ${firstName}` : ''}! Sua conta no RatoAds foi criada.</p>

    <p>Seus dados de acesso:</p>

    <p style="margin:0"><strong>Login:</strong> ${email}</p>
    <p style="margin:0 0 16px"><strong>Senha:</strong> <code style="background:#f3f3f3;padding:3px 8px;border-radius:4px;font-size:16px;font-weight:bold;color:#E8692A">${tempPassword}</code></p>

    <p><a href="${BASE_URL}/login" style="color:#E8692A;font-weight:bold">Entrar no RatoAds &rarr;</a></p>

    <p style="color:#888;font-size:13px">No primeiro acesso, você pode trocar pra uma senha sua.</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer dúvida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendTrialEmail(email: string, tempPassword: string) {
  if (!process.env.SMTP_USER) return

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu teste grátis do RatoAds',
    html: wrap(`
    <p>Seu teste gratuito do RatoAds tá ativo! Você tem <strong>30 dias</strong> pra testar sem pagar nada.</p>

    <p>Seus dados de acesso:</p>

    <p style="margin:0"><strong>Login:</strong> ${email}</p>
    <p style="margin:0 0 16px"><strong>Senha:</strong> <code style="background:#f3f3f3;padding:3px 8px;border-radius:4px;font-size:16px;font-weight:bold;color:#E8692A">${tempPassword}</code></p>

    <p><a href="${BASE_URL}/login" style="color:#E8692A;font-weight:bold">Entrar no RatoAds &rarr;</a></p>

    <p>O que tá incluso no seu teste:</p>
    <ul style="padding-left:20px;color:#444">
      <li>1 análise completa de oferta</li>
      <li>1 mineração automática</li>
      <li>1 slot de rastreamento</li>
    </ul>

    <p style="color:#888;font-size:13px">Curtiu e quer mais? O plano Starter dá 10 análises, 10 minerações e 5 slots por R$57,90/mês.</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer dúvida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendTrialDiscountEmail(email: string, reason: 'quota' | 'expiring' | 'expired') {
  if (!process.env.SMTP_USER) return

  const subjects: Record<string, string> = {
    quota: 'Sua cota do teste acabou',
    expiring: 'Seu teste acaba em breve',
    expired: 'Seu teste expirou',
  }

  const intros: Record<string, string> = {
    quota: 'Você usou toda sua cota gratuita do RatoAds. Se curtiu o que viu, agora imagina com <strong>10 análises, 10 minerações e 5 slots</strong> todo mês.',
    expiring: 'Seu teste gratuito tá acabando. Não perde o ritmo — assine e continue espionando seus concorrentes sem pausa.',
    expired: 'Seu teste gratuito expirou, mas seus dados ainda tão aqui. Assine e volta de onde parou.',
  }

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subjects[reason],
    html: wrap(`
    <p>${intros[reason]}</p>

    <p>Separei um cupom de <strong>10% de desconto</strong> pra você:</p>

    <p style="text-align:center;margin:24px 0">
      <code style="background:#f3f3f3;padding:10px 24px;border-radius:6px;font-size:22px;font-weight:bold;color:#E8692A;letter-spacing:2px">DESCONTO10</code>
    </p>

    <p>Plano Starter: de <s>R$57,90</s> por <strong>R$52,11/mês</strong>.</p>

    <p><a href="${STARTER_URL}" style="color:#E8692A;font-weight:bold">Assinar com desconto &rarr;</a></p>

    <p style="color:#888;font-size:13px">Usa o cupom DESCONTO10 no checkout.</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer dúvida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendBustedEmail(email: string) {
  if (!process.env.SMTP_USER) return

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Hahaha te peguei',
    html: wrap(`
    <p><strong>Gostou da ferramenta, hein?</strong> haha</p>

    <p>Relaxa, sem julgamento. Se tá tentando criar outra conta é porque curtiu o RatoAds de verdade — e isso me deixa feliz.</p>

    <p>Mas em vez de ficar criando email novo, que tal desbloquear tudo de uma vez? Deixei um cupom especial pra você:</p>

    <p style="text-align:center;margin:24px 0">
      <code style="background:#f3f3f3;padding:10px 24px;border-radius:6px;font-size:22px;font-weight:bold;color:#E8692A;letter-spacing:2px">DESCONTO10</code>
    </p>

    <p>10 análises, 10 minerações, 5 slots de radar. Tudo por <strong>R$52,11/mês</strong>. Sem precisar ficar criando email novo toda hora.</p>

    <p><a href="${STARTER_URL}" style="color:#E8692A;font-weight:bold">Quero o acesso completo &rarr;</a></p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer coisa, responde esse email que a gente se fala.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}
