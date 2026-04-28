import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RatoAds',
  description: 'Minere ofertas validadas no Facebook Ads com 1 clique. Encontre o que tá escalando, analise concorrentes e rastreie tudo automaticamente.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
