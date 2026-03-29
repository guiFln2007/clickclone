'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL || 'https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9'

const USERS = [
  { img: 'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8477-1-scaled.jpg', name: 'Lucas Ferreira', role: 'Produtor low ticket', quote: 'Analisei 3 concorrentes em 10 minutos. Lancei no mesmo dia com a página já modelada.' },
  { img: 'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8481-1-scaled.jpg', name: 'Marina Costa', role: 'Afiliada Meta Ads', quote: 'Antes eu ficava chutando se a oferta valia. Agora eu sei antes de gastar R$1.' },
  { img: 'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8479-1-scaled.jpg', name: 'Rafael Souza', role: 'Gestor de tráfego', quote: 'Entrego análise + landing page pro cliente em 15 minutos. Mudou meu serviço.' },
  { img: 'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8483-1-scaled.jpg', name: 'Ana Lima', role: 'Produtora de conteúdo', quote: 'Os scripts de CTV que ele gera são melhores do que eu escrevia em 1 hora.' },
  { img: 'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8480-1-scaled.jpg', name: 'Pedro Alves', role: 'Empreendedor digital', quote: 'Score 8/10, entrei na oferta, validei em 3 dias. Processo simples demais.' },
  { img: 'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8484-1-scaled.jpg', name: 'Juliana Neves', role: 'Criadora de produtos', quote: 'A página gerada já sai corrigindo os pontos fracos do concorrente. Inteligente.' },
]

const RESULTS = [
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8529.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8528.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8527.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8526.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8525.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8524.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8523.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8522.JPG-1.jpeg',
  'https://lp.thecopypocket.com/wp-content/uploads/2026/02/IMG_8521.JPG-1.jpeg',
]

const CYCLE_WORDS = ['anúncios', 'ofertas', 'páginas', 'campanhas']

const TERMINAL_LINES = [
  { delay: 0,    text: '> Conectando à biblioteca de anúncios...', color: '#555' },
  { delay: 800,  text: '✓ 47 anúncios ativos encontrados', color: '#FF8C00' },
  { delay: 1600, text: '> Analisando página do concorrente...', color: '#555' },
  { delay: 2400, text: '✓ Score: 8/10 — Vale entrar', color: '#FF8C00' },
  { delay: 3000, text: '✓ Ângulo: Praticidade + urgência sazonal', color: '#FF8C00' },
  { delay: 3600, text: '✓ 4 pontos fracos identificados', color: '#FF8C00' },
  { delay: 4200, text: '> Gerando página de vendas...', color: '#555' },
  { delay: 5000, text: '✓ Página HTML pronta. Abrindo editor_', color: '#fff' },
]

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 56 : 44
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="clickclone_" style={{ display: 'block', height: h, width: 'auto' }} />
}

function Terminal() {
  const [lines, setLines] = useState<typeof TERMINAL_LINES>([])
  const [loop, setLoop] = useState(0)

  useEffect(() => {
    setLines([])
    const timers = TERMINAL_LINES.map((l) =>
      setTimeout(() => setLines(prev => [...prev, l]), l.delay)
    )
    const reset = setTimeout(() => setLoop(l => l + 1), 7000)
    return () => { timers.forEach(clearTimeout); clearTimeout(reset) }
  }, [loop])

  return (
    <div style={{ background: '#080808', border: '1px solid #1c1c1c', borderRadius: 12, overflow: 'hidden', width: '100%', maxWidth: 520, margin: '0 auto', boxShadow: '0 32px 80px rgba(255,140,0,.08)' }}>
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a1a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: '#444', marginLeft: 8 }}>/clickclone — análise</span>
      </div>
      <div style={{ padding: '20px', height: 290, overflow: 'hidden', fontFamily: "'Courier New',monospace", fontSize: 13, lineHeight: 1.9 }}>
        <div style={{ color: '#333', marginBottom: 8 }}>$ clickclone analyze --url=&quot;facebook.com/ads/library...&quot;</div>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.color, animation: 'fadein .3s ease' }}>{l.text}</div>
        ))}
        {lines.length > 0 && lines.length < TERMINAL_LINES.length && (
          <span style={{ display: 'inline-block', width: 8, height: 14, background: '#FF8C00', animation: 'blink .7s step-end infinite', verticalAlign: 'middle' }} />
        )}
      </div>
      {/* always rendered — opacity transition prevents layout shift */}
      <div style={{ borderTop: '1px solid #111', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, background: '#050505', opacity: lines.length === TERMINAL_LINES.length ? 1 : 0, transition: 'opacity .4s ease' }}>
        <div style={{ flex: 1, height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: lines.length === TERMINAL_LINES.length ? '80%' : '0%', height: '100%', background: 'linear-gradient(90deg,#FF8C00,#ff9966)', borderRadius: 2, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
        </div>
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 12, color: '#FF8C00', fontWeight: 700, whiteSpace: 'nowrap' }}>8/10 ✓</span>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [cycleWord, setCycleWord] = useState('ofertas')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [step, setStep] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [tcIdx, setTcIdx] = useState(0)
  const resScrollRef = useRef<HTMLDivElement>(null)

  // Word cycle — starts with 'ofertas' already displayed, erases after 2s then cycles
  useEffect(() => {
    const startIdx = CYCLE_WORDS.indexOf('ofertas')
    let wi = startIdx, ci = CYCLE_WORDS[startIdx].length, typing = false
    let t: ReturnType<typeof setTimeout>
    const cycle = () => {
      const word = CYCLE_WORDS[wi]
      if (typing) { ci++; setCycleWord(word.slice(0, ci)); if (ci >= word.length) { typing = false; t = setTimeout(cycle, 2000) } else t = setTimeout(cycle, 90) }
      else { ci--; setCycleWord(word.slice(0, ci)); if (ci <= 0) { typing = true; wi = (wi + 1) % CYCLE_WORDS.length; t = setTimeout(cycle, 300) } else t = setTimeout(cycle, 60) }
    }
    const b = setInterval(() => setCursorVisible(v => !v), 530)
    t = setTimeout(cycle, 2200) // wait 2.2s before starting to erase
    return () => { clearTimeout(t); clearInterval(b) }
  }, [])

  // Scroll reveals — unobserve after visible so re-renders don't cause flicker
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
      }),
      { threshold: 0.06 }
    )
    document.querySelectorAll('.sr,.sr-l,.sr-r').forEach(el => {
      if (!el.classList.contains('in')) io.observe(el)
    })
    return () => io.disconnect()
  }, [showPreview])

  // Nav scroll effect
  useEffect(() => {
    const nav = document.querySelector('nav')
    const onScroll = () => {
      if (window.scrollY > 40) nav?.classList.add('nav-scrolled')
      else nav?.classList.remove('nav-scrolled')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // FAQ
  useEffect(() => {
    document.querySelectorAll('.fq').forEach(item => {
      item.querySelector('.fq-q')?.addEventListener('click', () => {
        const open = item.classList.contains('open')
        document.querySelectorAll('.fq').forEach(i => i.classList.remove('open'))
        if (!open) item.classList.add('open')
      })
    })
  }, [])

  // Carousel auto-advance — testimonials
  useEffect(() => {
    const t = setInterval(() => setTcIdx(i => (i + 1) % USERS.length), 4500)
    return () => clearInterval(t)
  }, [])

  function resScroll(dir: 1 | -1) {
    const el = resScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.offsetWidth, behavior: 'smooth' })
  }

  async function handleDemo(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setAnalyzing(true); setStep(0)
    for (let i = 0; i < 3; i++) { await new Promise(r => setTimeout(r, 900)); setStep(i + 1) }
    setAnalyzing(false); setShowPreview(true)
    setTimeout(() => document.getElementById('pv')?.scrollIntoView({ behavior: 'smooth' }), 150)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Roboto',Helvetica,sans-serif;background:#000;color:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}

        .sr{opacity:0;transform:translateY(28px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1)}
        .sr-l{opacity:0;transform:translateX(-36px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1)}
        .sr-r{opacity:0;transform:translateX(36px);transition:opacity .65s cubic-bezier(.16,1,.3,1),transform .65s cubic-bezier(.16,1,.3,1)}
        .sr.in,.sr-l.in,.sr-r.in{opacity:1;transform:translate(0)}

        @keyframes glowStrong{0%{opacity:.55}25%{opacity:.3}50%{opacity:.45}75%{opacity:.2}100%{opacity:.04}}
        @keyframes glowSoft{0%{opacity:.4}20%{opacity:.12}45%{opacity:.32}70%{opacity:.15}100%{opacity:.04}}
        @keyframes noisemove{0%{background-position:0 0}16%{background-position:-60px -30px}33%{background-position:40px 55px}50%{background-position:-30px 70px}66%{background-position:65px -40px}83%{background-position:-50px 20px}100%{background-position:0 0}}
        @keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes grow{from{width:0}to{width:80%}}
        @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}
        @keyframes tk{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes gp{0%,100%{box-shadow:0 0 0 0 rgba(255,140,0,0)}50%{box-shadow:0 0 36px 8px rgba(255,140,0,.2)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}

        /* NAV */
        nav{position:fixed;top:0;left:0;right:0;z-index:200;height:64px;display:flex;align-items:center;padding:0 32px;background:linear-gradient(to bottom,rgba(0,0,0,.88) 0%,transparent 100%);transition:background .35s ease,border-color .35s ease;border-bottom:1px solid transparent;transform:translateZ(0);-webkit-transform:translateZ(0);will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden}
        nav.nav-scrolled{background:rgba(6,6,6,.95);border-bottom-color:rgba(255,255,255,.07)}
        @media(min-width:641px){nav.nav-scrolled{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(0,0,0,.78)}}
        @media(max-width:640px){nav{padding:0 18px;height:58px}.footer-logo{display:none!important}}
        .nav-logo{display:flex;align-items:center}.nav-logo img{height:32px;width:auto;display:block}
        .nav-r{display:flex;gap:8px;align-items:center;margin-left:auto}
        @media(max-width:480px){.nav-hide-mobile{display:none}}
        .btn-nav-ghost{padding:8px 14px;font-size:13px;font-weight:500;background:transparent;color:#bbb;border:none;letter-spacing:.01em;white-space:nowrap;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(255,255,255,.2)}
        .btn-nav-ghost:hover{color:#fff;text-decoration-color:rgba(255,255,255,.5)}
        .btn-nav-cta{padding:9px 18px;font-size:13px;font-weight:700;background:#FF8C00;color:#fff;border-radius:6px;letter-spacing:.01em;white-space:nowrap}
        .btn-nav-cta:hover{background:#ff9f1a}

        /* BUTTONS */
        .btn{display:inline-flex;align-items:center;gap:8px;font-family:inherit;font-weight:700;border-radius:6px;border:none;text-decoration:none;position:relative;overflow:hidden;transition:all .2s cubic-bezier(.16,1,.3,1)}
        .btn::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.09) 50%,transparent 60%);transform:translateX(-100%);transition:transform .5s ease}
        .btn:hover::after{transform:translateX(100%)}
        .btn-ghost{padding:9px 18px;font-size:13px;background:transparent;color:#aaa;border:none}
        .btn-ghost:hover{color:#fff}
        .btn-orange{padding:16px 32px;font-size:15px;background:#FF8C00;color:#fff}
        .btn-orange:hover{transform:translateY(-2px);box-shadow:0 8px 40px rgba(255,140,0,.4)}
        .btn-orange-lg{padding:20px 48px;font-size:17px;background:#FF8C00;color:#fff;border-radius:8px}
        .btn-orange-lg:hover{transform:translateY(-2px);box-shadow:0 12px 48px rgba(255,140,0,.4)}
        .glow{animation:gp 3s ease-in-out infinite}

        /* LAYOUT */
        section{padding:96px 28px;position:relative;z-index:1}
        .wrap{max-width:900px;margin:0 auto}
        .wrap-w{max-width:1120px;margin:0 auto}
        hr{border:none;border-top:1px solid #111}

        /* SECTION HEADER — centered with symmetric lines */
        .sec-hd{text-align:center;margin-bottom:52px}
        .sec-label{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px}
        .sec-label::before,.sec-label::after{content:'';width:24px;height:1px;background:#FF8C00;flex-shrink:0}
        .sec-label span{color:#FF8C00;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
        h2.title{font-size:clamp(28px,4vw,50px);font-weight:900;line-height:1.1;letter-spacing:-.03em}
        h2.title .acc{color:#FF8C00}
        h2.title .dim{color:#252525}

        /* BADGE */
        .badge{display:inline-flex;align-items:center;gap:7px;background:rgba(255,140,0,.09);border:1px solid rgba(255,140,0,.2);color:#FF8C00;font-size:11px;font-weight:700;padding:5px 13px;border-radius:100px;letter-spacing:.06em;text-transform:uppercase}
        .bdot{width:6px;height:6px;background:#FF8C00;border-radius:50%;animation:pdot 1.5s ease-in-out infinite}

        /* DYNAMIC BG GLOW — fixed, behind everything */
        .bg-glow{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
        .bg-glow-1{position:absolute;top:-220px;left:-580px;width:1400px;height:200px;background:linear-gradient(90deg,#FFD0B6,transparent);border-radius:9999px;transform:rotate(43deg);mix-blend-mode:screen;animation:glowStrong 8s ease-in-out infinite alternate}
        .bg-glow-2{position:absolute;top:-300px;left:-680px;width:1800px;height:290px;background:linear-gradient(90deg,#F16517,transparent);border-radius:9999px;transform:rotate(40deg);mix-blend-mode:screen;animation:glowSoft 9.5s ease-in-out infinite alternate}

        /* NOISE GRAIN — only inside hero, behind content */
        .noise{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.18;mix-blend-mode:plus-lighter;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:250px 250px;animation:noisemove .45s steps(1) infinite}

        /* HERO — centered single column */
        .hero{min-height:100svh;display:flex;align-items:center;padding:80px 28px 60px;position:relative;overflow:hidden;text-align:center}
        .hero-inner{max-width:780px;margin:0 auto;width:100%;position:relative;z-index:1}
        .hero-h1{font-size:clamp(36px,5.5vw,64px);font-weight:900;line-height:1.05;letter-spacing:-.04em;margin-bottom:20px}
        .hero-h1 .acc{color:#FF8C00}
        .word-wrap{color:#FF8C00;font-style:italic;display:inline-block;min-width:10px}
        .hero-sub{font-size:16px;color:#888;line-height:1.8;margin-bottom:36px;max-width:520px;margin-left:auto;margin-right:auto}
        .tcur{display:inline-block;width:2px;height:.82em;background:#FF8C00;margin-left:1px;vertical-align:middle}
        .hero-terminal{margin-top:48px;animation:floaty 5s ease-in-out infinite}

        /* DEMO INPUT */
        .demo-box{display:flex;background:#090909;border:1px solid #1c1c1c;border-radius:10px;overflow:hidden;transition:border-color .2s,box-shadow .2s;max-width:540px;margin:0 auto}
        .demo-box:focus-within{border-color:#FF8C00;box-shadow:0 0 0 3px rgba(255,140,0,.1)}
        .demo-in{flex:1;background:transparent;border:none;outline:none;padding:14px 16px;font-size:12.5px;color:#fff;font-family:inherit;min-width:0}
        .demo-in::placeholder{color:#2e2e2e}
        .demo-sub{background:#FF8C00;border:none;color:#fff;font-weight:700;font-size:13px;padding:0 18px;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .15s}
        .demo-sub:hover{background:#ff6a40}
        .demo-sub:disabled{opacity:.4}
        .st-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:9px;justify-content:center}
        .st{display:flex;align-items:center;gap:5px;font-size:11.5px;color:#2e2e2e;transition:color .3s}
        .st.done{color:#FF8C00}.st.act{color:#ccc}
        .std{width:6px;height:6px;border-radius:50%;background:#1a1a1a;flex-shrink:0;transition:background .3s}
        .st.done .std{background:#FF8C00}.st.act .std{background:#ccc;animation:pdot 1s infinite}

        /* TICKER */
        .ticker{overflow:hidden;padding:16px 0;background:#040404;border-top:1px solid #111;border-bottom:1px solid #111}
        .tk-in{display:flex;gap:56px;width:max-content;animation:tk 22s linear infinite}
        .tk-in:hover{animation-play-state:paused}
        .tk-i{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#2e2e2e;white-space:nowrap}
        .tk-i .hl{color:#FF8C00;font-weight:700}

        /* STEPS */
        .steps-g{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#111;border:1px solid #111;border-radius:14px;overflow:hidden}
        @media(max-width:640px){.steps-g{grid-template-columns:1fr}}
        .step-c{background:#000;padding:40px 28px;text-align:center;transition:background .2s}
        .step-c:hover{background:#080808}
        .step-n{font-size:10.5px;font-weight:700;color:#FF8C00;letter-spacing:.1em;margin-bottom:20px}
        .step-num{width:40px;height:40px;border-radius:50%;border:1px solid #1c1c1c;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#FF8C00;margin:0 auto 18px;font-family:'Courier New',monospace}
        .step-t{font-size:17px;font-weight:800;margin-bottom:8px}
        .step-d{font-size:13px;color:#888;line-height:1.75}

        /* FEATURES */
        .feat-g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        @media(max-width:768px){.feat-g{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:480px){.feat-g{grid-template-columns:1fr}}
        .feat-c{background:#080808;border:1px solid #111;border-radius:12px;padding:28px 22px;text-align:center;transition:border-color .25s,transform .25s,box-shadow .25s}
        .feat-c:hover{border-color:rgba(255,140,0,.28);transform:translateY(-4px);box-shadow:0 18px 56px rgba(0,0,0,.5)}
        .feat-mark{width:36px;height:36px;border-radius:8px;border:1px solid #1c1c1c;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
        .feat-mark svg{width:16px;height:16px;stroke:#FF8C00;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
        .feat-t{font-size:15px;font-weight:700;margin-bottom:7px}
        .feat-d{font-size:13px;color:#888;line-height:1.75}

        /* CAROUSEL */
        .car-outer{max-width:640px;margin:0 auto;position:relative;padding:0 52px}
        @media(max-width:600px){.car-outer{padding:0 40px}}
        .car-clip{overflow:hidden;border-radius:14px}
        .car-track{display:flex;transition:transform .5s cubic-bezier(.16,1,.3,1)}
        .car-slide{min-width:100%;padding:0 4px}
        .testi-c{background:#080808;border:1px solid #111;border-radius:14px;padding:28px 24px;display:flex;flex-direction:column;gap:16px}
        .testi-stars{display:flex;gap:3px}
        .testi-star{color:#FF8C00;font-size:13px}
        .testi-q{font-size:15px;color:#ccc;line-height:1.8;font-style:italic}
        .testi-user{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid #0f0f0f;margin-top:auto}
        .testi-av{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #1a1a1a;flex-shrink:0}
        .testi-name{font-size:13.5px;font-weight:700;line-height:1.3}
        .testi-role{font-size:11.5px;color:#777;margin-top:2px}
        .car-btn{position:absolute;top:50%;transform:translateY(-50%);background:#0d0d0d;border:1px solid #1c1c1c;color:#fff;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;transition:border-color .2s,background .2s;padding:0;flex-shrink:0}
        .car-btn:hover{border-color:#FF8C00;background:#111}
        .car-btn-l{left:0}.car-btn-r{right:0}
        .car-dots{display:flex;gap:7px;justify-content:center;margin-top:20px}
        .car-dot{width:5px;height:5px;border-radius:50%;background:#222;transition:background .3s,transform .3s,width .3s}
        .car-dot.on{background:#FF8C00;width:18px;border-radius:3px}

        /* RESULTS CAROUSEL */
        .res-car{position:relative}
        .res-scroll{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:0}
        .res-scroll::-webkit-scrollbar{display:none}
        .res-scroll-item{scroll-snap-align:start;flex-shrink:0;min-width:calc(100% / 3);padding:0 5px}
        .res-scroll-item:first-child{padding-left:0}
        .res-scroll-item:last-child{padding-right:0}
        @media(max-width:600px){.res-scroll-item{min-width:100%;padding:0}}
        .res-scroll-item{background:#0a0a0a}
        .res-img{width:100%;max-height:52vh;border-radius:10px;border:1px solid #111;object-fit:contain;display:block;transition:transform .3s,box-shadow .3s,border-color .3s}
        .res-img:hover{transform:scale(1.04) translateY(-4px);box-shadow:0 20px 48px rgba(255,140,0,.12);border-color:rgba(255,140,0,.2)}
        @media(max-width:600px){.res-img{max-height:58vh}}
        .res-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:24px}
        .res-nav-btn{background:#0d0d0d;border:1px solid #1c1c1c;color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;transition:border-color .2s,background .2s;padding:0;flex-shrink:0}
        .res-nav-btn:hover{border-color:#FF8C00;background:#111}

        /* PREVIEW */
        .pv-wrap{position:relative;border-radius:16px;overflow:hidden;border:1px solid #1c1c1c;max-width:820px;margin:0 auto}
        .pv-blur{filter:blur(7px);user-select:none;pointer-events:none;background:#070707;padding:28px}
        .pv-over{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.55) 28%,rgba(0,0,0,.97) 58%);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:40px 28px 48px;text-align:center}
        .mock-sc{display:flex;align-items:center;gap:20px;background:#050505;border:1px solid #0f0f0f;border-radius:12px;padding:18px;margin-bottom:10px}
        .mock-n{font-size:50px;font-weight:900;color:#FF8C00;line-height:1}
        .mock-b{height:5px;border-radius:3px;background:#111;overflow:hidden;margin-top:7px}
        .mock-bf{height:100%;background:linear-gradient(90deg,#FF8C00,#ff9966);border-radius:3px}
        .mock-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #0c0c0c}
        .mock-row:last-child{border-bottom:none}
        .mock-ic{width:26px;height:26px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#333;flex-shrink:0;font-family:'Courier New',monospace}
        .mline{height:10px;border-radius:3px;background:linear-gradient(90deg,#111 25%,#181818 50%,#111 75%);background-size:400px 100%;animation:shimmer 2s infinite}

        /* PRICING */
        .price-c{background:#070707;border:1px solid #1c1c1c;border-radius:16px;padding:42px;position:relative;overflow:hidden}
        .price-c::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#FF8C00,transparent)}
        .price-am{font-size:58px;font-weight:900;letter-spacing:-.04em;line-height:1}
        .pf{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #0c0c0c;font-size:13.5px}
        .pf:last-of-type{border-bottom:none}
        .pc{color:#FF8C00;font-size:13px;flex-shrink:0}

        /* FAQ */
        .fq{border-bottom:1px solid #111}
        .fq-q{display:flex;justify-content:space-between;align-items:center;padding:22px 0;gap:16px}
        .fq-q span:first-child{font-weight:600;font-size:14.5px}
        .fq-ic{color:#FF8C00;font-size:22px;flex-shrink:0;transition:transform .35s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-ic{transform:rotate(45deg)}
        .fq-a{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-a{max-height:180px}
        .fq-a p{font-size:13.5px;color:#888;line-height:1.8;padding-bottom:20px}

        @media(max-width:640px){section{padding:72px 20px}nav{padding:0 20px}.btn-orange-lg{padding:16px 28px;font-size:15px}}
      `}</style>

      {/* DYNAMIC BACKGROUND GLOW */}
      <div className="bg-glow" aria-hidden>
        <div className="bg-glow-1" />
        <div className="bg-glow-2" />
      </div>
      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <Link href="/"><Logo size="sm" /></Link>
        </div>
        <div className="nav-r">
          <a href="#como-funciona" className="btn btn-nav-ghost nav-hide-mobile">Como funciona</a>
          <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-nav-cta">Começar →</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="noise" aria-hidden />
        <div className="hero-inner">
          <h1 className="hero-h1" style={{ marginTop: 0 }}>
            Analise <span className="word-wrap">{cycleWord}<span className="tcur" style={{ opacity: cursorVisible ? 1 : 0 }} /></span><br />
            do concorrente.<br />Clone o que <span className="acc">funciona.</span>
          </h1>
          <p className="hero-sub">
            Cole o link da biblioteca de anúncios. Em minutos você recebe análise completa + página de vendas modelada e pronta pra editar.
          </p>
          <form onSubmit={handleDemo} style={{ marginBottom: 10 }}>
            <div className="demo-box">
              <input className="demo-in" type="url" placeholder="https://www.facebook.com/ads/library/?...view_all_page_id=..." value={url} onChange={e => setUrl(e.target.value)} />
              <button className="demo-sub" type="submit" disabled={analyzing || !url.trim()}>
                {analyzing
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite', display: 'inline-block' }} />...</span>
                  : 'Analisar →'}
              </button>
            </div>
            {analyzing && (
              <div className="st-row">
                {['Raspando anúncios', 'Analisando página', 'Gerando preview'].map((s, i) => (
                  <div key={s} className={`st ${step > i ? 'done' : step === i ? 'act' : ''}`}>
                    <div className="std" />{s}{i < 2 && <span style={{ color: '#1a1a1a', marginLeft: 4 }}>›</span>}
                  </div>
                ))}
              </div>
            )}
            {!analyzing && !showPreview && <p style={{ fontSize: 11, color: '#222', marginTop: 8 }}>Sem cadastro · ~2 minutos · Apify + Claude</p>}
          </form>
          <div className="hero-terminal sr">
            <Terminal />
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="ticker">
        <div className="tk-in">
          {[...Array(2)].flatMap((_, r) => [
            <div key={`${r}a`} className="tk-i"><span>✦</span><span className="hl">2 min</span> por análise</div>,
            <div key={`${r}b`} className="tk-i"><span>✦</span><span className="hl">30+</span> anúncios raspados</div>,
            <div key={`${r}c`} className="tk-i"><span>✦</span>Score <span className="hl">1–10</span> da oferta</div>,
            <div key={`${r}d`} className="tk-i"><span>✦</span><span className="hl">3</span> scripts de CTV</div>,
            <div key={`${r}e`} className="tk-i"><span>✦</span>Chat ao vivo <span className="hl">estilo Lovable</span></div>,
            <div key={`${r}f`} className="tk-i"><span>✦</span>Powered by <span className="hl">Claude + Apify</span></div>,
          ])}
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <section id="como-funciona">
        <div className="wrap">
          <div className="sec-hd sr">
            <div className="sec-label"><span>Processo</span></div>
            <h2 className="title">Do link à página<br /><span className="acc">em 3 passos</span></h2>
          </div>
          <div className="steps-g sr">
            {[
              { n: '01', t: 'Cola o link', d: 'Vai na biblioteca de anúncios do Meta, abre o perfil do concorrente e copia a URL. A que tem view_all_page_id no final.' },
              { n: '02', t: 'IA analisa tudo', d: 'Apify raspa os anúncios. Claude analisa a página deles: ângulo dominante, pontos fracos, oportunidades e scripts de CTV.' },
              { n: '03', t: 'Edita via chat', d: 'Editor ao vivo estilo Lovable. Digita o que quer mudar — copy, cores, preço — e a IA atualiza em segundos.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="step-c">
                <div className="step-num">{n}</div>
                <div className="step-t">{t}</div>
                <div className="step-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr />

      {/* FEATURES */}
      <section>
        <div className="wrap">
          <div className="sec-hd sr">
            <div className="sec-label"><span>O que você recebe</span></div>
            <h2 className="title">Tudo que você precisa<br /><span className="acc">pra entrar na oferta</span></h2>
          </div>
          <div className="feat-g">
            {[
              { icon: <><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>, t: 'Score (1–10)', d: 'Vale entrar ou não? Volume de ads, tempo no ar, presença de expert — calculado antes de você gastar R$1.' },
              { icon: <><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>, t: 'Ângulo dominante', d: 'Qual gatilho o concorrente usa: praticidade, urgência, identidade. A IA identifica e nomeia.' },
              { icon: <><path d="M11 17a1 1 0 0 0 2 0m-1-14v3M5.6 5.6l2.1 2.1M3 12h3m15 0h-3M5.6 18.4l2.1-2.1M18.4 5.6l-2.1 2.1M18.4 18.4l-2.1-2.1"/></>, t: '4 pontos fracos', d: 'O que a página deles erra. Sua página vai sair corrigindo cada um desses pontos.' },
              { icon: <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>, t: '3 scripts de CTV', d: 'Hook + ângulo + roteiro de 3–4 linhas prontos pra filmar e testar.' },
              { icon: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>, t: 'Página HTML gerada', d: 'Estrutura modelada no concorrente com copy melhorada e pontos fracos corrigidos.' },
              { icon: <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>, t: 'Chat ao vivo', d: 'Editor estilo Lovable. Digita o que quer mudar, a IA atualiza a página em segundos.' },
            ].map(({ icon, t, d }, i) => (
              <div key={t} className={`feat-c ${i % 2 === 0 ? 'sr-l' : 'sr-r'}`}>
                <div className="feat-mark">
                  <svg viewBox="0 0 24 24">{icon}</svg>
                </div>
                <div className="feat-t">{t}</div>
                <div className="feat-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr />

      {/* TESTIMONIALS — carrossel */}
      <section>
        <div className="wrap">
          <div className="sec-hd sr">
            <div className="sec-label"><span>Quem usa</span></div>
            <h2 className="title">Produtores que já<br /><span className="acc">analisam com ClickClone</span></h2>
          </div>
          <div className="car-outer sr">
            <div className="car-clip">
              <div className="car-track" style={{ transform: `translateX(-${tcIdx * 100}%)` }}>
                {USERS.map((u, i) => (
                  <div key={i} className="car-slide">
                    <div className="testi-c">
                      <div className="testi-stars">
                        {[...Array(5)].map((_, s) => <span key={s} className="testi-star">★</span>)}
                      </div>
                      <p className="testi-q">&ldquo;{u.quote}&rdquo;</p>
                      <div className="testi-user">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.img} alt={u.name} className="testi-av" />
                        <div>
                          <div className="testi-name">{u.name}</div>
                          <div className="testi-role">{u.role}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button className="car-btn car-btn-l btn" onClick={() => setTcIdx(i => (i - 1 + USERS.length) % USERS.length)}>‹</button>
            <button className="car-btn car-btn-r btn" onClick={() => setTcIdx(i => (i + 1) % USERS.length)}>›</button>
            <div className="car-dots">
              {USERS.map((_, i) => <div key={i} className={`car-dot${i === tcIdx ? ' on' : ''}`} onClick={() => setTcIdx(i)} />)}
            </div>
          </div>
        </div>
      </section>

      <hr />

      {/* RESULTS */}
      <section>
        <div className="wrap-w">
          <div className="sec-hd sr" style={{ maxWidth: 900, margin: '0 auto 48px' }}>
            <div className="sec-label"><span>Resultados</span></div>
            <h2 className="title">Campanhas que<br /><span className="acc">convertem de verdade</span></h2>
            <p style={{ marginTop: 14, fontSize: 15, color: '#444', lineHeight: 1.75 }}>O mesmo processo que gerou esses resultados agora está nas suas mãos.</p>
          </div>
          <div className="res-car sr">
            <div className="res-scroll" ref={resScrollRef}>
              {RESULTS.map((r, i) => (
                <div key={i} className="res-scroll-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r} alt="" className="res-img" />
                </div>
              ))}
            </div>
            <div className="res-nav">
              <button className="res-nav-btn btn" onClick={() => resScroll(-1)}>‹</button>
              <button className="res-nav-btn btn" onClick={() => resScroll(1)}>›</button>
            </div>
          </div>
        </div>
      </section>

      <hr />

      {/* PREVIEW BORRADO */}
      {showPreview && (
        <section id="pv" style={{ paddingTop: 56 }}>
          <div className="wrap">
            <div className="sr" style={{ textAlign: 'center', marginBottom: 32 }}>
              <span className="badge" style={{ marginBottom: 14 }}>Análise gerada</span>
              <h2 className="title" style={{ fontSize: 'clamp(24px,3.5vw,40px)', marginBottom: 10 }}>
                Desbloqueie para <span className="acc">ver tudo</span>
              </h2>
              <p style={{ color: '#444', fontSize: 14 }}>Uma amostra do que foi gerado para o concorrente que você analisou</p>
            </div>
            <div className="pv-wrap sr">
              <div className="pv-blur">
                <div className="mock-sc">
                  <div><div style={{ fontSize: 10, color: '#444', marginBottom: 4, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Score da oferta</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="mock-n">8</span><span style={{ color: '#333' }}>/10</span></div></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ background: 'rgba(255,140,0,.1)', color: '#FF8C00', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100 }}>Vale entrar ✓</span>
                      <span style={{ fontSize: 11, color: '#333' }}>47 anúncios</span>
                    </div>
                    <div className="mock-b"><div className="mock-bf" style={{ width: '80%' }} /></div>
                  </div>
                </div>
                {[['#1', 'Ângulo dominante'], ['#2', 'Pontos fracos (4)'], ['#3', 'Script CTV #1'], ['#4', 'Script CTV #2'], ['#5', 'Script CTV #3']].map(([ic, label], i) => (
                  <div className="mock-row" key={label}>
                    <div className="mock-ic">{ic}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9.5, color: '#333', marginBottom: 5, fontWeight: 600 }}>{label}</div>
                      <div className="mline" style={{ width: ['65%','80%','55%','72%','60%'][i] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pv-over">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,140,0,.1)', border: '1px solid rgba(255,140,0,.22)', borderRadius: 8, padding: '9px 14px', marginBottom: 12, color: '#FF8C00', fontSize: 13, fontWeight: 600 }}>
                  — Análise completa bloqueada
                </div>
                <h3 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 900, marginBottom: 8, letterSpacing: '-.02em' }}>Adquira um plano para desbloquear</h3>
                <p style={{ fontSize: 13.5, color: '#444', marginBottom: 22, maxWidth: 380 }}>Score completo · Ângulo · 4 pontos fracos · 3 scripts de CTV · Página de vendas editável</p>
                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange-lg glow">Adquirir Plano →</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PRICING */}
      <section id="preco">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="sec-hd sr">
            <div className="sec-label"><span>Planos</span></div>
            <h2 className="title">Simples.<br /><span className="acc">Sem pegadinha.</span></h2>
          </div>
          <div className="price-c sr">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
              <div>
                <div style={{ fontSize: 12.5, color: '#444', marginBottom: 5 }}>Pro</div>
                <div className="price-am">R$57<span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0 }}>,90</span></div>
                <div style={{ fontSize: 12.5, color: '#444', marginTop: 4 }}>/mês</div>
              </div>
              <span className="badge">Plano único</span>
            </div>
            {[
              '10 análises por mês',
              '100 créditos de edição (~1 crédito por prompt)',
              'Score completo da oferta',
              'Ângulo + pontos fracos + pontos fortes',
              '3 scripts de CTV por análise',
              'Página gerada e editável',
              'Editor ao vivo com preview',
              'Suporte 24h via WhatsApp',
              'Descontos em novas atualizações',
              'Export com 1 clique',
            ].map(f => (
              <div className="pf" key={f}><span className="pc">✦</span><span>{f}</span></div>
            ))}
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange glow" style={{ width: '100%', justifyContent: 'center', marginTop: 26, fontSize: 15, padding: '17px 32px', borderRadius: 8 }}>
              Começar agora →
            </a>
            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#333', marginTop: 10 }}>Acesso imediato · Cancele quando quiser</p>
          </div>
        </div>
      </section>

      <hr />

      {/* FAQ */}
      <section>
        <div className="wrap" style={{ maxWidth: 660 }}>
          <div className="sec-hd sr">
            <div className="sec-label"><span>FAQ</span></div>
            <h2 className="title">Dúvidas <span className="dim">frequentes</span></h2>
          </div>
          {[
            { q: 'Quanto tempo leva uma análise?', a: 'Em média 1–2 minutos. O Apify leva ~60s pra raspar os anúncios e o Claude processa em ~30s depois.' },
            { q: 'A página gerada é editável?', a: 'Sim. Você recebe o HTML completo num editor ao vivo — edita copy, preço, cores e exporta o arquivo final.' },
            { q: 'Funciona com qualquer nicho?', a: 'Sim. Qualquer link da biblioteca de anúncios do Meta com um anunciante específico. Low ticket, cursos, físicos, serviços.' },
            { q: 'Precisa saber programar?', a: 'Não. Você só cola o link e espera. O editor tem preview ao vivo — não precisa tocar no código se não quiser.' },
            { q: 'Como pego o link certo?', a: 'Vai na biblioteca de anúncios, busca o anunciante, clica em "Ver todos os anúncios" — a URL com view_all_page_id aparece na barra do navegador.' },
          ].map(({ q, a }) => (
            <div key={q} className="fq sr">
              <div className="fq-q"><span>{q}</span><span className="fq-ic">+</span></div>
              <div className="fq-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
      </section>

      <hr />

      {/* CTA */}
      <section style={{ padding: '120px 28px', textAlign: 'center' }}>
        <div className="wrap" style={{ maxWidth: 580 }}>
          <div className="sr">
            <span className="badge" style={{ marginBottom: 24 }}>Comece agora</span>
            <h2 className="title" style={{ marginBottom: 16 }}>Pare de chutar.<br /><span className="acc">Analise antes de investir.</span></h2>
            <p style={{ fontSize: 16, color: '#444', marginBottom: 36, lineHeight: 1.8 }}>Cole o link. IA analisa. Página pronta.<br />Do zero à oferta em minutos.</p>
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange-lg glow" style={{ display: 'inline-flex' }}>
              Analisar minha primeira oferta →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #111', padding: '36px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#444' }}>Analise. Clone. Bata o concorrente.</p>
      </footer>
    </>
  )
}
