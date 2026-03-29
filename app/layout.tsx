import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ClickClone — Analise. Clone. Bata o concorrente.',
  description: 'Cole o link da biblioteca de anúncios e receba análise completa + página de vendas pronta.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
