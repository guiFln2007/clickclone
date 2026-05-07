'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL || 'https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9'
const PREMIUM_URL = 'https://pay.kirvano.com/c60822ee-79dc-4e2c-ab27-031d405ca57c'

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

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 56 : 44
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="ratoads_" style={{ display: 'block', height: h, width: 'auto' }} />
}

const PRATICA_STEPS = [
  {
    n: '01', t: 'Minera\u00e7\u00e3o Autom\u00e1tica',
    d: 'Digite uma palavra-chave e o RatoAds encontra todas as ofertas escaladas do nicho.',
    video: '/videos/minerador.mp4',
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
    const cur = videoRefs[activeStep].current
    if (cur) cur.pause()
    setActiveStep(idx)
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

          <div className="prt-connector"><div className="prt-line" /></div>

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

          <div className="prt-info">
            <div className="prt-step-label">Passo {step.n}</div>
            <div className="prt-step-title">{step.t}</div>
            <div className="prt-step-desc">{step.d}</div>
          </div>

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
  const [menuOpen, setMenuOpen] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupEmail, setPopupEmail] = useState('')
  const [popupLoading, setPopupLoading] = useState(false)
  const [popupDone, setPopupDone] = useState(false)
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
        lenis = new Lenis({ duration: 0.8, easing: (t: number) => 1 - Math.pow(1 - t, 3), smoothWheel: true, syncTouch: false })
        function raf(time: number) { lenis.raf(time); rafId = requestAnimationFrame(raf) }
        rafId = requestAnimationFrame(raf)
      } catch { /* fallback */ }
    }
    init()
    return () => { if (lenis) lenis.destroy(); if (rafId) cancelAnimationFrame(rafId) }
  }, [])

  // Scroll reveal
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
  }, [])

  // Nav scroll
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

  // Popup delay
  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem('ratoads_popup_seen')
    if (!seen) {
      const t = setTimeout(() => setPopupOpen(true), 25000)
      return () => clearTimeout(t)
    }
  }, [])

  async function handlePopupSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!popupEmail || popupLoading) return
    setPopupLoading(true)
    try {
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: popupEmail }),
      })
      setPopupDone(true)
      localStorage.setItem('ratoads_popup_seen', '1')
    } catch { /* ignore */ }
    setPopupLoading(false)
  }

  function closePopup() {
    setPopupOpen(false)
    localStorage.setItem('ratoads_popup_seen', '1')
  }

  function resScroll(dir: 1 | -1) {
    const el = resScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.offsetWidth, behavior: 'smooth' })
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
        @keyframes pdot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}
        @keyframes tk{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes gp{0%,100%{box-shadow:0 0 0 0 rgba(255,140,0,0)}50%{box-shadow:0 0 40px 10px rgba(255,140,0,.22)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes scroll-bounce{0%,100%{transform:translateY(0) rotate(45deg);opacity:.5}50%{transform:translateY(8px) rotate(45deg);opacity:1}}
        @keyframes arc-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .bg-glow{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;max-width:100vw}
        .bg-glow-1{position:absolute;top:-220px;left:-580px;width:1400px;height:200px;background:linear-gradient(90deg,#FFD0B6,transparent);border-radius:9999px;transform:rotate(43deg);mix-blend-mode:screen;animation:glowStrong 8s ease-in-out infinite alternate}
        .bg-glow-2{position:absolute;top:-300px;left:-680px;width:1800px;height:290px;background:linear-gradient(90deg,#F16517,transparent);border-radius:9999px;transform:rotate(40deg);mix-blend-mode:screen;animation:glowSoft 9.5s ease-in-out infinite alternate}
        .noise{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:.15;mix-blend-mode:plus-lighter;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)'/%3E%3C/svg%3E");background-repeat:repeat;background-size:250px 250px;animation:noisemove .45s steps(1) infinite}

        /* NAV */
        nav{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:200;height:60px;display:flex;align-items:center;padding:0 20px 0 16px;width:calc(100% - 48px);max-width:1100px;background:rgba(10,10,10,.72);border:1px solid rgba(255,255,255,.08);border-radius:16px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:background .3s ease,border-color .3s ease;box-shadow:0 4px 32px rgba(0,0,0,.4)}
        nav.nav-scrolled{background:rgba(6,6,6,.9);border-color:rgba(255,255,255,.1)}
        @media(max-width:640px){nav{display:none !important}}
        .nav-logo{display:flex;align-items:center;flex-shrink:0}.nav-logo img{height:36px;width:auto;display:block}
        .nav-center{display:flex;align-items:center;gap:4px;position:absolute;left:50%;transform:translateX(-50%)}
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

        /* BUTTONS */
        .btn{display:inline-flex;align-items:center;gap:8px;font-family:'Sora',sans-serif;font-weight:700;border-radius:8px;border:none;text-decoration:none;position:relative;overflow:hidden;transition:all .25s cubic-bezier(.16,1,.3,1);cursor:pointer}
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
        .wrap-w{max-width:1160px;margin:0 auto;padding:0 16px}
        .sec-divider{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);margin:0 40px;position:relative;z-index:1}
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

        /* HERO */
        .hero{min-height:auto;display:flex;align-items:center;padding:180px 40px 100px;position:relative;overflow:hidden;text-align:center}
        @media(max-width:640px){.hero{padding:60px 16px 40px;flex-direction:column;min-height:auto}}
        .hero-mobile-logo{display:none}
        @media(max-width:640px){.hero-mobile-logo{display:flex;justify-content:center;width:100%;order:-1;margin-bottom:16px;flex-shrink:0}.hero-mobile-logo img{height:50px;width:auto;filter:drop-shadow(0 0 18px rgba(255,140,0,.4))}.hero-inner{width:100%}.vsl-placeholder{border-radius:12px}.vsl-play{width:60px;height:60px}.vsl-label{font-size:11px}}
        .hero-inner{max-width:900px;margin:0 auto;width:100%;position:relative;z-index:1}
        .hero-h1{font-size:clamp(30px,5vw,56px);font-weight:800;line-height:1.06;letter-spacing:-.05em;margin-bottom:24px;margin-top:0}
        .hero-h1 .acc{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .hero-sub{font-size:17px;color:#555;line-height:1.75;margin-bottom:40px;max-width:560px;margin-left:auto;margin-right:auto;font-weight:300}
        @media(max-width:640px){.hero-h1{font-size:clamp(24px,7vw,34px);margin-bottom:16px;letter-spacing:-.04em}.hero-sub{font-size:13.5px;margin-bottom:20px}}

        /* MINI VSL */
        .vsl-wrap{max-width:960px;margin:0 auto;width:100%}
        .vsl-placeholder{position:relative;width:100%;aspect-ratio:16/9;background:linear-gradient(180deg,#0a0a0a 0%,#111 100%);border:1px solid rgba(255,140,0,.15);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;overflow:hidden;cursor:pointer;transition:border-color .3s,box-shadow .3s}
        .vsl-placeholder:hover{border-color:rgba(255,140,0,.35);box-shadow:0 0 60px rgba(255,140,0,.08)}
        .vsl-placeholder::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.025) 1px,transparent 1px);background-size:22px 22px;pointer-events:none}
        .vsl-play{width:80px;height:80px;border-radius:50%;background:linear-gradient(180deg,#FF7A1A 0%,#E8692A 100%);display:flex;align-items:center;justify-content:center;padding-left:4px;box-shadow:0 12px 32px rgba(255,106,0,.55),0 0 0 4px rgba(255,106,0,.12);transition:transform .2s,box-shadow .2s;position:relative;z-index:1}
        .vsl-placeholder:hover .vsl-play{transform:scale(1.08);box-shadow:0 16px 40px rgba(255,106,0,.7),0 0 0 6px rgba(255,106,0,.14)}
        .vsl-label{font-size:13px;color:#444;font-weight:500;letter-spacing:.02em;position:relative;z-index:1}

        /* TICKER */
        .ticker{overflow:hidden;padding:18px 0;background:#030303;border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);position:relative;z-index:1}
        .tk-in{display:flex;gap:64px;width:max-content;animation:tk 24s linear infinite}
        .tk-in:hover{animation-play-state:paused}
        .tk-i{display:flex;align-items:center;gap:8px;font-size:12px;color:#252525;white-space:nowrap;font-weight:500}
        .tk-i .hl{color:#FF8C00;font-weight:700}

        /* PRA QUEM */
        .quem-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
        @media(max-width:640px){.quem-grid{grid-template-columns:1fr}}
        .quem-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:32px 28px;position:relative;overflow:hidden;transition:transform .4s cubic-bezier(.16,1,.3,1),border-color .35s,box-shadow .35s}
        .quem-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,140,0,.2),transparent)}
        .quem-card:hover{transform:translateY(-4px);border-color:rgba(255,140,0,.25);box-shadow:0 20px 60px rgba(0,0,0,.5)}
        .quem-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.15);display:flex;align-items:center;justify-content:center;margin-bottom:20px}
        .quem-title{font-size:17px;font-weight:700;margin-bottom:8px;letter-spacing:-.02em;color:#fff}
        .quem-desc{font-size:13.5px;color:#555;line-height:1.75;font-weight:300}

        /* FEATURES */
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
        @media(max-width:640px){section{padding:48px 16px}.sec-divider{margin:0 16px}.wrap{padding:0}.wrap-w{padding:0 12px}.sec-hd{margin-bottom:32px}h2.title{font-size:clamp(22px,6.5vw,34px)}.feat-c{padding:28px 22px}.feat-t{font-size:17px}.feat-d{font-size:12.5px}}

        /* RESULTS CAROUSEL */
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

        /* STEPS */
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
        @media(max-width:640px){#como-funciona .sec-hd + div{grid-template-columns:1fr !important;gap:20px}.step-c{padding:28px 20px 24px}.step-t{font-size:16px;min-height:auto}.step-d{font-size:12px}}

        /* BONUS CARDS */
        .bonus-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:900px;margin:0 auto}
        .bonus-grid-bottom{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:600px;margin:16px auto 0}
        @media(max-width:768px){.bonus-grid{grid-template-columns:1fr}.bonus-grid-bottom{grid-template-columns:1fr}}
        .bonus-card{background:#06080f;border:1px solid rgba(255,140,0,.12);border-radius:18px;padding:32px 24px;text-align:center;position:relative;overflow:hidden;transition:transform .4s cubic-bezier(.16,1,.3,1),border-color .35s,box-shadow .35s,background .35s;display:flex;flex-direction:column;align-items:center}
        .bonus-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,140,0,.25),transparent)}
        .bonus-card::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.03) 1px,transparent 1px);background-size:22px 22px;pointer-events:none}
        .bonus-card:hover{transform:translateY(-4px);border-color:rgba(255,140,0,.3);background:#080b15;box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,140,0,.15)}
        .bonus-card-icon{width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,140,0,.25);background:rgba(255,140,0,.06);display:flex;align-items:center;justify-content:center;margin-bottom:20px;position:relative;z-index:1;transition:border-color .3s,box-shadow .3s}
        .bonus-card:hover .bonus-card-icon{border-color:rgba(255,140,0,.5);box-shadow:0 0 24px rgba(255,140,0,.15)}
        .bonus-card-icon::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:1.5px solid transparent;border-top-color:rgba(255,140,0,.5);border-right-color:rgba(255,140,0,.1);animation:arc-spin 4s linear infinite}
        .bonus-card-title{font-size:17px;font-weight:700;margin-bottom:8px;letter-spacing:-.02em;color:#fff;position:relative;z-index:1}
        .bonus-card-desc{font-size:13px;color:#666;line-height:1.7;font-weight:300;position:relative;z-index:1}
        .bonus-card-price{font-size:11px;font-weight:700;color:#ef4444;text-decoration:line-through;opacity:.7;margin-top:12px;position:relative;z-index:1}
        @media(max-width:640px){.bonus-card{padding:24px 20px}.bonus-card-title{font-size:15px}.bonus-card-desc{font-size:12px}}

        /* PRICING */
        .price-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;align-items:stretch;max-width:720px;margin:0 auto}
        @media(max-width:680px){.price-grid{grid-template-columns:1fr;max-width:520px}}
        @media(max-width:560px){.price-grid{max-width:100%;gap:16px}.price-c{padding:24px 20px;border-radius:16px}.price-am{font-size:42px !important}.pack-title{font-size:15px}.plan-badge{font-size:9px;padding:4px 8px}.pf{font-size:12.5px;padding:9px 0;gap:8px}.price-header{flex-direction:column;gap:8px}.price-block{text-align:left}.pf-bonus{font-size:12px}}
        .pack-title{font-size:18px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;line-height:1}
        .price-c{background:rgba(255,255,255,.02);border:2px solid rgba(255,255,255,.07);border-radius:20px;padding:40px 36px;position:relative;overflow:hidden;backdrop-filter:blur(14px);display:flex;flex-direction:column;height:100%;transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s ease,border-color .4s ease}
        .price-c:hover{transform:translateY(-6px) scale(1.025)}
        .price-c::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#FF8C00,transparent)}
        .price-c::after{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,140,0,.06) 0%,transparent 70%);pointer-events:none}
        .price-header{margin-bottom:28px}
        .price-am{font-size:52px;font-weight:800;letter-spacing:-.04em;line-height:1;margin-top:16px;background:linear-gradient(135deg,#fff,#aaa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .price-cents{font-size:22px;font-weight:700;letter-spacing:0}
        .price-period{font-size:12px;color:#444;margin-top:6px;font-weight:400}
        .price-features{margin-bottom:20px}
        .price-features .pf{padding:10px 0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.04)}
        .price-features .pf:last-child{border-bottom:none}
        .price-bonus{border-top:1px solid rgba(255,140,0,.12);padding-top:16px;margin-bottom:24px}
        .price-bonus-label{font-size:10px;font-weight:700;color:#FF8C00;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px}
        .pf-bonus{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px;color:#888}
        .pf-bonus-check{color:#FF8C00;font-size:12px;font-weight:800;flex-shrink:0}
        .price-cta{width:100%;justify-content:center;font-size:15.5px;padding:18px 32px;border-radius:10px;margin-top:auto}
        .price-sub{text-align:center;font-size:11.5px;color:#2a2a2a;margin-top:12px}
        @media(max-width:560px){.price-am{font-size:42px !important}}
        .price-c-premium{border:2px solid #FFB347;background:linear-gradient(180deg,rgba(255,140,0,.06),rgba(255,255,255,.02));box-shadow:0 0 0 1px rgba(255,228,181,.6),0 0 18px rgba(255,140,0,.7),0 0 48px rgba(255,140,0,.45),0 0 90px rgba(255,140,0,.25),inset 0 0 24px rgba(255,140,0,.08),0 24px 80px rgba(0,0,0,.5)}
        .price-c-premium::before{display:none}
        .price-c-premium::after{background:radial-gradient(circle,rgba(255,140,0,.14) 0%,transparent 70%);width:280px;height:280px;top:-80px;right:-80px}
        .price-c-premium:hover{box-shadow:0 0 0 1px rgba(255,228,181,.8),0 0 24px rgba(255,140,0,.85),0 0 64px rgba(255,140,0,.6),0 0 110px rgba(255,140,0,.35),inset 0 0 28px rgba(255,140,0,.12),0 28px 90px rgba(0,0,0,.6)}
        .price-am{font-size:62px;font-weight:800;letter-spacing:-.05em;line-height:1;background:linear-gradient(135deg,#fff,#aaa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .pf{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13.5px;font-weight:400}
        .pf:last-of-type{border-bottom:none}
        .pc{color:#FF8C00;font-size:12px;flex-shrink:0}
        .plan-badge{font-size:10px;font-weight:800;padding:5px 12px;border-radius:6px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;flex-shrink:0}
        .plan-badge-starter{background:rgba(255,255,255,.06);color:#888;border:1px solid rgba(255,255,255,.1)}
        .plan-badge-premium{background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border:none;box-shadow:0 4px 14px rgba(255,107,0,.35)}
        .pack-shine{background:linear-gradient(110deg,#FF8C00 10%,#FFE4B5 25%,#FFB347 40%,#FF8C00 60%,#FFE4B5 75%,#FF8C00 90%);background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;color:transparent;animation:shine-slide 3.5s linear infinite;filter:drop-shadow(0 0 12px rgba(255,180,80,.4))}
        @keyframes shine-slide{0%{background-position:200% 0}100%{background-position:-100% 0}}

        /* FAQ */
        .fq{border-bottom:1px solid rgba(255,255,255,.05)}
        .fq-q{display:flex;justify-content:space-between;align-items:center;padding:24px 0;gap:16px;cursor:pointer}
        .fq-q span:first-child{font-weight:600;font-size:15px;letter-spacing:-.01em}
        .fq-ic{color:#FF8C00;font-size:24px;flex-shrink:0;transition:transform .35s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-ic{transform:rotate(45deg)}
        .fq-a{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.16,1,.3,1)}
        .fq.open .fq-a{max-height:200px}
        .fq-a p{font-size:14px;color:#555;line-height:1.85;padding-bottom:22px;font-weight:300}

        /* MISC */
        .back-top{position:fixed;bottom:28px;right:28px;z-index:100;width:44px;height:44px;border-radius:50%;background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.22);color:#FF8C00;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .25s;backdrop-filter:blur(8px);cursor:pointer}
        .back-top:hover{background:rgba(255,140,0,.22);transform:translateY(-2px)}
        .scroll-hint{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:#252525;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;z-index:2}
        @media(max-width:640px){.scroll-hint{display:none}}
        .scroll-arrow{width:18px;height:18px;border-right:1.5px solid #2a2a2a;border-bottom:1.5px solid #2a2a2a;animation:scroll-bounce 1.8s ease-in-out infinite}

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

      {/* NAV */}
      <nav>
        <div className="nav-logo"><Link href="/"><Logo size="sm" /></Link></div>
        <div className="nav-center">
          <a href="#pra-quem" className="btn-nav-ghost">Pra quem</a>
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
            <a href="#pra-quem" onClick={() => setMenuOpen(false)}>Pra quem</a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a>
            <a href="#preco" onClick={() => setMenuOpen(false)}>Planos</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>D{'\u00fa'}vidas</a>
          </div>
        )}
      </nav>

      {/* ============ HERO ============ */}
      <div className="hero">
        <div className="noise" aria-hidden />
        <div className="hero-mobile-logo"><img src="/logo.png" alt="ratoads" /></div>
        <div className="hero-inner">
          <h1 className="hero-h1 sc-top" style={{ transitionDelay: '.2s' }}>
            Minere e analise ofertas de forma{' '}<span className="acc">100% autom{'\u00e1'}tica</span>{' '}no&nbsp;low&#8209;ticket
          </h1>
          <p className="sc-top" style={{ transitionDelay: '.3s', fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' }}>
            Assista o v{'\u00ed'}deo abaixo {'\ud83d\udc47'}
          </p>

          {/* VSL Panda */}
          <div className="vsl-wrap sc-top" style={{ transitionDelay: '.4s' }}>
            <iframe
              id="panda-f5f61353-54ae-435a-9f65-a762d4893f56"
              src="https://player-vz-be1cbbe9-2ec.tv.pandavideo.com.br/embed/?v=749097d8-1e3d-4509-b7ee-e5878573c905"
              style={{ border: 'none', width: '100%', aspectRatio: '16/9', borderRadius: 16 }}
              allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="sc-top" style={{ transitionDelay: '.5s', marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p style={{ fontSize: 15, color: '#888', fontWeight: 400, lineHeight: 1.6, maxWidth: 480, textAlign: 'center', marginBottom: 4 }}>
              Descubra em segundos quais ofertas est{'\u00e3'}o escalando, analise pontos fracos dos concorrentes e entre com vantagem.
            </p>
            <a href="#preco" className="btn btn-orange-lg glow">Quero come{'\u00e7'}ar agora {'\u2192'}</a>
            <span style={{ fontSize: 12, color: '#333' }}>Acesso imediato {'\u00b7'} Cancele quando quiser</span>
          </div>
        </div>
        <div className="scroll-hint sc-fade" style={{ transitionDelay: '1.2s' }}><span>Continuar</span><div className="scroll-arrow" /></div>
      </div>

      {/* TICKER */}
      <div className="ticker">
        <div className="tk-in">
          {[...Array(2)].map((_, rep) => (
            <div key={rep} style={{ display: 'flex', gap: 64 }}>
              <span className="tk-i"><span className="hl">Minera{'\u00e7\u00e3'}o</span> autom{'\u00e1'}tica</span>
              <span className="tk-i"><span className="hl">Score</span> de escalabilidade</span>
              <span className="tk-i"><span className="hl">An{'\u00e1'}lise</span> de concorrentes</span>
              <span className="tk-i"><span className="hl">Roteiros</span> de CTV prontos</span>
              <span className="tk-i"><span className="hl">Rastreamento</span> di{'\u00e1'}rio</span>
              <span className="tk-i"><span className="hl">Landing page</span> analisada</span>
              <span className="tk-i"><span className="hl">Minera{'\u00e7\u00e3'}o</span> autom{'\u00e1'}tica</span>
              <span className="tk-i"><span className="hl">Score</span> de escalabilidade</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sec-divider" />

      {/* ============ PRA QUEM É ============ */}
      <section id="pra-quem">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Pra quem {'\u00e9'}</span></div>
            <h2 className="title">Pra quem {'\u00e9'} o <span className="acc">RatoAds?</span></h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="quem-card sc-top" style={{ transitionDelay: '0s' }}>
              <div className="quem-icon">
                <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{width:28,height:28}}><path d="M3 13 Q16 3 24 6 Q32 3 45 13 Q32 9 24 11 Q16 9 3 13 Z" fill="#FF8C00"/><rect x="22" y="10" width="4" height="26" rx="1.4" fill="#FF8C00"/><rect x="20.5" y="34" width="7" height="4" rx="1.5" fill="#FF8C00"/><circle cx="34" cy="28" r="6" stroke="#FFB347" strokeWidth="2.5" fill="none"/><line x1="38.5" y1="32.5" x2="43" y2="37" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
              <div className="quem-title">Operadores de low ticket</div>
              <div className="quem-desc">Automatize a busca por ofertas validadas, economize tempo e escale suas ofertas de forma r{'\u00e1'}pida, sem ficar horas vasculhando a biblioteca de an{'\u00fa'}ncios manualmente.</div>
            </div>
            <div className="quem-card sc-top" style={{ transitionDelay: '.1s' }}>
              <div className="quem-icon">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:28,height:28}}><rect x="4" y="8" width="28" height="20" rx="3" stroke="#FF8C00" strokeWidth="3" fill="rgba(255,140,0,.08)"/><polygon points="40 14 33 18 40 22" fill="#FF8C00"/><rect x="10" y="14" width="3" height="8" rx="1" fill="#FFB347"/><rect x="15" y="12" width="3" height="10" rx="1" fill="#FF8C00"/><rect x="20" y="10" width="3" height="12" rx="1" fill="#FFB347"/><rect x="25" y="16" width="3" height="6" rx="1" fill="#FF8C00"/><path d="M8 34h32" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4"/><circle cx="14" cy="38" r="3" stroke="#FFB347" strokeWidth="2" fill="none"/><circle cx="24" cy="38" r="3" stroke="#FF8C00" strokeWidth="2" fill="none"/><circle cx="34" cy="38" r="3" stroke="#FFB347" strokeWidth="2" fill="none"/></svg>
              </div>
              <div className="quem-title">Vendedores de Infoprodutos</div>
              <div className="quem-desc">Descubra quais ofertas digitais est{'\u00e3'}o escalando, modele estruturas validadas e lance seu produto com dados reais do mercado.</div>
            </div>
            <div className="quem-card sc-top" style={{ transitionDelay: '.2s' }}>
              <div className="quem-icon">
                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:28,height:28}}><rect x="6" y="6" width="36" height="28" rx="4" stroke="#FF8C00" strokeWidth="3" fill="rgba(255,140,0,.08)"/><path d="M6 14h36" stroke="#FF8C00" strokeWidth="2"/><circle cx="12" cy="10" r="1.5" fill="#FFB347"/><circle cx="17" cy="10" r="1.5" fill="#FF8C00"/><circle cx="22" cy="10" r="1.5" fill="#FFB347"/><path d="M14 22l4 4 8-8" stroke="#FF8C00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="38" x2="32" y2="38" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="24" y1="34" x2="24" y2="38" stroke="#FF8C00" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
              <div className="quem-title">Criadores de SaaS</div>
              <div className="quem-desc">Analise como concorrentes posicionam suas ofertas, entenda o que funciona no mercado e use dados reais pra validar seu produto antes de construir.</div>
            </div>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* ============ COMO FUNCIONA ============ */}
      <section id="como-funciona">
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>Processo</span></div>
            <h2 className="title">Encontre a oferta e modele<br /><span className="acc">em 3 passos</span></h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative' }}>
            {[
              { n: '01', t: 'Minera\u00e7\u00e3o Autom\u00e1tica', d: 'Digite uma palavra-chave e receba ofertas escaladas prontas para voc\u00ea escolher a de sua prefer\u00eancia.', dir: 'sc-left',
                icon: <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}><path d="M3 13 Q16 3 24 6 Q32 3 45 13 Q32 9 24 11 Q16 9 3 13 Z" fill="#FF8C00"/><rect x="22" y="10" width="4" height="32" rx="1.4" fill="#FF8C00"/><rect x="20.5" y="40" width="7" height="4" rx="1.5" fill="#FF8C00"/></svg> },
              { n: '02', t: 'An\u00e1lise Completa', d: 'Com um clique receba uma an\u00e1lise completa com score de 1 a 10, transcri\u00e7\u00e3o de todos os criativos e modelagem dos mais escalados, corrigindo pontos fracos e potencializando os fortes.', dir: 'sc-top',
                icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:42,height:42}}><circle cx="19" cy="19" r="15" fill="rgba(255,140,0,.08)"/><circle cx="19" cy="19" r="15" stroke="#FF8C00" strokeWidth="4.5"/><rect x="9" y="22" width="4" height="7" rx="1" fill="#FF8C00"/><rect x="15" y="18" width="4" height="11" rx="1" fill="#FF8C00"/><rect x="21" y="14" width="4" height="15" rx="1" fill="#FF8C00"/><polyline points="11,21 17,17 23,13 27,15" stroke="#FFB347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="11" cy="21" r="1.5" fill="#FFB347"/><circle cx="17" cy="17" r="1.5" fill="#FFB347"/><circle cx="23" cy="13" r="1.5" fill="#FFB347"/><line x1="30" y1="30" x2="44" y2="44" stroke="#FF8C00" strokeWidth="5.5" strokeLinecap="round"/></svg> },
              { n: '03', t: 'Rastreamento da oferta', d: 'Adicione a biblioteca de an\u00fancios da oferta escolhida no rastreamento e acompanhe em tempo real os ads ativos e como eles variam diariamente.', dir: 'sc-right',
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

      {/* ============ RESULTADOS / PROVA SOCIAL ============ */}
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

      <div className="sec-divider" />

      {/* ============ B{'\u00d4'}NUS ============ */}
      <section id="bonus">
        <div className="wrap">
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>B{'\u00f4'}nus inclusos</span></div>
            <h2 className="title">Voc{'\u00ea'} ainda recebe<br /><span className="acc">de gra{'\u00e7'}a</span></h2>
          </div>
          <div className="bonus-grid">
            {/* Roteiros CTV */}
            <div className="bonus-card sc-top" style={{ transitionDelay: '0s' }}>
              <div className="bonus-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <div className="bonus-card-title">3 Roteiros de CTV</div>
              <div className="bonus-card-desc">Hook + {'\u00e2'}ngulo + script completo baseados nos criativos mais escalados do concorrente.</div>
              <div className="bonus-card-price">R$97</div>
            </div>

            {/* Rastreamento */}
            <div className="bonus-card sc-top" style={{ transitionDelay: '.08s' }}>
              <div className="bonus-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="bonus-card-title">Rastreamento di{'\u00e1'}rio</div>
              <div className="bonus-card-desc">Acompanhe em tempo real quantos ads a oferta tem ativos. Suba quando escala, saia quando cai.</div>
              <div className="bonus-card-price">R$47</div>
            </div>

            {/* Histórico */}
            <div className="bonus-card sc-top" style={{ transitionDelay: '.16s' }}>
              <div className="bonus-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="bonus-card-title">Hist{'\u00f3'}rico de varia{'\u00e7\u00f5'}es</div>
              <div className="bonus-card-desc">Veja a evolu{'\u00e7\u00e3'}o dos an{'\u00fa'}ncios dia a dia. Saiba quando o concorrente testou algo novo.</div>
              <div className="bonus-card-price">R$37</div>
            </div>
          </div>

          <div className="bonus-grid-bottom">
            {/* Grupo VIP */}
            <div className="bonus-card sc-top" style={{ transitionDelay: '.24s' }}>
              <div className="bonus-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="bonus-card-title">Grupo VIP exclusivo</div>
              <div className="bonus-card-desc">Acesso ao grupo fechado com outros operadores. Troca de ideias, ofertas e estrat{'\u00e9'}gias em tempo real.</div>
              <div className="bonus-card-price">R$197</div>
            </div>

            {/* Comunidade Discord */}
            <div className="bonus-card sc-top" style={{ transitionDelay: '.32s' }}>
              <div className="bonus-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div className="bonus-card-title">Comunidade no Discord</div>
              <div className="bonus-card-desc">Canal dedicado pra tirar d{'\u00fa'}vidas, compartilhar resultados e networking com quem vive de tr{'\u00e1'}fego pago.</div>
              <div className="bonus-card-price">R$97</div>
            </div>
          </div>

          <div id="preco" className="sec-hd sc-top" style={{ marginTop: 80, marginBottom: 40 }}>
            <div className="sec-label"><span>Planos</span></div>
            <h2 className="title">ESCOLHA SEU <span className="acc">PLANO:</span></h2>
          </div>
          <div className="price-grid" style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* STARTER */}
            <div className="price-c sc-top">
              <div className="price-header">
                <span className="plan-badge plan-badge-starter">Starter</span>
                <div className="pack-title acc" style={{ marginTop: 14 }}>STARTER PACK</div>
                <div className="price-am">R$57<span className="price-cents">,90</span></div>
                <div className="price-period">/m{'\u00ea'}s</div>
              </div>

              <div className="price-features">
                {['10 minera\u00e7\u00f5es por m\u00eas','10 an\u00e1lises por m\u00eas','10 slots de rastreamento'].map(f => (
                  <div className="pf" key={f}><span className="pc">{'\u2726'}</span><span>{f}</span></div>
                ))}
              </div>

              <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange glow IC-Geral price-cta">Come{'\u00e7'}ar agora {'\u2192'}</a>
              <p className="price-sub">Acesso imediato {'\u00b7'} Cancele quando quiser</p>
            </div>

            {/* PREMIUM */}
            <div className="price-c price-c-premium sc-top">
              <div className="price-header" style={{ position: 'relative', zIndex: 1 }}>
                <span className="plan-badge plan-badge-premium">{'\u2605'} Mais popular</span>
                <div className="pack-title pack-shine" style={{ marginTop: 14 }}>PREMIUM PACK</div>
                <div className="price-am">R$147<span className="price-cents">,90</span></div>
                <div className="price-period">/trimestre <span style={{ color: '#FF8C00', fontWeight: 600 }}>(~R$49/m{'\u00ea'}s)</span></div>
              </div>

              <div className="price-features">
                {['20 minera\u00e7\u00f5es por m\u00eas','20 an\u00e1lises por m\u00eas','20 slots de rastreamento'].map(f => (
                  <div className="pf" key={f}><span className="pc">{'\u2726'}</span><span>{f}</span></div>
                ))}
              </div>

              <div className="price-bonus">
                <div className="price-bonus-label">B{'\u00f4'}nus inclusos</div>
                {['3 roteiros de CTV por an\u00e1lise','Rastreamento di\u00e1rio autom\u00e1tico','Hist\u00f3rico de varia\u00e7\u00f5es','Grupo VIP exclusivo','Comunidade no Discord'].map(b => (
                  <div className="pf-bonus" key={b}><span className="pf-bonus-check">{'\u2713'}</span><span>{b}</span></div>
                ))}
              </div>

              <a href={PREMIUM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-orange glow IC-Geral price-cta">Quero o Premium {'\u2192'}</a>
              <p className="price-sub">Acesso imediato {'\u00b7'} Cancele quando quiser</p>
            </div>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* ============ GARANTIA ============ */}
      <section style={{ padding: '60px 40px', textAlign: 'center' }}>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="sc-top" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/garantia.png" alt="Garantia de 7 dias" style={{ width: 140, height: 'auto', filter: 'drop-shadow(0 0 20px rgba(255,180,0,.25))' }} />
            <h2 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.2 }}>
              Garantia de <span style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>7 dias</span>
            </h2>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, fontWeight: 300 }}>
              Se em 7 dias voc{'\u00ea'} sentir que o RatoAds n{'\u00e3'}o vale o investimento, devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia.
            </p>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* ============ FAQ ============ */}
      <section id="faq" style={{ paddingBottom: 60 }}>
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="sec-hd sc-top">
            <div className="sec-label"><span>FAQ</span></div>
            <h2 className="title">D{'\u00fa'}vidas frequentes</h2>
          </div>
          {[
            { q: 'Como funciona a minera\u00e7\u00e3o?', a: 'Voc\u00ea digita uma palavra-chave (ex: emagrecimento) e o RatoAds varre o Meta Ad Library automaticamente. Em 2\u20133 minutos voc\u00ea recebe todas as ofertas escaladas do nicho.' },
            { q: 'Funciona com qualquer nicho?', a: 'Sim. Low ticket, cursos, f\u00edsicos, servi\u00e7os, afiliados , qualquer nicho que roda no Facebook/Instagram Ads.' },
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

      {/* CTA FINAL */}
      <section style={{ padding: '70px 40px 90px', textAlign: 'center' }}>
        <div className="wrap" style={{ maxWidth: 600 }}>
          <div className="sc-top">
            <h2 className="title" style={{ marginBottom: 18 }}>Ofertas escaladas<br />h{'\u00e1'} <span className="acc">1 clique</span> seu</h2>
            <p style={{ fontSize: 16, color: '#444', marginBottom: 40, lineHeight: 1.85, fontWeight: 300 }}>Seus concorrentes j{'\u00e1'} est{'\u00e3'}o escalando com dados reais. Pare de adivinhar e entre com vantagem.</p>
            <a href="#preco" className="btn btn-orange-lg glow" style={{ display: 'inline-flex' }}>Come{'\u00e7'}ar a minerar {'\u2192'}</a>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '40px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Logo size="sm" />
        <p style={{ fontSize: 12, color: '#2a2a2a', fontWeight: 400 }}>Minere. Analise. Domine o nicho.</p>
        <p style={{ fontSize: 11, color: '#1a1a1a' }}>{'\u00a9'} {new Date().getFullYear()} RatoAds , Todos os direitos reservados</p>
      </footer>

      <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Voltar ao topo">{'\u2191'}</button>

      {/* Popup cupom */}
      {popupOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }} onClick={closePopup}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '1px solid rgba(255,140,0,.3)', borderRadius: 16, padding: '36px 32px', maxWidth: 420, width: '90%', position: 'relative', boxShadow: '0 24px 80px rgba(255,140,0,.15)' }}>
            <button onClick={closePopup} style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>{'\u00d7'}</button>
            {!popupDone ? (
              <>
                <div style={{ fontSize: 13, color: '#E8692A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Oferta exclusiva</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 8 }}>Ganhe <span style={{ color: '#E8692A' }}>10% de desconto</span> na sua primeira assinatura</div>
                <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>Deixa seu email e a gente te manda o cupom na hora.</p>
                <form onSubmit={handlePopupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email"
                    placeholder="Seu melhor email"
                    value={popupEmail}
                    onChange={e => setPopupEmail(e.target.value)}
                    required
                    style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: '14px 16px', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button type="submit" disabled={popupLoading} style={{ background: '#E8692A', color: '#fff', border: 'none', padding: '16px 24px', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {popupLoading ? 'Enviando...' : 'Quero meu cupom'}
                  </button>
                </form>
                <p style={{ fontSize: 11, color: '#333', textAlign: 'center', marginTop: 12 }}>Sem spam. S{'\u00f3'} o cupom.</p>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2705'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Cupom enviado!</div>
                <p style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>Confere seu email. O cupom <strong style={{ color: '#E8692A' }}>DESCONTO10</strong> j{'\u00e1'} t{'\u00e1'} l{'\u00e1'}.</p>
                <button onClick={closePopup} style={{ background: '#E8692A', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
