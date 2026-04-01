import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RatoAds — Inteligencia Competitiva para Infoprodutores',
  description: 'Encontre, analise e monitore as melhores ofertas do seu nicho automaticamente.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
