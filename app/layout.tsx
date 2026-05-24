import type { Metadata } from 'next'
import './globals.css'
import Tracker from './components/Tracker'

export const metadata: Metadata = {
  title: 'RatoAds',
  description: 'Minere ofertas validadas no Facebook Ads com 1 clique. Encontre o que tá escalando, analise concorrentes e rastreie tudo automaticamente.',
  icons: {
    icon: '/rato-mascot.png',
    shortcut: '/rato-mascot.png',
    apple: '/rato-mascot.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" />
        <script src="https://cdn.utmify.com.br/scripts/utms/latest.js" data-utmify-prevent-xcod-sck data-utmify-prevent-subids async defer />
        <script dangerouslySetInnerHTML={{ __html: `window.pixelId="69f26370ea959e0543f1e221";var a=document.createElement("script");a.setAttribute("async","");a.setAttribute("defer","");a.setAttribute("src","https://cdn.utmify.com.br/scripts/pixel/pixel.js");document.head.appendChild(a);` }} />
      </head>
      <body suppressHydrationWarning>
        <Tracker />
        {children}
      </body>
    </html>
  )
}
