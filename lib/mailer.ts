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

export async function sendWelcomeEmail(email: string, name: string) {
  if (!process.env.SMTP_USER) return // skip if not configured

  await transporter.sendMail({
    from: `"ClickClone" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Bem-vindo ao ClickClone! 🎉',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
        <h2 style="margin-top:0">Olá${name ? ', ' + name : ''}!</h2>
        <p>Seu acesso ao ClickClone está ativo. Você começa com:</p>
        <ul>
          <li>20 análises de páginas</li>
          <li>100 créditos de edição</li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_URL || 'https://clickclone.com.br'}/tool"
              style="background:#E8692A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Acessar agora →
        </a></p>
        <p style="color:#666;font-size:13px">Dúvidas? Fale no WhatsApp.</p>
      </div>
    `,
  })
}
