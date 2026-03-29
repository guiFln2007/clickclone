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

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://clickclone.com.br'

export async function sendWelcomeEmail(email: string, name: string, tempPassword: string) {
  if (!process.env.SMTP_USER) return // skip if not configured

  await transporter.sendMail({
    from: `"ClickClone" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Seu acesso ao ClickClone está pronto! 🎉',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;background:#fff;padding:32px;border-radius:12px">
        <h2 style="margin-top:0;color:#E8692A">Olá${name ? ', ' + name : ''}! 👋</h2>
        <p style="color:#444">Seu acesso ao ClickClone foi ativado. Use os dados abaixo para entrar:</p>

        <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #E8692A">
          <p style="margin:0 0 8px 0;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.5px">Seus dados de acesso</p>
          <p style="margin:4px 0"><strong>Login:</strong> ${email}</p>
          <p style="margin:4px 0"><strong>Senha temporária:</strong> <code style="background:#e0e0e0;padding:2px 6px;border-radius:4px;font-size:15px">${tempPassword}</code></p>
        </div>

        <p style="color:#666;font-size:13px">
          ⚠️ No primeiro acesso você poderá definir sua senha permanente.<br>
          Basta fazer login com a senha acima e digitar a nova senha que quiser.
        </p>

        <p style="color:#444">Você começa com:</p>
        <ul style="color:#444">
          <li>✅ 10 análises de concorrentes</li>
          <li>✅ 100 créditos de edição</li>
          <li>✅ Geração ilimitada de páginas</li>
        </ul>

        <a href="${BASE_URL}/login"
           style="display:inline-block;background:#E8692A;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:8px">
          Fazer login agora →
        </a>

        <p style="color:#999;font-size:12px;margin-top:24px">
          Dúvidas? Responda este email ou fale no WhatsApp.<br>
          <a href="${BASE_URL}/login" style="color:#E8692A">${BASE_URL}/login</a>
        </p>
      </div>
    `,
  })
}
