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
  return <img src="/logo.png" alt="ratoads_" style={{ display: 'block', height: h, width: 'auto' }} />
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
    <div style={{ background: 'rgba(8,8,8,.85)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 520, margin: '0 auto', boxShadow: '0 32px 80px rgba(255,140,0,.1)', backdropFilter: 'blur(12px)' }}>
      <div style={{ background: 'rgba(15,15,15,.9)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontFamily: "'Courier New',monospace", fontSize: 11, color: '#444', marginLeft: 8 }}>/ratoads — análise</span>
      </div>
      <div style={{ padding: '20px', height: 290, overflow: 'hidden', fontFamily: "'Courier New',monospace", fontSize: 13, lineHeight: 1.9 }}>
        <div style={{ color: '#333', marginBottom: 8 }}>$ ratoads analyze --url=&quot;facebook.com/ads/library...&quot;</div>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.color, animation: 'fadein .3s ease' }}>{l.text}</div>
        ))}
        {lines.length > 0 && lines.length < TERMINAL_LINES.length && (
          <span style={{ display: 'inline-block', width: 8, height: 14, background: '#FF8C00', animation: 'blink .7s step-end infinite', verticalAlign: 'middle' }} />
        )}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(5,5,5,.8)', opacity: lines.length === TERMINAL_LINES.length ? 1 : 0, transition: 'opacity .4s ease' }}>
        <div style={{ flex: 1, height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: lines.length === TERMINAL_LINES.length ? '80%' : '0%', height: '100%', background: 'linear-gradient(90deg,#FF8C00,#ffb347)', borderRadius: 2, transition: 'width .8s cubic-bezier(.16,1,.3,1)' }} />
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

  // Lenis smooth scroll
  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lenis: any
    let rafId: number
    const init = async () => {
      try {
        const { default: Lenis } = await import('lenis')
        lenis = new Lenis({ duration: 1.4, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
        function raf(time: number) { lenis.raf(time); rafId = requestAnimationFrame(raf) }
        rafId = requestAnimationFrame(raf)
      } catch {
        // fallback: CSS scroll-behavior:smooth handles it
      }
    }
    init()
    return () => { if (lenis) lenis.destroy(); if (rafId) cancelAnimationFrame(rafId) }
  }, [])

  // Word cycle
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
    t = setTimeout(cycle, 2200)
    return () => { clearTimeout(t); clearInterval(b) }
  }, [])

  // Scroll reveal — all 4 directions + fade
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target) }
      }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.sc-top,.sc-bot,.sc-left,.sc-right,.sc-fade').forEach(el => {
      if (!el.classList.contains('visible')) io.observe(el)
    })
    return () => io.disconnect()
  }, [showPreview])

  // Nav scroll glass effect
  useEffect(() => {
    const nav = document.querySelector('nav')
    const onScroll = () => {
      if (window.scrollY > 40) nav?.classList.add('nav-scrolled')
      else nav?.classList.remove('nav-scrolled')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // FAQ accordion
  useEffect(() => {
    document.querySelectorAll('.fq').forEach(item => {
      item.querySelector('.fq-q')?.addEventListener('click', () => {
        const open = item.classList.contains('open')
        document.querySelectorAll('.fq').forEach(i => i.classList.remove('open'))
        if (!open) item.classList.add('open')
      })
    })
  }, [])

  // Testimonial auto-advance
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
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Sora',sans-serif;background:#000;color:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}

        /* DOT GRID — escalonador style */
        .dot-grid{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1px);background-size:24px 24px}

        /* SCROLL ANIMATIONS — individual CSS transforms so hover scale doesn't conflict */
        .sc-top{opacity:0;translate:0 52px;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-bot{opacity:0;translate:0 -52px;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-left{opacity:0;translate:-60px 0;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-right{opacity:0;translate:60px 0;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-fade{opacity:0;filter:blur(4px);transition:opacity .9s ease,filter .9s ease}
        .visible{opacity:1!important;translate:0 0!important;filter:blur(0)!important}

        /* KEYFRAMES */
        @keyframes glowStrong{0%{opacity:.55}25%{opacity:.3}50%{opacity:.45}75%{opacity:.2}100%{opacity:.04}}
        @keyframes glowSoft{0%{opacity:.4}20%{opacity:.12}45%{opacity:.32}70%{opacity:.15}100%{opacity:.04}}
        @keyframes noisemove{0%{background-position:0 0}16%{background-position:-60px -30px}33%{background-position:40px 55px}50%{background-position:-30px 70px}66%{background-position:65px -40px}83%{background-position:-50px 20px}100%{background-position:0 0}}
        @keyframes fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}
        @keyframes tk{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes gp{0%,100%{box-shadow:0 0 0 0 rgba(255,140,0,0)}50%{box-shadow:0 0 40px 10px rgba(255,140,0,.22)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes scroll-bounce{0%,100%{transform:translateY(0) rotate(45deg);opacity:.5}50%{transform:translateY(8px) rotate(45deg);opacity:1}}

        /* DYNAMIC BG GLOW */
        .bg-glow{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
        .bg-glow-1{position:absolute;top:-220px;left:-580px;width:1400px;height:200px;background:linear-gradient(90deg,#FFD0B6,transparent);border-radius:9999px;transform:rotate(43deg);mix-blend-mode:screen;animation:glowStrong 8s ease-in-out infinite alternate}
        .bg-glow-2{position:absolute;top:-300px;left:-680px;width:1800px;height:290px;background:linear-gradient(90deg,#F16517,transparent);border-radius:9999px;transform:rotate(40deg);mix-blend-mode:screen;animation:glowSoft 9.5s ease-in-out infinite alternate}

        /* NOISE */
        .noise{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.15;mix-blend-mode:plus-lighter;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:250px 250px;animation:noisemove .45s steps(1) infinite}

        /* NAV */
        nav{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:200;height:60px;display:flex;align-items:center;padding:0 20px 0 16px;width:calc(100% - 48px);max-width:1100px;background:rgba(10,10,10,.72);border:1px solid rgba(255,255,255,.08);border-radius:16px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:background .3s ease,border-color .3s ease;box-shadow:0 4px 32px rgba(0,0,0,.4)}
        nav.nav-scrolled{background:rgba(6,6,6,.9);border-color:rgba(255,255,255,.1)}
        @media(max-width:640px){nav{top:10px;width:calc(100% - 24px);padding:0 14px 0 12px;height:54px;border-radius:12px}}
        .nav-logo{display:flex;align-items:center;flex-shrink:0}.nav-logo img{height:36px;width:auto;display:block}
        .nav-center{display:flex;align-items:center;gap:4px;position:absolute;left:50%;transform:translateX(-50%)}
        @media(max-width:640px){.nav-center{display:none}}
        .nav-r{display:flex;gap:8px;align-items:center;margin-left:auto;flex-shrink:0}
        @media(max-width:480px){.nav-hide-mobile{display:none}}
        .btn-nav-ghost{padding:8px 14px;font-size:13px;font-weight:500;background:transparent;color:#555;border:none;letter-spacing:.01em;white-space:nowrap;font-family:'Sora',sans-serif;transition:color .2s;text-decoration:none;cursor:pointer}
        .btn-nav-ghost:hover{color:#fff}
        .btn-nav-cta{padding:10px 22px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border-radius:10px;letter-spacing:.01em;white-space:nowrap;font-family:'Sora',sans-serif;transition:all .25s;box-shadow:0 0 20px rgba(255,140,0,.2);border:none}
        .btn-nav-cta:hover{transform:translateY(-1px);box-shadow:0 4px 24px rgba(255,140,0,.4)}

        /* BUTTONS */
        .btn{display:inline-flex;align-items:center;gap:8px;font-family:'Sora',sans-serif;font-weight:700;border-radius:8px;border:none;text-decoration:none;position:relative;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1)}
        .btn::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.1) 50%,transparent 60%);transform:translateX(-100%);transition:transform .55s ease}
        .btn:hover::after{transform:translateX(100%)}
        .btn-orange{padding:16px 32px;font-size:15px;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff}
        .btn-orange:hover{transform:translateY(-2px);box-shadow:0 10px 40px rgba(255,140,0,.4)}
        .btn-orange-lg{padding:20px 52px;font-size:17px;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border-radius:10px}
        .btn-orange-lg:hover{transform:translateY(-3px);box-shadow:0 16px 56px rgba(255,140,0,.45)}
        .glow{animation:gp 3s ease-in-out infinite}

        /* LAYOUT */
        section{padding:100px 40px;position:relative;z-index:1}
        .wrap{max-width:900px;margin:0 auto}
        .wrap-w{max-width:1160px;margin:0 auto}
        .sec-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);margin:0 40px;position:relative;z-index:1}
        @media(max-width:640px){section{padding:72px 20px}.sec-divider{margin:0 20px}}

        /* SECTION HEADER */
        .sec-hd{text-align:center;margin-bottom:60px}
        .sec-label{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px}
        .sec-label::before,.sec-label::after{content:'';width:32px;height:1px;flex-shrink:0}
        .sec-label::before{background:linear-gradient(90deg,transparent,#FF8C00)}
        .sec-label::after{background:linear-gradient(90deg,#FF8C00,transparent)}
        .sec-label span{color:#FF8C00;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
        h2.title{font-size:clamp(30px,4.5vw,54px);font-weight:800;line-height:1.08;letter-spacing:-.04em}
        h2.title .acc{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        h2.title .dim{color:#1e1e1e}

        /* BADGE */
        .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.18);color:#FF8C00;font-size:10.5px;font-weight:700;padding:6px 14px;border-radius:100px;letter-spacing:.08em;text-transform:uppercase}
        .bdot{width:6px;height:6px;background:#FF8C00;border-radius:50%;animation:pdot 1.5s ease-in-out infinite;flex-shrink:0}

        /* HERO */
        .hero{min-height:100svh;display:flex;align-items:center;padding:80px 40px 60px;position:relative;overflow:hidden;text-align:center}
        .hero-inner{max-width:800px;margin:0 auto;width:100%;position:relative;z-index:1}
        .hero-h1{font-size:clamp(38px,6vw,72px);font-weight:800;line-height:1.04;letter-spacing:-.05em;margin-bottom:22px}
        .hero-h1 .acc{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .word-wrap{font-style:italic;display:inline-block;min-width:10px;background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .hero-sub{font-size:17px;color:#555;line-height:1.8;margin-bottom:40px;max-width:520px;margin-left:auto;margin-right:auto;font-weight:300}
        .tcur{display:inline-block;width:2px;height:.82em;background:#FF8C00;margin-left:1px;vertical-align:middle}
        .hero-terminal{margin-top:52px;animation:floaty 5s ease-in-out infinite}
        .scroll-hint{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:#252525;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;z-index:2}
        .scroll-arrow{width:18px;height:18px;border-right:1.5px solid #2a2a2a;border-bottom:1.5px solid #2a2a2a;animation:scroll-bounce 1.8s ease-in-out infinite}

        /* DEMO INPUT */
        .demo-box{display:flex;background:rgba(9,9,9,.9);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s,box-shadow .2s;max-width:560px;margin:0 auto;backdrop-filter:blur(8px)}
        .demo-box:focus-within{border-color:rgba(255,140,0,.5);box-shadow:0 0 0 3px rgba(255,140,0,.08)}
        .demo-in{flex:1;background:transparent;border:none;outline:none;padding:15px 18px;font-size:12.5px;color:#fff;font-family:'Sora',sans-serif;min-width:0}
        .demo-in::placeholder{color:#222}
        .demo-sub{background:linear-gradient(135deg,#FF8C00,#FF6B00);border:none;color:#fff;font-weight:700;font-size:13px;padding:0 20px;font-family:'Sora',sans-serif;white-space:nowrap;flex-shrink:0;transition:opacity .15s;cursor:pointer}
        .demo-sub:hover{opacity:.88}
        .demo-sub:disabled{opacity:.3}
        .st-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px;justify-content:center}
        .st{display:flex;align-items:center;gap:5px;font-size:11px;color:#252525;transition:color .3s}
        .st.done{color:#FF8C00}.st.act{color:#888}
        .std{width:5px;height:5px;border-radius:50%;background:#1a1a1a;flex-shrink:0;transition:background .3s}
        .st.done .std{background:#FF8C00}.st.act .std{background:#888;animation:pdot 1s infinite}

        /* TICKER */
        .ticker{overflow:hidden;padding:18px 0;background:#030303;border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);position:relative;z-index:1}
        .tk-in{display:flex;gap:64px;width:max-content;animation:tk 24s linear infinite}
        .tk-in:hover{animation-play-state:paused}
        .tk-i{display:flex;align-items:center;gap:8px;font-size:12px;color:#252525;white-space:nowrap;font-weight:500}
        .tk-i .hl{color:#FF8C00;font-weight:700}

        /* STEPS */
        @keyframes line-grow{from{width:0;opacity:0}to{width:100%;opacity:1}}
        @keyframes icon-pop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
        .steps-g{display:grid;grid-template-columns:repeat(3,1fr);gap:0;position:relative}
        @media(max-width:640px){.steps-g{grid-template-columns:1fr;gap:32px}}
        /* horizontal connector line */
        .steps-line{position:absolute;top:52px;left:calc(16.66% + 28px);right:calc(16.66% + 28px);height:1px;z-index:0;overflow:hidden}
        .steps-line::before{content:'';display:block;height:1px;background:linear-gradient(90deg,rgba(255,140,0,.6),rgba(255,140,0,.2),rgba(255,140,0,.6));width:100%}
        .steps-line.visible::before{animation:line-grow .9s .3s both ease-out}
        @media(max-width:640px){.steps-line{display:none}}
        .step-c{background:transparent;padding:0 24px 0;text-align:center;position:relative;z-index:1}
        /* step number label above icon */
        .step-label{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;color:rgba(255,140,0,.5);letter-spacing:.15em;text-transform:uppercase;margin-bottom:14px}
        /* icon circle */
        .step-icon-wrap{width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,140,0,.3);background:rgba(255,140,0,.06);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;position:relative;transition:border-color .3s,box-shadow .3s,background .3s}
        .step-c:hover .step-icon-wrap{border-color:rgba(255,140,0,.6);box-shadow:0 0 28px rgba(255,140,0,.2);background:rgba(255,140,0,.1)}
        /* spinning arc around icon */
        .step-icon-wrap::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:1.5px solid transparent;border-top-color:rgba(255,140,0,.6);border-right-color:rgba(255,140,0,.15);animation:arc-spin 4s linear infinite}
        .step-icon-wrap svg{width:22px;height:22px;stroke:#FF8C00;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .3s}
        .step-c:hover .step-icon-wrap svg{transform:scale(1.15)}
        /* connecting dot on line */
        .step-dot{width:8px;height:8px;border-radius:50%;background:#FF8C00;margin:0 auto -4px;position:relative;z-index:2;box-shadow:0 0 10px rgba(255,140,0,.5);margin-bottom:10px}
        .step-t{font-size:18px;font-weight:700;margin-bottom:10px;letter-spacing:-.02em}
        .step-d{font-size:13px;color:#555;line-height:1.8;font-weight:300;max-width:240px;margin:0 auto}

        /* FEATURES — escalonador style */
        @keyframes arc-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .feat-g{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.05);overflow:visible}
        @media(max-width:768px){.feat-g{grid-template-columns:1fr}}
        .feat-c{background:#06080f;padding:36px 32px;text-align:left;position:relative;overflow:hidden;transition:transform .45s cubic-bezier(.16,1,.3,1),box-shadow .45s ease,background .35s ease;cursor:default;z-index:1}
        /* dot grid inside each card */
        .feat-c::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.035) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;z-index:0}
        /* corner L-marks */
        .feat-c::before{
          content:'';position:absolute;inset:0;pointer-events:none;z-index:1;
          background:
            linear-gradient(rgba(255,140,0,.55) 0 0) top left    / 2px 22px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) top left    / 22px 2px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) top right   / 2px 22px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) top right   / 22px 2px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) bottom left / 2px 22px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) bottom left / 22px 2px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) bottom right/ 2px 22px no-repeat,
            linear-gradient(rgba(255,140,0,.55) 0 0) bottom right/ 22px 2px no-repeat;
          transition:opacity .35s ease;opacity:.55
        }
        .feat-c:hover{transform:scale(1.045);z-index:10;background:#09101f;box-shadow:0 28px 80px rgba(0,0,0,.85),0 0 0 1px rgba(255,140,0,.25)}
        .feat-c:hover::before{opacity:1}
        /* icon arc — sempre girando */
        .feat-mark{width:60px;height:60px;margin:0 0 28px;display:flex;align-items:center;justify-content:center;position:relative;z-index:2;flex-shrink:0}
        .feat-mark::before{content:'';position:absolute;inset:-2px;border-radius:50%;border:2px solid transparent;border-top-color:rgba(255,140,0,.75);border-right-color:rgba(255,140,0,.2);animation:arc-spin 3s linear infinite}
        .feat-mark svg{position:relative;z-index:1}
        .feat-t{font-size:20px;font-weight:700;margin-bottom:12px;letter-spacing:-.03em;line-height:1.2;position:relative;z-index:2}
        .feat-t .acc-w{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .feat-d{font-size:13.5px;color:#555;line-height:1.85;font-weight:300;position:relative;z-index:2}

        /* CAROUSEL */
        .car-outer{max-width:640px;margin:0 auto;position:relative;padding:0 52px}
        @media(max-width:600px){.car-outer{padding:0 40px}}
        .car-clip{overflow:hidden;border-radius:18px}
        .car-track{display:flex;transition:transform .55s cubic-bezier(.16,1,.3,1)}
        .car-slide{min-width:100%;padding:0 4px}
        .testi-c{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:30px 26px;display:flex;flex-direction:column;gap:18px;backdrop-filter:blur(10px)}
        .testi-stars{display:flex;gap:4px}
        .testi-star{color:#FF8C00;font-size:13px}
        .testi-q{font-size:15px;color:#aaa;line-height:1.85;font-style:italic;font-weight:300}
        .testi-user{display:flex;align-items:center;gap:14px;padding-top:18px;border-top:1px solid rgba(255,255,255,.05);margin-top:auto}
        .testi-av{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,140,0,.2);flex-shrink:0}
        .testi-name{font-size:14px;font-weight:700;line-height:1.3}
        .testi-role{font-size:11.5px;color:#555;margin-top:2px;font-weight:400}
        .car-btn{position:absolute;top:50%;transform:translateY(-50%);background:rgba(13,13,13,.9);border:1px solid rgba(255,255,255,.07);color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;transition:border-color .2s,background .2s,transform .2s;padding:0;flex-shrink:0;backdrop-filter:blur(8px)}
        .car-btn:hover{border-color:rgba(255,140,0,.4);background:#111;transform:translateY(-50%) scale(1.05)}
        .car-btn-l{left:0}.car-btn-r{right:0}
        .car-dots{display:flex;gap:7px;justify-content:center;margin-top:22px}
        .car-dot{width:5px;height:5px;border-radius:50%;background:#1a1a1a;transition:background .3s,width .3s;cursor:pointer}
        .car-dot.on{background:#FF8C00;width:20px;border-radius:3px}

        /* RESULTS */
        .res-car{position:relative}
        .res-scroll{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;gap:0}
        .res-scroll::-webkit-scrollbar{display:none}
        .res-scroll-item{scroll-snap-align:start;flex-shrink:0;min-width:calc(100% / 3);padding:0 6px}
        .res-scroll-item:first-child{padding-left:0}
        .res-scroll-item:last-child{padding-right:0}
        @media(max-width:600px){.res-scroll-item{min-width:100%;padding:0}}
        .res-img{width:100%;max-height:52vh;border-radius:12px;border:1px solid rgba(255,255,255,.06);object-fit:contain;display:block;transition:transform .35s,box-shadow .35s,border-color .35s}
        .res-img:hover{transform:scale(1.04) translateY(-4px);box-shadow:0 24px 56px rgba(255,140,0,.12);border-color:rgba(255,140,0,.2)}
        @media(max-width:600px){.res-img{max-height:58vh}}
        .res-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:26px}
        .res-nav-btn{background:rgba(13,13,13,.9);border:1px solid rgba(255,255,255,.07);color:#fff;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;transition:border-color .2s,background .2s;padding:0;backdrop-filter:blur(8px);cursor:pointer}
        .res-nav-btn:hover{border-color:rgba(255,140,0,.4);background:#111}

        /* PREVIEW BLUR */
        .pv-wrap{position:relative;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.07);max-width:820px;margin:0 auto}
        .pv-blur{filter:blur(7px);user-select:none;pointer-events:none;background:#060606;padding:28px}
        .pv-over{position:absolute;inset:0;background:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.6) 28%,rgba(0,0,0,.97) 58%);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:40px 28px 48px;text-align:center}
        .mock-sc{display:flex;align-items:center;gap:20px;background:#050505;border:1px solid rgba(255,255,255,.04);border-radius:12px;padding:18px;margin-bottom:10px}
        .mock-n{font-size:50px;font-weight:800;background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1}
        .mock-b{height:5px;border-radius:3px;background:#111;overflow:hidden;margin-top:7px}
        .mock-bf{height:100%;background:linear-gradient(90deg,#FF8C00,#FFB347);border-radius:3px}
        .mock-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.03)}
        .mock-row:last-child{border-bottom:none}
        .mock-ic{width:26px;height:26px;background:#111;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#333;flex-shrink:0;font-family:'Space Mono',monospace}
        .mline{height:10px;border-radius:3px;background:linear-gradient(90deg,#111 25%,#181818 50%,#111 75%);background-size:400px 100%;animation:shimmer 2s infinite}

        /* PRICING — glass card */
        .price-c{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:44px;position:relative;overflow:hidden;backdrop-filter:blur(14px)}
        .price-c::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#FF8C00,transparent)}
        .price-c::after{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,140,0,.06) 0%,transparent 70%);pointer-events:none}
        .price-am{font-size:62px;font-weight:800;letter-spacing:-.05em;line-height:1;background:linear-gradient(135deg,#fff,#aaa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .pf{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13.5px;font-weight:400}
        .pf:last-of-type{border-bottom:none}
        .pc{color:#FF8C00;font-size:12px;flex-shrink:0}

        /* FAQ */
        .fq{border-bottom:1px solid rgba(255,255,255,.05)}
        .fq-q{display:flex;justify-content:space-between;align-items:center;padding:24px 0;gap:16px;cursor:pointer}
        .fq-q span:first-child{font-weight:600;font-size:15px;letter-spacing:-.01em}
        .fq-ic{color:#FF8C00;font-size:24px;flex-shrink:0;transition:transform .35s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-ic{transform:rotate(45deg)}
        .fq-a{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-a{max-height:200px}
        .fq-a p{font-size:14px;color:#555;line-height:1.85;padding-bottom:22px;font-weight:300}

        /* BACK TO TOP */
        .back-top{position:fixed;bottom:28px;right:28px;z-index:100;width:44px;height:44px;border-radius:50%;background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.22);color:#FF8C00;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .25s;backdrop-filter:blur(8px);cursor:pointer}
        .back-top:hover{background:rgba(255,140,0,.22);transform:translateY(-2px)}
      `}</style>

      {/* DOT GRID */}
      <div className="dot-grid" aria-hidden />

      {/* BACKGROUND GLOW */}
      <div className="bg-glow" aria-hidden>
        <div className="bg-glow-1" />
        <div className="bg-glow-2" />
      </div>

      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <Link href="/"><Logo size="sm" /></Link>
        </div>
        <div className="nav-center">
          <a href="#como-funciona" className="btn-nav-ghost">Como funciona</a>
          <a href="#preco" className="btn-nav-ghost">Planos</a>
          <a href="#faq" className="btn-nav-ghost">Dúvidas</a>
        </div>
        <div className="nav-r">
          <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn-nav-cta" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Começar →</a>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="noise" aria-hidden />
        <div className="hero-inner">
          <div className="sc-top" style={{ transitionDelay: '.1s' }}>
            <span className="badge" style={{ marginBottom: 28 }}><span className="bdot" />Intelig\u00eancia Competitiva para Infoprodutores</span>
          </div>
          <h1 className="hero-h1 sc-top" style={{ transitionDelay: '.2s' }}>
            Analise <span className="word-wrap">{cycleWord}<span className="tcur" style={{ opacity: cursorVisible ? 1 : 0 }} /></span><br />
            do concorrente.<br />Clone o que <span className="acc">funciona.</span>
          </h1>
          <p className="hero-sub sc-top" style={{ transitionDelay: '.3s' }}>
            Cole o link da biblioteca de anúncios. Em minutos você recebe análise completa + página de vendas modelada e pronta pra editar.
          </p>
          <div className="sc-top" style={{ transitionDelay: '.4s', marginBottom: 10 }}>
            <form onSubmit={handleDemo}>
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
              {!analyzing && !showPreview && <p style={{ fontSize: 11, color: '#222', marginTop: 9 }}>Sem cadastro \u00b7 ~2 minutos \u00b7 An\u00e1lise completa</p>}
            </form>
          </div>
          <div className="hero-terminal sc-top" style={{ transitionDelay: '.5s' }}>
            <Terminal />
          </div>
        </div>
        <div className="scroll-hint sc-fade" style={{ transitionDelay: '1.2s' }}>
          <span>Continuar</span>
          <div className="scroll-arrow" />
        </div>
      </div>

      {/* TICKER */}
      <div className="ticker">
        <div className="tk-in">
          {[...Array(2)].flatMap((_, r) => [
            <div key={`${r}a`} className="tk-i"><span style={{ color: '#FF8C00' }}>✦</span><span className="hl">2 min</span> por análise</div>,
            <div key={`${r}b`} className="tk-i"><span style={{ color: '#FF8C00' }}>✦</span><span className="hl">30+</span> anúncios raspados</div>,
            <div key={`${r}c`} className="tk-i"><span style={{ color: '#FF8C00' }}>✦</span>Score <span className="hl">1–10</span> da oferta</div>,
            <div key={`${r}d`} className="tk-i"><span style={{ color: '#FF8C00' }}>✦</span><span className="hl">3</span> scripts de CTV</div>,
            <div key={`${r}e`} className="tk-i"><span style={{ color: '#FF8C00' }}>✦</span>Chat ao vivo <span className="hl">estilo Lovable</span></div>,
            <div key={`${r}f`} className="tk-i"><span style={{ color: '#FF8C00' }}>✦</span>Powered by <span className="hl">IA Avan\u00e7ada</span></div>,
          ])}
        </div>
      </div>

      {/* COMO FUNCIONA */}
      <section id="como-funciona">
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Processo</span></div>
            <h2 className="title">Do link à página<br /><span className="acc">em 3 passos</span></h2>
          </div>
          <div className="steps-g" style={{ position: 'relative' }}>
            {/* connecting line */}
            <div className="steps-line sc-fade" />

            {[
              {
                n: '01', t: 'Mineração Automática',
                d: 'Digite uma palavra-chave e receba ofertas escaladas prontas para você escolher a de sua preferência.',
                dir: 'sc-left',
                icon: (
                  // Crossed shovel + pickaxe — bold flat style
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}>
                    {/* pickaxe — top-left to bottom-right */}
                    {/* handle */}
                    <line x1="30" y1="8" x2="10" y2="40" stroke="#FF8C00" strokeWidth="4.5" strokeLinecap="round"/>
                    {/* head */}
                    <path d="M28 6 Q38 2 42 10 Q46 18 38 20 L30 10 Z" fill="#FF8C00"/>
                    <path d="M26 10 L20 16" stroke="#FF8C00" strokeWidth="4.5" strokeLinecap="round"/>
                    {/* shovel — top-right to bottom-left */}
                    {/* handle */}
                    <line x1="18" y1="8" x2="38" y2="40" stroke="#FFB347" strokeWidth="4.5" strokeLinecap="round"/>
                    {/* blade */}
                    <path d="M16 6 Q10 6 8 12 Q6 18 12 22 L20 14 Z" fill="#FFB347"/>
                    {/* handle cap */}
                    <path d="M36 38 L40 42 L38 44 L34 40 Z" fill="#FFB347"/>
                  </svg>
                ),
              },
              {
                n: '02', t: 'Análise Completa da Oferta',
                d: 'Com um clique receba uma análise completa com score de 1 a 10, transcrição de todos os criativos e modelagem dos mais escalados, corrigindo pontos fracos e potencializando os fortes.',
                dir: 'sc-top',
                icon: (
                  // Magnifying glass with bar chart + line graph inside — bold flat style
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}>
                    {/* lens fill */}
                    <circle cx="19" cy="19" r="15" fill="rgba(255,140,0,.08)"/>
                    {/* lens ring */}
                    <circle cx="19" cy="19" r="15" stroke="#FF8C00" strokeWidth="4.5"/>
                    {/* bar chart inside lens */}
                    <rect x="9"  y="22" width="4" height="7" rx="1" fill="#FF8C00"/>
                    <rect x="15" y="18" width="4" height="11" rx="1" fill="#FF8C00"/>
                    <rect x="21" y="14" width="4" height="15" rx="1" fill="#FF8C00"/>
                    {/* line graph over bars */}
                    <polyline points="11,21 17,17 23,13 27,15" stroke="#FFB347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="11" cy="21" r="1.5" fill="#FFB347"/>
                    <circle cx="17" cy="17" r="1.5" fill="#FFB347"/>
                    <circle cx="23" cy="13" r="1.5" fill="#FFB347"/>
                    {/* handle */}
                    <line x1="30" y1="30" x2="44" y2="44" stroke="#FF8C00" strokeWidth="5.5" strokeLinecap="round"/>
                  </svg>
                ),
              },
              {
                n: '03', t: 'Edita via chat',
                d: 'Editor ao vivo estilo Lovable. Digita o que quer mudar — copy, cores, preço — e a IA atualiza em segundos.',
                dir: 'sc-right',
                icon: (
                  <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                ),
              },
            ].map(({ n, t, d, dir, icon }, i) => (
              <div key={n} className={`step-c ${dir}`} style={{ transitionDelay: `${i * .15}s` }}>
                <div className="step-label">Passo {n}</div>
                <div className="step-dot" />
                <div className="step-icon-wrap">{icon}</div>
                <div className="step-t">{t}</div>
                <div className="step-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* FEATURES */}
      <section>
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>O que você recebe</span></div>
            <h2 className="title">Tudo que você precisa<br /><span className="acc">pra entrar na oferta</span></h2>
          </div>
          <div className="feat-g">
            {[
              {
                icon: (
                  // Speedometer / gauge icon
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
                    <path d="M3.34 17a10 10 0 1 1 17.32 0"/>
                    <line x1="12" y1="17" x2="18.5" y2="8.5" strokeWidth="2"/>
                    <circle cx="12" cy="17" r="1.5" fill="#FF8C00" stroke="none"/>
                  </svg>
                ),
                t: <><span className="acc-w">Score</span> (1–10)</>,
                d: 'Vale entrar ou não? Volume de ads, tempo no ar, presença de expert — calculado antes de você gastar R$1.',
                dir: 'sc-left'
              },
              {
                icon: (
                  // Document + pencil icon
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="8" y1="13" x2="13" y2="13"/>
                    <line x1="8" y1="17" x2="11" y2="17"/>
                    <path d="M17 17l-4 4v-4h4z"/>
                    <path d="M21 13l-4 4-1.5-1.5 4-4L21 13z"/>
                  </svg>
                ),
                t: <>Pontos fracos da <span className="acc-w">landing page</span> da oferta</>,
                d: 'O que a página deles erra. Você recebe cada ponto identificado com clareza para sair na frente.',
                dir: 'sc-top'
              },
              {
                icon: (
                  // Camera icon
                  <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}>
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                ),
                t: <>3 Roteiros de criativos baseados nos <span className="acc-w">mais escalados</span></>,
                d: 'Hook + ângulo + roteiro de 3–4 linhas prontos pra filmar e testar.',
                dir: 'sc-right'
              },
            ].map(({ icon, t, d, dir }, i) => (
              <div key={i} className={`feat-c ${dir}`} style={{ transitionDelay: `${i * .12}s` }}>
                <div className="feat-mark">{icon}</div>
                <div className="feat-t">{t}</div>
                <div className="feat-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* TESTIMONIALS */}
      <section>
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Quem usa</span></div>
            <h2 className="title">Produtores que já<br /><span className="acc">analisam com RatoAds</span></h2>
          </div>
          <div className="car-outer sc-top">
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

      <div className="sec-divider" />

      {/* RESULTS */}
      <section>
        <div className="wrap-w">
          <div className="sec-hd sc-top" style={{ maxWidth: 900, margin: '0 auto 52px' }}>
            <div className="sec-label"><span>Resultados</span></div>
            <h2 className="title">Campanhas que<br /><span className="acc">convertem de verdade</span></h2>
            <p style={{ marginTop: 16, fontSize: 15, color: '#444', lineHeight: 1.8, fontWeight: 300 }}>O mesmo processo que gerou esses resultados agora está nas suas mãos.</p>
          </div>
          <div className="res-car sc-top">
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

      <div className="sec-divider" />

      {/* PREVIEW BORRADO */}
      {showPreview && (
        <section id="pv" style={{ paddingTop: 60 }}>
          <div className="wrap">
            <div className="sc-top" style={{ textAlign: 'center', marginBottom: 36 }}>
              <span className="badge" style={{ marginBottom: 16 }}>Análise gerada</span>
              <h2 className="title" style={{ fontSize: 'clamp(24px,3.5vw,42px)', marginBottom: 12 }}>
                Desbloqueie para <span className="acc">ver tudo</span>
              </h2>
              <p style={{ color: '#444', fontSize: 14, fontWeight: 300 }}>Uma amostra do que foi gerado para o concorrente que você analisou</p>
            </div>
            <div className="pv-wrap sc-top">
              <div className="pv-blur">
                <div className="mock-sc">
                  <div>
                    <div style={{ fontSize: 10, color: '#444', marginBottom: 4, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase' }}>Score da oferta</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="mock-n">8</span><span style={{ color: '#333' }}>/10</span></div>
                  </div>
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,140,0,.08)', border: '1px solid rgba(255,140,0,.18)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, color: '#FF8C00', fontSize: 13, fontWeight: 600 }}>
                  — Análise completa bloqueada
                </div>
                <h3 style={{ fontSize: 'clamp(18px,3vw,24px)', fontWeight: 800, marginBottom: 10, letterSpacing: '-.03em' }}>Adquira um plano para desbloquear</h3>
                <p style={{ fontSize: 13.5, color: '#444', marginBottom: 24, maxWidth: 380, fontWeight: 300 }}>Score completo · Ângulo · 4 pontos fracos · 3 scripts de CTV · Página de vendas editável</p>
                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange-lg glow">Adquirir Plano →</a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PRICING */}
      <section id="preco">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Planos</span></div>
            <h2 className="title">Simples.<br /><span className="acc">Sem pegadinha.</span></h2>
          </div>
          <div className="price-c sc-top">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 11.5, color: '#444', marginBottom: 6, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>Pro</div>
                <div className="price-am">R$57<span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0 }}>,90</span></div>
                <div style={{ fontSize: 12, color: '#444', marginTop: 5, fontWeight: 400 }}>/mês</div>
              </div>
              <span className="badge"><span className="bdot" />Plano único</span>
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
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange glow" style={{ width: '100%', justifyContent: 'center', marginTop: 28, fontSize: 15.5, padding: '18px 32px', borderRadius: 10 }}>
              Começar agora →
            </a>
            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#2a2a2a', marginTop: 12 }}>Acesso imediato · Cancele quando quiser</p>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* FAQ */}
      <section id="faq">
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>FAQ</span></div>
            <h2 className="title">Dúvidas <span className="dim">frequentes</span></h2>
          </div>
          {[
            { q: 'Quanto tempo leva uma an\u00e1lise?', a: 'Em m\u00e9dia 1\u20132 minutos. A IA raspa os an\u00fancios e processa tudo automaticamente.' },
            { q: 'A página gerada é editável?', a: 'Sim. Você recebe o HTML completo num editor ao vivo — edita copy, preço, cores e exporta o arquivo final.' },
            { q: 'Funciona com qualquer nicho?', a: 'Sim. Qualquer link da biblioteca de anúncios do Meta com um anunciante específico. Low ticket, cursos, físicos, serviços.' },
            { q: 'Precisa saber programar?', a: 'Não. Você só cola o link e espera. O editor tem preview ao vivo — não precisa tocar no código se não quiser.' },
            { q: 'Como pego o link certo?', a: 'Vai na biblioteca de anúncios, busca o anunciante, clica em "Ver todos os anúncios" — a URL com view_all_page_id aparece na barra do navegador.' },
          ].map(({ q, a }, i) => (
            <div key={q} className="fq sc-top" style={{ transitionDelay: `${i * .07}s` }}>
              <div className="fq-q"><span>{q}</span><span className="fq-ic">+</span></div>
              <div className="fq-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
      </section>

      <div className="sec-divider" />

      {/* FINAL CTA */}
      <section style={{ padding: '130px 40px', textAlign: 'center' }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div className="sc-top">
            <span className="badge" style={{ marginBottom: 28 }}><span className="bdot" />Comece agora</span>
            <h2 className="title" style={{ marginBottom: 18 }}>Pare de chutar.<br /><span className="acc">Analise antes de investir.</span></h2>
            <p style={{ fontSize: 16, color: '#444', marginBottom: 40, lineHeight: 1.85, fontWeight: 300 }}>Cole o link. IA analisa. Página pronta.<br />Do zero à oferta em minutos.</p>
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange-lg glow" style={{ display: 'inline-flex' }}>
              Analisar minha primeira oferta →
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Logo size="sm" />
        <p style={{ fontSize: 12, color: '#2a2a2a', fontWeight: 400 }}>Analise. Clone. Bata o concorrente.</p>
        <p style={{ fontSize: 11, color: '#1a1a1a' }}>© {new Date().getFullYear()} RatoAds — Todos os direitos reservados</p>
      </footer>

      {/* BACK TO TOP */}
      <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo">↑</button>
    </>
  )
}
