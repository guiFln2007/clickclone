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
    <p style="margin:0 0 24px"><img src="${BASE_URL}/logo.png" alt="RatoAds" height="28" style="height:28px;width:auto"/></p>
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
    subject: 'Seu acesso ao RatoAds - comece a minerar agora',
    html: wrap(`
    <p>Seu teste gratuito do RatoAds t&aacute; ativo!</p>

    <p>Seus dados de acesso:</p>

    <p style="margin:0"><strong>Login:</strong> ${email}</p>
    <p style="margin:0 0 16px"><strong>Senha:</strong> <code style="background:#f3f3f3;padding:3px 8px;border-radius:4px;font-size:16px;font-weight:bold;color:#E8692A">${tempPassword}</code></p>

    <p><strong>Pr&oacute;ximo passo:</strong> Fa&ccedil;a sua primeira minera&ccedil;&atilde;o agora.</p>

    <ol style="padding-left:20px;color:#444;line-height:2">
      <li>Acesse o RatoAds e v&aacute; na aba <strong>Minerador</strong></li>
      <li>Digite um nicho (ex: &ldquo;emagrecimento&rdquo;, &ldquo;renda extra&rdquo;)</li>
      <li>Clique em minerar e veja todas as ofertas escaladas do nicho</li>
    </ol>

    <p><a href="${BASE_URL}/login" style="display:inline-block;background:#E8692A;color:#fff;padding:12px 28px;border-radius:8px;font-weight:bold;text-decoration:none;margin:8px 0">Fazer minha primeira minera&ccedil;&atilde;o &rarr;</a></p>

    <p style="color:#888;font-size:13px;margin-top:24px">Voc&ecirc; tem 2 minera&ccedil;&otilde;es + 2 an&aacute;lises gratuitas. Aproveita!</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer d&uacute;vida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendTrialEngageEmail(email: string) {
  if (!process.env.SMTP_USER) return

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Você ainda não minerou nenhum nicho',
    html: wrap(`
    <p>Vi que voc&ecirc; criou sua conta no RatoAds mas ainda n&atilde;o fez sua primeira minera&ccedil;&atilde;o.</p>

    <p>Deixa eu te mostrar como funciona em <strong>30 segundos</strong>:</p>

    <ol style="padding-left:20px;color:#444;line-height:2.2">
      <li>Entra no RatoAds e clica na aba <strong>&ldquo;Minerador&rdquo;</strong></li>
      <li>Digita qualquer nicho: <em>emagrecimento, renda extra, relacionamento...</em></li>
      <li>Clica em <strong>&ldquo;Minerar&rdquo;</strong></li>
    </ol>

    <p>Em 2-3 minutos voc&ecirc; recebe todas as ofertas escaladas daquele nicho no Meta Ads, com score de escalabilidade, dias rodando e link direto.</p>

    <p><a href="${BASE_URL}/login" style="display:inline-block;background:#E8692A;color:#fff;padding:12px 28px;border-radius:8px;font-weight:bold;text-decoration:none;margin:8px 0">Fazer minha primeira minera&ccedil;&atilde;o &rarr;</a></p>

    <p style="color:#888;font-size:13px;margin-top:24px">Voc&ecirc; tem 2 minera&ccedil;&otilde;es gr&aacute;tis. N&atilde;o precisa de cart&atilde;o.</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer d&uacute;vida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendTrialDiscountEmail(email: string, reason: 'quota' | 'expiring' | 'expired') {
  if (!process.env.SMTP_USER) return

  const subjects: Record<string, string> = {
    quota: 'Seus cr\u00e9ditos gratuitos acabaram',
    expiring: '\u26a0 Seu teste acaba em 3 dias',
    expired: '\u00daltima chance: seu teste expirou',
  }

  const intros: Record<string, string> = {
    quota: 'Voc\u00ea usou todas as suas minera\u00e7\u00f5es e an\u00e1lises gratuitas. Curtiu o que viu? Imagina com <strong>10 minera\u00e7\u00f5es + 10 an\u00e1lises</strong> todo m\u00eas.',
    expiring: 'Seu teste gratuito acaba em <strong>3 dias</strong>. Depois disso voc\u00ea perde o acesso. Assine agora e n\u00e3o perde o ritmo.',
    expired: 'Seu teste expirou, mas seus dados ainda t\u00e3o aqui. Assine e volta de onde parou \u2014 antes que eu limpe tudo.',
  }

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subjects[reason],
    html: wrap(`
    <p>${intros[reason]}</p>

    <p>Separei um cupom de <strong>10% de desconto</strong> pra voc&ecirc;:</p>

    <p style="text-align:center;margin:24px 0">
      <code style="background:#f3f3f3;padding:10px 24px;border-radius:6px;font-size:22px;font-weight:bold;color:#E8692A;letter-spacing:2px">DESCONTO10</code>
    </p>

    <p>Plano Starter: de <s>R$57,90</s> por <strong>R$52,11/m&ecirc;s</strong>.</p>

    <p><a href="${STARTER_URL}" style="display:inline-block;background:#E8692A;color:#fff;padding:14px 32px;border-radius:8px;font-weight:bold;text-decoration:none;margin:8px 0">Assinar com desconto &rarr;</a></p>

    <p style="color:#888;font-size:13px">Usa o cupom DESCONTO10 no checkout.</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer d&uacute;vida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendTrialUpgradeEmail(email: string) {
  if (!process.env.SMTP_USER) return

  await transporter.sendMail({
    from: `"RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu teste foi atualizado!',
    html: wrap(`
    <p>Boas novas! Atualizamos o plano de teste gratuito do RatoAds.</p>

    <p>Agora você tem:</p>
    <ul style="padding-left:20px;color:#444">
      <li><strong>3 análises</strong> completas (era 1)</li>
      <li><strong>3 minerações</strong> automáticas (era 1)</li>
      <li><strong>3 slots</strong> de rastreamento (era 1)</li>
    </ul>

    <p>Se você já tinha usado sua cota, restauramos os créditos extras. Aproveita!</p>

    <p><a href="${BASE_URL}/login" style="color:#E8692A;font-weight:bold">Entrar no RatoAds &rarr;</a></p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer dúvida, responde esse email.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}

export async function sendRecoveryBlastEmail(email: string) {
  if (!process.env.SMTP_USER) return

  await transporter.sendMail({
    from: `"Guilherme do RatoAds" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Cupom de 50% — só até amanhã',
    html: wrap(`
    <p>Fala! Aqui é o Guilherme, fundador do RatoAds.</p>

    <p>Você testou a plataforma um tempo atrás, e desde então <strong>muita coisa mudou</strong>:</p>

    <ul style="padding-left:20px;color:#444;line-height:2.2">
      <li><strong>Mineração automática</strong> — encontra todas as ofertas escaladas de qualquer nicho em minutos</li>
      <li><strong>Análise de funil completa</strong> — criativos, copy, página, estratégia de tráfego</li>
      <li><strong>Radar de ofertas</strong> — rastreia concorrentes e te avisa quando mudam algo</li>
    </ul>

    <p>Como você já conhece a ferramenta, separei um cupom exclusivo de <strong>50% no primeiro mês</strong>:</p>

    <p style="text-align:center;margin:24px 0">
      <code style="background:#f3f3f3;padding:10px 24px;border-radius:6px;font-size:22px;font-weight:bold;color:#E8692A;letter-spacing:2px">BOASVINDAS50</code>
    </p>

    <p>Plano Starter: de <s>R$57,90</s> por <strong>R$27,90</strong> no primeiro mês.</p>

    <p><a href="${STARTER_URL}" style="display:inline-block;background:#E8692A;color:#fff;padding:14px 32px;border-radius:8px;font-weight:bold;text-decoration:none;margin:8px 0">Assinar com 50% off &rarr;</a></p>

    <p style="color:#e55;font-size:13px;font-weight:bold">Cupom válido só até amanhã.</p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer dúvida, responde esse email.<br>
    &mdash; Guilherme, RatoAds</p>
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

    <p>10 minera&ccedil;&otilde;es, 10 an&aacute;lises, 10 slots de radar. Tudo por <strong>R$52,11/m&ecirc;s</strong>. Sem precisar ficar criando email novo toda hora.</p>

    <p><a href="${STARTER_URL}" style="color:#E8692A;font-weight:bold">Quero o acesso completo &rarr;</a></p>

    <p style="margin-top:32px;color:#888;font-size:13px">Qualquer coisa, responde esse email que a gente se fala.<br>
    &mdash; Equipe RatoAds</p>
    `),
  })
}
