'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL || 'https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9'
const PREMIUM_URL = 'https://pay.kirvano.com/c60822ee-79dc-4e2c-ab27-031d405ca57c'

const USERS = [
  { img: '/avatars/8477.jpg', name: 'Lucas Ferreira', role: 'Produtor low ticket', quote: 'Analisei 3 concorrentes em 10 minutos. Lancei no mesmo dia com a p\u00e1gina j\u00e1 modelada.' },
  { img: '/avatars/8481.jpg', name: 'Marina Costa', role: 'Afiliada Meta Ads', quote: 'Antes eu ficava chutando se a oferta valia. Agora eu sei antes de gastar R$1.' },
  { img: '/avatars/8479.jpg', name: 'Rafael Souza', role: 'Gestor de tr\u00e1fego', quote: 'Entrego an\u00e1lise + landing page pro cliente em 15 minutos. Mudou meu servi\u00e7o.' },
  { img: '/avatars/8483.jpg', name: 'Ana Lima', role: 'Produtora de conte\u00fado', quote: 'Os scripts de CTV que ele gera s\u00e3o melhores do que eu escrevia em 1 hora.' },
  { img: '/avatars/8480.jpg', name: 'Pedro Alves', role: 'Empreendedor digital', quote: 'Score 8/10, entrei na oferta, validei em 3 dias. Processo simples demais.' },
  { img: '/avatars/8484.jpg', name: 'Juliana Neves', role: 'Criadora de produtos', quote: 'A p\u00e1gina gerada j\u00e1 sai corrigindo os pontos fracos do concorrente. Inteligente.' },
]

const RESULTS = [
  '/results/8529.jpg',
  '/results/8528.jpg',
  '/results/8527.jpg',
  '/results/8526.jpg',
  '/results/8525.jpg',
  '/results/8524.jpg',
  '/results/8523.jpg',
  '/results/8522.jpg',
  '/results/8521.jpg',
]

const CYCLE_WORDS = ['ofertas', 'nichos', 'concorrentes', 'campanhas']

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 56 : 44
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="ratoads_" style={{ display: 'block', height: h, width: 'auto' }} />
}

type Phase = 'idle' | 'thinking' | 'found' | 'ready'

const PRATICA_STEPS = [
  {
    n: '01', t: 'Minera\u00e7\u00e3o Autom\u00e1tica',
    d: 'Digite uma palavra-chave e o RatoAds encontra todas as ofertas escaladas do nicho.',
    video: '/videos/minerador.mp4',
    panda: 'https://player-vz-be1cbbe9-2ec.tv.pandavideo.com.br/embed/?v=dbbfb4b8-098d-4520-880e-edc65b9590d8',
    icon: <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{width:36,height:36}}><path d="M3 13 Q16 3 24 6 Q32 3 45 13 Q32 9 24 11 Q16 9 3 13 Z" fill="#FF8C00"/><rect x="22" y="10" width="4" height="32" rx="1.4" fill="#FF8C00"/><rect x="20.5" y="40" width="7" height="4" rx="1.5" fill="#FF8C00"/></svg>,
  },
  {
    n: '02', t: 'An\u00e1lise Completa',
    d: 'Escolha a oferta, clique em "analisar" e receba o score, pontos fracos e roteiros de CTV.',
    video: '/videos/analise.mp4',
    icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:36,height:36}}><circle cx="19" cy="19" r="15" fill="rgba(255,140,0,.08)"/><circle cx="19" cy="19" r="15" stroke="#FF8C00" strokeWidth="4.5"/><rect x="9" y="22" width="4" height="7" rx="1" fill="#FF8C00"/><rect x="15" y="18" width="4" height="11" rx="1" fill="#FF8C00"/><rect x="21" y="14" width="4" height="15" rx="1" fill="#FF8C00"/><line x1="30" y1="30" x2="44" y2="44" stroke="#FF8C00" strokeWidth="5.5" strokeLinecap="round"/></svg>,
  },
  {
    n: '03', t: 'Rastreamento',
    d: 'Adicione no radar e acompanhe diariamente quantos ads ativos a oferta tem.',
    video: '/videos/rastreamento.mp4',
    icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:36,height:36}}><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" fill="rgba(255,140,0,.08)"/><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" stroke="#FF8C00" strokeWidth="4.5" strokeLinejoin="round"/><circle cx="24" cy="18" r="6" stroke="#FF8C00" strokeWidth="3" fill="none"/><circle cx="24" cy="18" r="1.8" fill="#FF8C00"/></svg>,
  },
]

function PraticaSection() {
  const [activeStep, setActiveStep] = useState(0)
  const [progresses, setProgresses] = useState([0, 0, 0])
  const [done, setDone] = useState([false, false, false])
  const [playing, setPlaying] = useState([false, false, false])
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const activeStepRef = useRef(activeStep)
  activeStepRef.current = activeStep

  function togglePlay(i: number) {
    const v = videoRefs[i].current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  function toggleFs(i: number) {
    const v = videoRefs[i].current
    if (!v) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vAny = v as any
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if (v.requestFullscreen) v.requestFullscreen().catch(() => {})
    else if (vAny.webkitEnterFullscreen) vAny.webkitEnterFullscreen()
    else if (vAny.webkitRequestFullscreen) vAny.webkitRequestFullscreen()
  }

  // Smooth progress — rAF loop reads currentTime @ 60fps (timeupdate only fires 4x/s)
  useEffect(() => {
    let raf: number
    function tick() {
      const v = videoRefs[activeStep].current
      if (v && !v.paused && v.duration) {
        const pct = (v.currentTime / v.duration) * 100
        setProgresses(prev => {
          if (Math.abs(prev[activeStep] - pct) < 0.05) return prev
          const n = [...prev]; n[activeStep] = pct; return n
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  // Mobile: lock orientation to landscape when video enters fullscreen
  useEffect(() => {
    function onFsChange() {
      const inFs = !!document.fullscreenElement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const so = screen.orientation as any
      if (inFs && so?.lock) {
        so.lock('landscape').catch(() => {})
      } else if (!inFs && so?.unlock) {
        try { so.unlock() } catch {}
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  function goTo(idx: number) {
    // Pause current video
    const cur = videoRefs[activeStep].current
    if (cur) cur.pause()
    setActiveStep(idx)
    // Autoplay next if not first
    setTimeout(() => {
      const next = videoRefs[idx].current
      if (next && idx > 0) {
        next.load()
        next.play().catch(() => {})
      }
    }, 600)
  }

  function handleTimeUpdate(idx: number) {
    const v = videoRefs[idx].current
    if (!v || !v.duration) return
    setProgresses(prev => { const n = [...prev]; n[idx] = (v.currentTime / v.duration) * 100; return n })
  }

  async function handleEnded(idx: number) {
    setProgresses(prev => { const n = [...prev]; n[idx] = 100; return n })
    setDone(prev => { const n = [...prev]; n[idx] = true; return n })
    // Exit fullscreen if active so the slider transition is visible
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      try { await document.exitFullscreen() } catch {}
    }
    if (idx < 2) setTimeout(() => goTo(idx + 1), 1000)
  }

  const circumference = 2 * Math.PI * 30
  const step = PRATICA_STEPS[activeStep]

  return (
    <section>
      <div className="wrap">
        <div className="sec-hd sc-top">
          <div className="sec-label"><span>Na pr{'\u00e1'}tica</span></div>
          <h2 className="title">Como funciona<br /><span className="acc">na pr{'\u00e1'}tica?</span></h2>
        </div>

        <div className="prt-carousel sc-top">
          {/* Video slider — all 3 videos rendered, translateX to slide */}
          <div className="prt-slider-wrap">
            <div className="prt-slider" style={{ transform: `translateX(-${activeStep * 100}%)` }}>
              {PRATICA_STEPS.map((s, i) => (
                <div className="prt-slide" key={i}>
                  <div className="prt-player prt-custom">
                    <video
                      ref={videoRefs[i]}
                      src={s.video}
                      onTimeUpdate={() => handleTimeUpdate(i)}
                      onEnded={() => { setPlaying(p => { const n = [...p]; n[i] = false; return n }); handleEnded(i) }}
                      onPlay={() => setPlaying(p => { const n = [...p]; n[i] = true; return n })}
                      onPause={() => setPlaying(p => { const n = [...p]; n[i] = false; return n })}
                      onClick={() => togglePlay(i)}
                      playsInline
                      preload={i === 0 ? 'metadata' : 'none'}
                      className="prt-video-el"
                    />
                    {!playing[i] && (
                      <button className="prt-big-play" onClick={() => togglePlay(i)} aria-label="Play">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                    )}
                    <div className="prt-ctrls">
                      <button className="prt-ctrl-btn" onClick={() => togglePlay(i)} aria-label={playing[i] ? 'Pause' : 'Play'}>
                        {playing[i] ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                        )}
                      </button>
                      <div className="prt-bar" onClick={(e) => {
                        const v = videoRefs[i].current; if (!v || !v.duration) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const pct = (e.clientX - rect.left) / rect.width
                        v.currentTime = pct * v.duration
                      }}>
                        <div className="prt-bar-fill" style={{ width: `${progresses[i]}%` }} />
                      </div>
                      <button className="prt-ctrl-btn" onClick={() => toggleFs(i)} aria-label="Fullscreen">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Connector */}
          <div className="prt-connector"><div className="prt-line" /></div>

          {/* Icon with progress ring */}
          <div className="prt-ring-wrap">
            <svg width="72" height="72" viewBox="0 0 72 72" className="prt-ring-svg">
              <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,140,0,.12)" strokeWidth="3" />
              <circle cx="36" cy="36" r="30" fill="none" stroke={done[activeStep] ? '#10B981' : '#FF8C00'} strokeWidth="3"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (progresses[activeStep] / 100) * circumference}
                style={{ transition: 'stroke-dashoffset .4s ease-out, stroke .3s', transform: 'rotate(-90deg)', transformOrigin: '36px 36px' }} />
            </svg>
            <div className="prt-ring-icon" style={{ transition: 'all .3s ease' }}>
              {done[activeStep] ? <span style={{ fontSize: 22, color: '#10B981', fontWeight: 800 }}>{'\u2713'}</span> : step.icon}
            </div>
          </div>

          {/* Text — CSS transition instead of re-mount */}
          <div className="prt-info">
            <div className="prt-step-label" style={{ transition: 'opacity .4s', opacity: 1 }}>Passo {step.n}</div>
            <div className="prt-step-title" style={{ transition: 'opacity .4s', opacity: 1 }}>{step.t}</div>
            <div className="prt-step-desc" style={{ transition: 'opacity .4s', opacity: 1 }}>{step.d}</div>
          </div>

          {/* Dots */}
          <div className="prt-dots">
            {PRATICA_STEPS.map((_, i) => (
              <button key={i} className={`prt-dot ${i === activeStep ? 'prt-dot-active' : ''} ${done[i] ? 'prt-dot-done' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function LandingPage() {
  const [cycleWord, setCycleWord] = useState('ofertas')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [adCount, setAdCount] = useState(127)
  const [tcIdx, setTcIdx] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const resScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lenis: any
    let rafId: number
    const init = async () => {
      try {
        const { default: Lenis } = await import('lenis')
        lenis = new Lenis({ duration: 0.8, easing: (t: number) => 1 - Math.pow(1 - t, 3), smoothWheel: true, syncTouch: false })
        function raf(time: number) { lenis.raf(time); rafId = requestAnimationFrame(raf) }
        rafId = requestAnimationFrame(raf)
      } catch { /* fallback */ }
    }
    init()
    return () => { if (lenis) lenis.destroy(); if (rafId) cancelAnimationFrame(rafId) }
  }, [])

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
  }, [phase])

  useEffect(() => {
    const nav = document.querySelector('nav')
    const onScroll = () => {
      if (window.scrollY > 40) nav?.classList.add('nav-scrolled')
      else nav?.classList.remove('nav-scrolled')
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.querySelectorAll('.fq').forEach(item => {
      item.querySelector('.fq-q')?.addEventListener('click', () => {
        const open = item.classList.contains('open')
        document.querySelectorAll('.fq').forEach(i => i.classList.remove('open'))
        if (!open) item.classList.add('open')
      })
    })
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTcIdx(i => (i + 1) % USERS.length), 4500)
    return () => clearInterval(t)
  }, [])

  function resScroll(dir: 1 | -1) {
    const el = resScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.offsetWidth, behavior: 'smooth' })
  }

  const [demoSteps, setDemoSteps] = useState<string[]>([])
  const [demoError, setDemoError] = useState('')

  async function addStep(text: string, delay: number) {
    await new Promise(r => setTimeout(r, delay))
    setDemoSteps(prev => [...prev, text])
  }

  const KEYWORD_SUGGESTIONS = ['pack de atividades', 'truque pra emagrecer', 'renda extra', 'por apenas 10 reais', 'perder peso']

  function handleSuggestionClick(kw: string) {
    setUrl(kw)
  }

  async function handleDemo(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || phase !== 'idle') return
    setDemoSteps([])
    setDemoError('')
    setPhase('thinking')

    const keyword = url.trim()

    await addStep(`Minerando "${keyword}" no Meta Ad Library...`, 800)

    try {
      const totalOfertas = 8 + Math.floor(Math.random() * 15)
      await addStep('Conectando \u00e0 Biblioteca de An\u00fancios...', 1200)
      await addStep(`Escaneando p\u00e1ginas do nicho "${keyword}"...`, 1400)
      await addStep(`${30 + Math.floor(Math.random() * 70)} p\u00e1ginas encontradas`, 1000)

      await addStep('Filtrando ofertas com + de 20 an\u00fancios ativos...', 1400)
      await addStep(`${totalOfertas} ofertas escaladas identificadas`, 1000)

      await addStep('Calculando score de escalabilidade...', 1200)
      await addStep('Identificando dias de veicula\u00e7\u00e3o...', 1000)
      await addStep('Extraindo landing pages...', 1200)

      const topScore = 7 + Math.floor(Math.random() * 3)
      await addStep(`Top oferta: Score ${topScore}/10 \u2014 ${60 + Math.floor(Math.random() * 200)} ads ativos`, 800)

      setAdCount(totalOfertas)
      await new Promise(r => setTimeout(r, 600))
      setPhase('ready')
    } catch {
      setDemoError('Erro de conex\u00e3o. Tente novamente.')
      setPhase('idle')
      setDemoSteps([])
    }
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Sora',sans-serif;background:#000;color:#fff;overflow-x:hidden;-webkit-font-smoothing:antialiased}
        html{overflow-x:hidden}
        .dot-grid{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1px);background-size:24px 24px}
        .sc-top{opacity:0;translate:0 52px;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-bot{opacity:0;translate:0 -52px;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-left{opacity:0;translate:-60px 0;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-right{opacity:0;translate:60px 0;filter:blur(6px);transition:opacity .75s cubic-bezier(.16,1,.3,1),translate .75s cubic-bezier(.16,1,.3,1),filter .75s ease}
        .sc-fade{opacity:0;filter:blur(4px);transition:opacity .9s ease,filter .9s ease}
        .visible{opacity:1!important;translate:0 0!important;filter:blur(0)!important}
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
        .bg-glow{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;max-width:100vw}
        .bg-glow-1{position:absolute;top:-220px;left:-580px;width:1400px;height:200px;background:linear-gradient(90deg,#FFD0B6,transparent);border-radius:9999px;transform:rotate(43deg);mix-blend-mode:screen;animation:glowStrong 8s ease-in-out infinite alternate}
        .bg-glow-2{position:absolute;top:-300px;left:-680px;width:1800px;height:290px;background:linear-gradient(90deg,#F16517,transparent);border-radius:9999px;transform:rotate(40deg);mix-blend-mode:screen;animation:glowSoft 9.5s ease-in-out infinite alternate}
        .noise{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.15;mix-blend-mode:plus-lighter;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:250px 250px;animation:noisemove .45s steps(1) infinite}
        nav{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:200;height:60px;display:flex;align-items:center;padding:0 20px 0 16px;width:calc(100% - 48px);max-width:1100px;background:rgba(10,10,10,.72);border:1px solid rgba(255,255,255,.08);border-radius:16px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:background .3s ease,border-color .3s ease;box-shadow:0 4px 32px rgba(0,0,0,.4)}
        nav.nav-scrolled{background:rgba(6,6,6,.9);border-color:rgba(255,255,255,.1)}
        @media(max-width:640px){nav{display:none !important}}
        .nav-logo{display:flex;align-items:center;flex-shrink:0}.nav-logo img{height:36px;width:auto;display:block}
        .nav-center{display:flex;align-items:center;gap:4px;position:absolute;left:50%;transform:translateX(-50%)}
        @media(max-width:640px){.nav-center{display:none}}
        .nav-r{display:flex;gap:8px;align-items:center;margin-left:auto;flex-shrink:0}
        .btn-nav-ghost{padding:8px 14px;font-size:13px;font-weight:500;background:transparent;color:#555;border:none;letter-spacing:.01em;white-space:nowrap;font-family:'Sora',sans-serif;transition:color .2s;text-decoration:none;cursor:pointer}
        .btn-nav-ghost:hover{color:#fff}
        .btn-nav-cta{padding:10px 22px;font-size:13px;font-weight:700;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border-radius:10px;letter-spacing:.01em;white-space:nowrap;font-family:'Sora',sans-serif;transition:all .25s;box-shadow:0 0 20px rgba(255,140,0,.2);border:none;text-decoration:none}
        .btn-nav-cta:hover{transform:translateY(-1px);box-shadow:0 4px 24px rgba(255,140,0,.4)}
        .nav-burger{display:none;background:transparent;border:1px solid rgba(255,255,255,.1);width:38px;height:38px;border-radius:9px;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;padding:0;transition:border-color .2s,background .2s}
        .nav-burger:hover{border-color:rgba(255,140,0,.4);background:rgba(255,140,0,.06)}
        .nav-burger span{display:block;width:18px;height:2px;background:#ddd;border-radius:2px;transition:transform .25s ease,opacity .2s ease}
        .nav-burger.open span:nth-child(1){transform:translateY(6px) rotate(45deg)}
        .nav-burger.open span:nth-child(2){opacity:0}
        .nav-burger.open span:nth-child(3){transform:translateY(-6px) rotate(-45deg)}
        @media(max-width:640px){.nav-burger{display:flex}}
        .nav-mobile-menu{position:absolute;top:calc(100% + 10px);left:0;right:0;background:rgba(8,8,8,.95);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:2px;backdrop-filter:blur(20px);box-shadow:0 12px 40px rgba(0,0,0,.6);animation:fadein .25s ease}
        .nav-mobile-menu a{padding:14px 16px;font-size:14px;font-weight:500;color:#ccc;text-decoration:none;border-radius:9px;transition:background .2s,color .2s}
        .nav-mobile-menu a:hover{background:rgba(255,140,0,.08);color:#FF8C00}
        .btn{display:inline-flex;align-items:center;gap:8px;font-family:'Sora',sans-serif;font-weight:700;border-radius:8px;border:none;text-decoration:none;position:relative;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1);cursor:pointer}
        .btn::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.1) 50%,transparent 60%);transform:translateX(-100%);transition:transform .55s ease}
        .btn:hover::after{transform:translateX(100%)}
        .btn-orange{padding:16px 32px;font-size:15px;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff}
        .btn-orange:hover{transform:translateY(-2px);box-shadow:0 10px 40px rgba(255,140,0,.4)}
        .btn-orange-lg{padding:20px 52px;font-size:17px;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border-radius:10px}
        .btn-orange-lg:hover{transform:translateY(-3px);box-shadow:0 16px 56px rgba(255,140,0,.45)}
        .glow{animation:gp 3s ease-in-out infinite}
        section{padding:100px 40px;position:relative;z-index:1}
        .wrap{max-width:900px;margin:0 auto}
        .wrap-w{max-width:1160px;margin:0 auto;padding:0 16px}
        .sec-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);margin:0 40px;position:relative;z-index:1}
        @media(max-width:640px){section{padding:48px 16px}.sec-divider{margin:0 16px}.wrap{padding:0}.wrap-w{padding:0 12px}.sec-hd{margin-bottom:32px}h2.title{font-size:clamp(22px,6.5vw,34px)}.feat-c{padding:28px 22px}.feat-t{font-size:17px}.feat-d{font-size:12.5px}.step-c{padding:28px 20px 24px}.step-t{font-size:16px;min-height:auto}.step-d{font-size:12px}}
        .sec-hd{text-align:center;margin-bottom:60px}
        .sec-label{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px}
        .sec-label::before,.sec-label::after{content:'';width:32px;height:1px;flex-shrink:0}
        .sec-label::before{background:linear-gradient(90deg,transparent,#FF8C00)}
        .sec-label::after{background:linear-gradient(90deg,#FF8C00,transparent)}
        .sec-label span{color:#FF8C00;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
        h2.title{font-size:clamp(30px,4.5vw,54px);font-weight:800;line-height:1.08;letter-spacing:-.04em}
        h2.title .acc{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        h2.title .dim{color:#1e1e1e}
        .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.18);color:#FF8C00;font-size:10.5px;font-weight:700;padding:6px 14px;border-radius:100px;letter-spacing:.08em;text-transform:uppercase}
        .bdot{width:6px;height:6px;background:#FF8C00;border-radius:50%;animation:pdot 1.5s ease-in-out infinite;flex-shrink:0}
        .hero{min-height:auto;display:flex;align-items:center;padding:220px 40px 200px;position:relative;overflow:hidden;text-align:center}
        @media(max-width:640px){.hero{padding:140px 20px 80px}}
        .hero-mobile-logo{display:none}
        @media(max-width:640px){
        .hero{flex-direction:column;padding:60px 16px 40px;min-height:auto}
        .hero-h1{font-size:clamp(28px,8vw,42px);margin-bottom:16px}
        .hero-sub{font-size:14px;margin-bottom:32px}
        .hero-mobile-logo{display:flex;justify-content:center;width:100%;order:-1;margin-bottom:20px;flex-shrink:0}
        .hero-mobile-logo img{height:70px;width:auto;filter:drop-shadow(0 0 22px rgba(255,140,0,.45))}
        .hero-inner{width:100%}
        .demo-box{flex-direction:column;border-radius:10px}
        .demo-in{padding:14px 16px;font-size:13px}
        .demo-sub{padding:14px 20px}
        }
        .hero-inner{max-width:800px;margin:0 auto;width:100%;position:relative;z-index:1}
        .hero-h1{font-size:clamp(38px,6vw,72px);font-weight:800;line-height:1.04;letter-spacing:-.05em;margin-bottom:24px;margin-top:0}
        .hero-h1 .acc{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .word-wrap{font-style:italic;display:inline-block;min-width:10px;background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .hero-sub{font-size:17px;color:#555;line-height:1.75;margin-bottom:48px;max-width:520px;margin-left:auto;margin-right:auto;font-weight:300}
        .tcur{display:inline-block;width:2px;height:.82em;background:#FF8C00;margin-left:1px;vertical-align:middle}
        .rat-stage{margin-top:40px;display:flex;flex-direction:column;align-items:center;gap:20px;animation:fadein .5s ease;max-width:560px;margin-left:auto;margin-right:auto;width:100%}
        .rat-img-wrap{position:relative;width:240px;height:240px;display:flex;align-items:center;justify-content:center;max-width:60vw}
        .rat-aura{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(180,80,0,.22),transparent 65%);animation:aura-pulse 2.4s ease-in-out infinite;pointer-events:none}
        @keyframes aura-pulse{0%,100%{transform:scale(.85);opacity:.45}50%{transform:scale(1.1);opacity:.85}}
        .rat-thinking{width:200px;max-width:55vw;height:auto;animation:floaty 2.8s ease-in-out infinite;filter:drop-shadow(0 0 30px rgba(180,80,0,.4));position:relative;z-index:1}
        .status-bar{width:100%;display:flex;flex-direction:column;gap:14px}
        .status-track{height:6px;background:rgba(255,255,255,.05);border-radius:100px;overflow:hidden;border:1px solid rgba(255,140,0,.14);position:relative}
        .status-fill{height:100%;background:linear-gradient(90deg,#FF8C00,#FFB347);border-radius:100px;transition:width .9s cubic-bezier(.16,1,.3,1);box-shadow:0 0 18px rgba(255,140,0,.55);position:relative;overflow:hidden}
        .status-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:shimmer 1.6s linear infinite;background-size:200px 100%}
        .status-text{display:flex;align-items:center;justify-content:center;gap:12px;font-size:14.5px;color:#bbb;font-weight:500;min-height:42px;flex-wrap:wrap;text-align:center}
        .st-ready{color:#fff;font-weight:600}
        .st-pulse{width:9px;height:9px;border-radius:50%;background:#FF8C00;animation:pdot 1.2s ease-in-out infinite;flex-shrink:0;box-shadow:0 0 10px rgba(255,140,0,.6)}
        .st-check{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#FF8C00;color:#000;font-size:12px;font-weight:800;flex-shrink:0;box-shadow:0 0 14px rgba(255,140,0,.6)}
        .elip{display:inline-block;width:18px;text-align:left;animation:elip 1.4s steps(4,end) infinite;overflow:hidden;vertical-align:bottom}
        @keyframes elip{0%{width:0}25%{width:6px}50%{width:12px}75%,100%{width:18px}}
        .status-cta{padding:11px 22px;font-size:13px;margin-left:6px}
        .demo-steps-list{display:flex;flex-direction:column;gap:6px;text-align:left;padding:4px 0}
        .demo-step{display:flex;align-items:center;gap:10px;font-size:13px;padding:6px 12px;border-radius:8px;animation:fadein .35s ease}
        .demo-step-action{color:#666;background:rgba(255,255,255,.02)}
        .demo-step-result{color:#FF8C00;background:rgba(255,140,0,.06);border:1px solid rgba(255,140,0,.12);font-weight:600}
        .demo-step-loading{color:#888}
        .demo-step-icon{font-size:11px;flex-shrink:0;width:16px;text-align:center}
        .scroll-hint{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:#252525;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;z-index:2}
        @media(max-width:640px){.scroll-hint{display:none}}
        .scroll-arrow{width:18px;height:18px;border-right:1.5px solid #2a2a2a;border-bottom:1.5px solid #2a2a2a;animation:scroll-bounce 1.8s ease-in-out infinite}
        .demo-box{display:flex;background:rgba(9,9,9,.9);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;transition:border-color .2s,box-shadow .2s;max-width:560px;margin:0 auto;backdrop-filter:blur(8px)}
        .demo-box:focus-within{border-color:rgba(255,140,0,.5);box-shadow:0 0 0 3px rgba(255,140,0,.08)}
        .demo-in{flex:1;background:transparent;border:none;outline:none;padding:15px 18px;font-size:12.5px;color:#fff;font-family:'Sora',sans-serif;min-width:0}
        .demo-in::placeholder{color:#222}
        .demo-sub{background:linear-gradient(135deg,#FF8C00,#FF6B00);border:none;color:#fff;font-weight:700;font-size:13px;padding:0 20px;font-family:'Sora',sans-serif;white-space:nowrap;flex-shrink:0;transition:opacity .15s;cursor:pointer}
        .demo-sub:hover{opacity:.88}
        .demo-sub:disabled{opacity:.3}
        .kw-suggestions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;max-width:560px;margin-left:auto;margin-right:auto}
        .kw-chip{background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.2);color:#FF8C00;font-size:12px;font-weight:500;padding:6px 14px;border-radius:20px;cursor:pointer;font-family:'Sora',sans-serif;transition:all .2s;white-space:nowrap}
        .kw-chip:hover{background:rgba(255,140,0,.18);border-color:rgba(255,140,0,.4);transform:translateY(-1px)}
        .ticker{overflow:hidden;padding:18px 0;background:#030303;border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);position:relative;z-index:1}
        .tk-in{display:flex;gap:64px;width:max-content;animation:tk 24s linear infinite}
        .tk-in:hover{animation-play-state:paused}
        .tk-i{display:flex;align-items:center;gap:8px;font-size:12px;color:#252525;white-space:nowrap;font-weight:500}
        .tk-i .hl{color:#FF8C00;font-weight:700}
        @keyframes arc-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .steps-g{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;position:relative;align-items:stretch}
        @media(max-width:640px){.steps-g{grid-template-columns:1fr;gap:20px}}
        .steps-line{display:none}
        .step-c{background:#06080f;border:1px solid rgba(255,140,0,.12);border-radius:18px;padding:38px 26px 32px;text-align:center;position:relative;z-index:1;overflow:hidden;transition:transform .4s cubic-bezier(.16,1,.3,1),border-color .35s ease,box-shadow .35s ease,background .35s ease;display:flex;flex-direction:column;height:100%}
        .step-c::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.035) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;z-index:0}
        .step-c > *{position:relative;z-index:1}
        .step-c:hover{transform:translateY(-4px);border-color:rgba(255,140,0,.32);background:#080b15;box-shadow:0 28px 70px rgba(0,0,0,.7),0 0 0 1px rgba(255,140,0,.18)}
        .step-label{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;color:rgba(255,140,0,.5);letter-spacing:.15em;text-transform:uppercase;margin-bottom:14px}
        .step-icon-wrap{width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,140,0,.3);background:rgba(255,140,0,.06);display:flex;align-items:center;justify-content:center;margin:0 auto 28px;position:relative;transition:border-color .3s,box-shadow .3s,background .3s}
        .step-c:hover .step-icon-wrap{border-color:rgba(255,140,0,.6);box-shadow:0 0 28px rgba(255,140,0,.2);background:rgba(255,140,0,.1)}
        .step-icon-wrap::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:1.5px solid transparent;border-top-color:rgba(255,140,0,.6);border-right-color:rgba(255,140,0,.15);animation:arc-spin 4s linear infinite}
        .step-icon-wrap svg{width:22px;height:22px;stroke:#FF8C00;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;transition:transform .3s}
        .step-c:hover .step-icon-wrap svg{transform:scale(1.15)}
        .step-dot{width:8px;height:8px;border-radius:50%;background:#FF8C00;margin:0 auto -4px;position:relative;z-index:2;box-shadow:0 0 10px rgba(255,140,0,.5);margin-bottom:10px}
        .step-t{font-size:18px;font-weight:700;margin-bottom:14px;letter-spacing:-.02em;line-height:1.25;min-height:calc(2 * 1.25 * 18px);display:flex;align-items:center;justify-content:center}
        .step-d{font-size:13px;color:#888;line-height:1.75;font-weight:300;max-width:260px;margin:0 auto}
        .feat-g{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(255,255,255,.05);overflow:visible}
        @media(max-width:768px){.feat-g{grid-template-columns:1fr}}
        .feat-c{background:#06080f;padding:36px 32px;text-align:left;position:relative;overflow:hidden;transition:transform .45s cubic-bezier(.16,1,.3,1),box-shadow .45s ease,background .35s ease;cursor:default;z-index:1}
        .feat-c::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.035) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;z-index:0}
        .feat-c::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:1;background:linear-gradient(rgba(255,140,0,.55) 0 0) top left/2px 22px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) top left/22px 2px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) top right/2px 22px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) top right/22px 2px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom left/2px 22px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom left/22px 2px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom right/2px 22px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom right/22px 2px no-repeat;transition:opacity .35s ease;opacity:.55}
        .feat-c:hover{transform:scale(1.045);z-index:10;background:#09101f;box-shadow:0 28px 80px rgba(0,0,0,.85),0 0 0 1px rgba(255,140,0,.25)}
        .feat-c:hover::before{opacity:1}
        .feat-mark{width:60px;height:60px;margin:0 0 28px;display:flex;align-items:center;justify-content:center;position:relative;z-index:2;flex-shrink:0}
        .feat-mark::before{content:'';position:absolute;inset:-2px;border-radius:50%;border:2px solid transparent;border-top-color:rgba(255,140,0,.75);border-right-color:rgba(255,140,0,.2);animation:arc-spin 3s linear infinite}
        .feat-mark svg{position:relative;z-index:1}
        .feat-t{font-size:20px;font-weight:700;margin-bottom:12px;letter-spacing:-.03em;line-height:1.2;position:relative;z-index:2}
        .feat-t .acc-w{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .feat-d{font-size:13.5px;color:#555;line-height:1.85;font-weight:300;position:relative;z-index:2}
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
        .price-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;align-items:stretch;max-width:720px;margin:0 auto}
        @media(max-width:680px){.price-grid{grid-template-columns:1fr;max-width:520px}}
        @media(max-width:560px){.price-grid{max-width:100%;gap:16px}.price-c{padding:24px 20px;border-radius:16px}.price-c .price-am{font-size:42px}.pack-title{font-size:15px}.plan-badge{font-size:9px;padding:4px 8px}.pf{font-size:12.5px;padding:9px 0;gap:8px}}
        .pack-title{font-size:18px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;line-height:1}
        .price-c-premium{border:2px solid #FFB347;background:linear-gradient(180deg,rgba(255,140,0,.06),rgba(255,255,255,.02));box-shadow:0 0 0 1px rgba(255,228,181,.6),0 0 18px rgba(255,140,0,.7),0 0 48px rgba(255,140,0,.45),0 0 90px rgba(255,140,0,.25),inset 0 0 24px rgba(255,140,0,.08),0 24px 80px rgba(0,0,0,.5)}
        .price-c-premium::before{display:none}
        .price-c-premium::after{background:radial-gradient(circle,rgba(255,140,0,.14) 0%,transparent 70%);width:280px;height:280px;top:-80px;right:-80px}
        .badge-premium{background:linear-gradient(135deg,rgba(255,140,0,.18),rgba(255,180,80,.18));border-color:rgba(255,140,0,.4)}
        .plan-badge{font-size:10px;font-weight:800;padding:5px 12px;border-radius:6px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;flex-shrink:0}
        .plan-badge-starter{background:rgba(255,255,255,.06);color:#888;border:1px solid rgba(255,255,255,.1)}
        .plan-badge-premium{background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border:none;box-shadow:0 4px 14px rgba(255,107,0,.35)}
        .pack-shine{background:linear-gradient(110deg,#FF8C00 10%,#FFE4B5 25%,#FFB347 40%,#FF8C00 60%,#FFE4B5 75%,#FF8C00 90%);background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent;animation:shine-slide 3.5s linear infinite;filter:drop-shadow(0 0 12px rgba(255,180,80,.4))}
        @keyframes shine-slide{0%{background-position:200% 0}100%{background-position:-100% 0}}
        .price-c{background:rgba(255,255,255,.02);border:2px solid rgba(255,255,255,.07);border-radius:20px;padding:52px 44px;position:relative;overflow:hidden;backdrop-filter:blur(14px);display:flex;flex-direction:column;height:100%;min-height:620px;transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s ease,border-color .4s ease}
        .price-c .pf{padding:14px 0;font-size:14.5px}
        .price-c:hover{transform:translateY(-6px) scale(1.025)}
        .price-c-premium:hover{box-shadow:0 0 0 1px rgba(255,228,181,.8),0 0 24px rgba(255,140,0,.85),0 0 64px rgba(255,140,0,.6),0 0 110px rgba(255,140,0,.35),inset 0 0 28px rgba(255,140,0,.12),0 28px 90px rgba(0,0,0,.6)}
        .price-c .pf:last-of-type{flex:0}
        .price-c > a.btn{margin-top:auto !important}
        .price-c::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#FF8C00,transparent)}
        .price-c::after{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,140,0,.06) 0%,transparent 70%);pointer-events:none}
        .price-am{font-size:62px;font-weight:800;letter-spacing:-.05em;line-height:1;background:linear-gradient(135deg,#fff,#aaa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .pf{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13.5px;font-weight:400}
        .pf:last-of-type{border-bottom:none}
        .pc{color:#FF8C00;font-size:12px;flex-shrink:0}
        .fq{border-bottom:1px solid rgba(255,255,255,.05)}
        .fq-q{display:flex;justify-content:space-between;align-items:center;padding:24px 0;gap:16px;cursor:pointer}
        .fq-q span:first-child{font-weight:600;font-size:15px;letter-spacing:-.01em}
        .fq-ic{color:#FF8C00;font-size:24px;flex-shrink:0;transition:transform .35s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-ic{transform:rotate(45deg)}
        .fq-a{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-a{max-height:200px}
        .fq-a p{font-size:14px;color:#555;line-height:1.85;padding-bottom:22px;font-weight:300}
        .back-top{position:fixed;bottom:28px;right:28px;z-index:100;width:44px;height:44px;border-radius:50%;background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.22);color:#FF8C00;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .25s;backdrop-filter:blur(8px);cursor:pointer}
        .back-top:hover{background:rgba(255,140,0,.22);transform:translateY(-2px)}
        /* PRATICA CAROUSEL */
        .prt-carousel{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:640px;margin:0 auto}
        .prt-slider-wrap{width:100%;overflow:hidden;border-radius:16px;border:1px solid rgba(255,140,0,.15);background:#000}
        .prt-slider{display:flex;transition:transform .7s cubic-bezier(.16,1,.3,1)}
        .prt-slide{min-width:100%;position:relative;aspect-ratio:16/9}
        .prt-player{width:100%;height:100%;object-fit:cover;display:block;background:#000}
        .prt-custom{position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit}
        .prt-video-el{width:100%;height:100%;object-fit:cover;display:block;background:#000;cursor:pointer}
        .prt-big-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;background:linear-gradient(180deg,#FF7A1A 0%,#E8692A 100%);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 12px 32px rgba(255,106,0,.55),0 0 0 4px rgba(255,106,0,.12),inset 0 1px 0 rgba(255,255,255,.2);padding-left:4px;transition:transform .2s ease,box-shadow .2s ease;pointer-events:auto;z-index:3}
        .prt-big-play:hover{transform:translate(-50%,-50%) scale(1.08);box-shadow:0 16px 40px rgba(255,106,0,.7),0 0 0 6px rgba(255,106,0,.14),inset 0 1px 0 rgba(255,255,255,.25)}
        .prt-big-play:active{transform:translate(-50%,-50%) scale(.96)}
        .prt-ctrls{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;display:flex;align-items:center;gap:12px;background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,.7) 70%,rgba(0,0,0,.9) 100%);z-index:2;opacity:.95;transition:opacity .2s}
        .prt-custom:hover .prt-ctrls{opacity:1}
        .prt-ctrl-btn{background:transparent;border:none;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:background .15s}
        .prt-ctrl-btn:hover{background:rgba(255,255,255,.1)}
        .prt-bar{flex:1;height:4px;background:rgba(255,255,255,.18);border-radius:3px;cursor:pointer;position:relative;overflow:hidden}
        .prt-bar-fill{height:100%;background:linear-gradient(90deg,#FF7A1A,#FFB347);border-radius:3px;box-shadow:0 0 8px rgba(255,122,26,.5);will-change:width}
        .prt-connector{display:flex;justify-content:center;padding:10px 0}
        .prt-line{width:2px;height:36px;background:linear-gradient(180deg,rgba(255,140,0,.5),rgba(255,140,0,.1))}
        .prt-ring-wrap{position:relative;width:72px;height:72px;margin-bottom:16px}
        .prt-ring-svg{position:absolute;inset:0}
        .prt-ring-icon{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
        .prt-info{margin-bottom:24px}
        .prt-step-label{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;color:rgba(255,140,0,.5);letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px}
        .prt-step-title{font-size:20px;font-weight:700;letter-spacing:-.02em;margin-bottom:8px}
        .prt-step-desc{font-size:14px;color:#666;line-height:1.7;font-weight:300;max-width:400px;margin:0 auto}
        .prt-dots{display:flex;gap:10px;justify-content:center}
        .prt-dot{width:8px;height:8px;border-radius:50%;background:#1a1a1a;border:none;cursor:pointer;padding:0;transition:all .3s}
        .prt-dot-active{background:#FF8C00;width:24px;border-radius:4px;box-shadow:0 0 12px rgba(255,140,0,.5)}
        .prt-dot-done{background:#10B981;box-shadow:0 0 8px rgba(16,185,129,.4)}
      `}</style>

      <div className="dot-grid" aria-hidden />
      <div className="bg-glow" aria-hidden><div className="bg-glow-1" /><div className="bg-glow-2" /></div>

      <nav>
        <div className="nav-logo"><Link href="/"><Logo size="sm" /></Link></div>
        <div className="nav-center">
          <a href="#como-funciona" className="btn-nav-ghost">Como funciona</a>
          <a href="#preco" className="btn-nav-ghost">Planos</a>
          <a href="#faq" className="btn-nav-ghost">D{'\u00fa'}vidas</a>
        </div>
        <div className="nav-r">
          <button className={`nav-burger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu"><span /><span /><span /></button>
          <a href="#preco" className="btn-nav-cta">Come{'\u00e7'}ar {'\u2192'}</a>
        </div>
        {menuOpen && (
          <div className="nav-mobile-menu">
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a>
            <a href="#preco" onClick={() => setMenuOpen(false)}>Planos</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>D{'\u00fa'}vidas</a>
          </div>
        )}
      </nav>

      <div className="hero">
        <div className="noise" aria-hidden />
        <div className="hero-mobile-logo"><img src="/logo.png" alt="ratoads" /></div>
        <div className="hero-inner">
          <h1 className="hero-h1 sc-top" style={{ transitionDelay: '.2s' }}>
            Minere ofertas validadas<br />com <span className="acc">1 clique.</span>
          </h1>
          <p className="hero-sub sc-top" style={{ transitionDelay: '.3s' }}>Encontre ofertas escaladas, analise concorrentes e rastreie tudo automaticamente.</p>
          <div className="sc-top" style={{ transitionDelay: '.4s', marginBottom: 10 }}>
            <form onSubmit={handleDemo}>
              <div className="demo-box">
                <input className="demo-in" type="text" placeholder="Digite um nicho... ex: emagrecimento" value={url} onChange={e => setUrl(e.target.value)} disabled={phase !== 'idle'} />
                <button className="demo-sub" type="submit" disabled={phase !== 'idle' || !url.trim()}>
                  {phase === 'idle' ? `Minerar ${'\u2192'}` : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite', display: 'inline-block' }} />...</span>}
                </button>
              </div>
            </form>
            {demoError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 10, fontWeight: 500 }}>{demoError}</p>}
            {phase === 'idle' && (
              <div className="kw-suggestions">
                {KEYWORD_SUGGESTIONS.map(kw => (
                  <button key={kw} className="kw-chip" onClick={() => handleSuggestionClick(kw)} type="button">{kw}</button>
                ))}
              </div>
            )}
          </div>
          {phase !== 'idle' && (
            <div className="rat-stage">
              <div className="rat-img-wrap">
                <span className="rat-aura" />
                <img src="/logo.png" alt="ratoads pensando" className="rat-thinking" />
              </div>
              <div className="status-bar">
                <div className="status-track"><div className="status-fill" style={{ width: phase === 'ready' ? '100%' : `${Math.min(95, (demoSteps.length / 14) * 100)}%` }} /></div>
                <div className="demo-steps-list">
                  {demoSteps.map((step, i) => {
                    const isResult = !step.includes('...')
                    return (
                      <div key={i} className={`demo-step ${isResult ? 'demo-step-result' : 'demo-step-action'}`} style={{ animation: 'fadein .35s ease' }}>
                        <span className="demo-step-icon">{isResult ? '\u2713' : '\u25B8'}</span>
                        <span>{step}</span>
                      </div>
                    )
                  })}
                </div>
                {phase === 'ready' && (
                  <div className="status-text st-ready" style={{ marginTop: 16, animation: 'fadein .5s ease' }}>
                    <span className="st-check">{'\u2713'}</span>
                    <span>{adCount} ofertas encontradas!</span>
                    <a href="#preco" className="btn btn-orange status-cta">Ver resultados completos {'\u2192'}</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="scroll-hint sc-fade" style={{ transitionDelay: '1.2s' }}><span>Continuar</span><div className="scroll-arrow" /></div>
      </div>

      <div className="sec-divider" />

      <section id="como-funciona">
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Processo</span></div>
            <h2 className="title">Do link {'\u00e0'} p{'\u00e1'}gina<br /><span className="acc">em 3 passos</span></h2>
          </div>
          <div className="steps-g" style={{ position: 'relative' }}>
            <div className="steps-line sc-fade" />
            {[
              { n: '01', t: `Minera${'\u00e7'}${'\u00e3'}o Autom${'\u00e1'}tica`, d: `Digite uma palavra-chave e receba ofertas escaladas prontas para voc${'\u00ea'} escolher a de sua prefer${'\u00ea'}ncia.`, dir: 'sc-left',
                icon: <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}><path d="M3 13 Q16 3 24 6 Q32 3 45 13 Q32 9 24 11 Q16 9 3 13 Z" fill="#FF8C00"/><rect x="22" y="10" width="4" height="32" rx="1.4" fill="#FF8C00"/><rect x="20.5" y="40" width="7" height="4" rx="1.5" fill="#FF8C00"/></svg> },
              { n: '02', t: `An${'\u00e1'}lise Completa`, d: `Com um clique receba uma an${'\u00e1'}lise completa com score de 1 a 10, transcri${'\u00e7'}${'\u00e3'}o de todos os criativos e modelagem dos mais escalados, corrigindo pontos fracos e potencializando os fortes.`, dir: 'sc-top',
                icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}><circle cx="19" cy="19" r="15" fill="rgba(255,140,0,.08)"/><circle cx="19" cy="19" r="15" stroke="#FF8C00" strokeWidth="4.5"/><rect x="9" y="22" width="4" height="7" rx="1" fill="#FF8C00"/><rect x="15" y="18" width="4" height="11" rx="1" fill="#FF8C00"/><rect x="21" y="14" width="4" height="15" rx="1" fill="#FF8C00"/><polyline points="11,21 17,17 23,13 27,15" stroke="#FFB347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="11" cy="21" r="1.5" fill="#FFB347"/><circle cx="17" cy="17" r="1.5" fill="#FFB347"/><circle cx="23" cy="13" r="1.5" fill="#FFB347"/><line x1="30" y1="30" x2="44" y2="44" stroke="#FF8C00" strokeWidth="5.5" strokeLinecap="round"/></svg> },
              { n: '03', t: 'Rastreamento da oferta', d: `Adicione a biblioteca de an${'\u00fa'}ncios da oferta escolhida no rastreamento e acompanhe em tempo real os ads ativos e como eles variam diariamente.`, dir: 'sc-right',
                icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" fill="rgba(255,140,0,.08)"/><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" stroke="#FF8C00" strokeWidth="4.5" strokeLinejoin="round"/><circle cx="24" cy="18" r="6" stroke="#FF8C00" strokeWidth="3" fill="none"/><line x1="24" y1="9" x2="24" y2="13" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="24" y1="23" x2="24" y2="27" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="15" y1="18" x2="19" y2="18" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="29" y1="18" x2="33" y2="18" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><circle cx="24" cy="18" r="1.8" fill="#FF8C00"/></svg> },
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

      <section>
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>O que voc{'\u00ea'} recebe</span></div>
            <h2 className="title">Tudo que voc{'\u00ea'} precisa<br /><span className="acc">pra entrar na oferta</span></h2>
          </div>
          <div className="feat-g">
            {[
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><path d="M3.34 17a10 10 0 1 1 17.32 0"/><line x1="12" y1="17" x2="18.5" y2="8.5" strokeWidth="2"/><circle cx="12" cy="17" r="1.5" fill="#FF8C00" stroke="none"/></svg>,
                t: <><span className="acc-w">Score</span> (1{'\u2013'}10)</>, d: `Vale entrar ou n${'\u00e3'}o? Volume de ads, tempo no ar, presen${'\u00e7'}a de expert \u2014 calculado antes de voc${'\u00ea'} gastar R$1.`, dir: 'sc-left' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="13" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/><path d="M17 17l-4 4v-4h4z"/><path d="M21 13l-4 4-1.5-1.5 4-4L21 13z"/></svg>,
                t: <>Pontos fracos/fortes da <span className="acc-w">landing page</span> da oferta</>, d: `O que a p${'\u00e1'}gina deles erra. Voc${'\u00ea'} recebe cada ponto identificado com clareza para sair na frente.`, dir: 'sc-top' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:26,height:26}}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
                t: <>Roteiros de criativos baseados nos <span className="acc-w">mais escalados</span></>, d: `Hook + ${'\u00e2'}ngulo + roteiro de 3${'\u2013'}4 linhas prontos pra filmar e testar.`, dir: 'sc-right' },
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

      <section>
        <div className="wrap">
          <div className="sec-hd sc-top" style={{ marginBottom: 32 }}>
            <div className="sec-label"><span>Quem usa</span></div>
            <h2 className="title" style={{ fontSize: 'clamp(22px,4vw,42px)' }}>Clientes que sa{'\u00ed'}ram do ROI negativo para a <span className="acc">ESCALA.</span></h2>
          </div>
        </div>
        <div className="wrap-w">
          <div className="res-car sc-top">
            <div className="res-scroll" ref={resScrollRef}>
              {RESULTS.map((r, i) => (
                <div key={i} className="res-scroll-item"><img src={r} alt="" className="res-img" loading="lazy" /></div>
              ))}
            </div>
            <div className="res-nav">
              <button className="res-nav-btn btn" onClick={() => resScroll(-1)}>{'\u2039'}</button>
              <button className="res-nav-btn btn" onClick={() => resScroll(1)}>{'\u203a'}</button>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA NA PRÁTICA — carousel interativo */}
      <PraticaSection />

      <div className="sec-divider" />

      <section id="preco" style={{ paddingTop: 60 }}>
        <div className="wrap" style={{ maxWidth: 1200 }}>
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Planos</span></div>
            <h2 className="title">ESCOLHA SEU <span className="acc">PLANO</span></h2>
          </div>
          <div className="price-grid">
            <div className="price-c sc-top">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div className="pack-title acc">STARTER PACK</div>
                  <div className="price-am">R$57<span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0 }}>,90</span></div>
                  <div style={{ fontSize: 12, color: '#444', marginTop: 5, fontWeight: 400 }}>/m{'\u00ea'}s</div>
                </div>
                <span className="plan-badge plan-badge-starter">Starter</span>
              </div>
              {['10 minera\u00e7\u00f5es por m\u00eas','10 an\u00e1lises por m\u00eas','10 slots de rastreamento','3 scripts de CTV por an\u00e1lise','Suporte 24h'].map(f => (
                <div className="pf" key={f}><span className="pc">{'\u2726'}</span><span>{f}</span></div>
              ))}
              <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange glow" style={{ width: '100%', justifyContent: 'center', marginTop: 28, fontSize: 15.5, padding: '18px 32px', borderRadius: 10 }}>Come{'\u00e7'}ar agora {'\u2192'}</a>
              <p style={{ textAlign: 'center', fontSize: 11.5, color: '#2a2a2a', marginTop: 12 }}>Acesso imediato {'\u00b7'} Cancele quando quiser</p>
            </div>
            <div className="price-c price-c-premium sc-top">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div className="pack-title pack-shine">PREMIUM PACK</div>
                  <div className="price-am">R$147<span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 0 }}>,90</span></div>
                  <div style={{ fontSize: 12, color: '#444', marginTop: 5, fontWeight: 400 }}>/trimestre <span style={{ color: '#10B981', fontWeight: 600 }}>(~R$49,30/m{'\u00ea'}s)</span></div>
                </div>
                <span className="plan-badge plan-badge-premium">{'\u2605'} Mais popular</span>
              </div>
              {['20 minera\u00e7\u00f5es por m\u00eas','20 an\u00e1lises por m\u00eas','20 slots de rastreamento','3 scripts de CTV por an\u00e1lise','Suporte priorit\u00e1rio'].map(f => (
                <div className="pf" key={f}><span className="pc">{'\u2726'}</span><span>{f}</span></div>
              ))}
              <a href={PREMIUM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange glow" style={{ width: '100%', justifyContent: 'center', marginTop: 28, fontSize: 15.5, padding: '18px 32px', borderRadius: 10 }}>Quero o Premium {'\u2192'}</a>
              <p style={{ textAlign: 'center', fontSize: 11.5, color: '#2a2a2a', marginTop: 12 }}>Acesso imediato {'\u00b7'} Cancele quando quiser</p>
            </div>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      <section id="faq" style={{ paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>FAQ</span></div>
            <h2 className="title">D{'\u00fa'}vidas <span className="dim">frequentes</span></h2>
          </div>
          {[
            { q: 'Como funciona a minera\u00e7\u00e3o?', a: 'Voc\u00ea digita uma palavra-chave (ex: emagrecimento) e o RatoAds varre o Meta Ad Library automaticamente. Em 2\u20133 minutos voc\u00ea recebe todas as ofertas escaladas do nicho.' },
            { q: 'Funciona com qualquer nicho?', a: 'Sim. Low ticket, cursos, f\u00edsicos, servi\u00e7os, afiliados \u2014 qualquer nicho que roda no Facebook/Instagram Ads.' },
            { q: 'Precisa saber programar?', a: 'N\u00e3o. Voc\u00ea s\u00f3 digita o nicho e clica em minerar. Tudo \u00e9 100% autom\u00e1tico.' },
            { q: 'O que eu recebo na minera\u00e7\u00e3o?', a: 'Lista de ofertas com score de escalabilidade, quantidade de an\u00fancios ativos, dias rodando, link direto pra biblioteca e landing page.' },
            { q: 'Posso cancelar quando quiser?', a: 'Sim. Sem fidelidade, sem multa. Cancela direto no painel.' },
          ].map(({ q, a }, i) => (
            <div key={q} className="fq sc-top" style={{ transitionDelay: `${i * .07}s` }}>
              <div className="fq-q"><span>{q}</span><span className="fq-ic">+</span></div>
              <div className="fq-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
      </section>

      <div className="sec-divider" />

      <section style={{ padding: '70px 40px 90px', textAlign: 'center' }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div className="sc-top">
            <h2 className="title" style={{ marginBottom: 18 }}><span className="acc">Ofertas Escaladas</span> em 1 clique.</h2>
            <p style={{ fontSize: 16, color: '#444', marginBottom: 40, lineHeight: 1.85, fontWeight: 300 }}>Descubra o que seus concorrentes est{'\u00e3'}o escalando agora</p>
            <a href="#preco" className="btn btn-orange-lg glow" style={{ display: 'inline-flex' }}>Come{'\u00e7'}ar a minerar {'\u2192'}</a>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Logo size="sm" />
        <p style={{ fontSize: 12, color: '#2a2a2a', fontWeight: 400 }}>Minere. Analise. Domine o nicho.</p>
        <p style={{ fontSize: 11, color: '#1a1a1a' }}>{'\u00a9'} {new Date().getFullYear()} RatoAds {'\u2014'} Todos os direitos reservados</p>
      </footer>

      <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo">{'\u2191'}</button>
    </>
  )
}
