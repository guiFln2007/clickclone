'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Analysis {
  score: number
  verdict: string
  reason: string
  dominant_angle: string
  hook_patterns?: string[]
  page_name: string
  niche?: string
  price_anchor?: string | null
  funnel_type?: string
  design_context?: { vibe?: string; primary_color?: string }
  weak_points: string[]
  strong_points: string[]
  ad_analysis?: {
    total_ads: number
    dominant_hooks: string[]
    copy_patterns: string
    escalation_signal: string
  }
  ctv_recommendations: { hook: string; angle: string; script: string }[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  image?: string
}

interface Project {
  id: string
  name: string
  score: number
  html: string
  analysis: Analysis
  url: string
  createdAt: number
}

// STEPS removido — substituído por SSE real do backend

function getSessionId(): string {
  const key = 'cc_session_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function timeAgo(ts: number) {
  const d = (Date.now() - ts) / 1000
  if (d < 60) return 'agora mesmo'
  if (d < 3600) return `${Math.floor(d / 60)}min atrás`
  if (d < 86400) return `${Math.floor(d / 3600)}h atrás`
  return `${Math.floor(d / 86400)}d atrás`
}

function ScoreRing({ score }: { score: number }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const dash = (score / 10) * circ
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="#111" strokeWidth="5" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="#FF8C00" strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 42 42)"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)' }}
      />
      <text x="42" y="44" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Roboto,sans-serif">{score}</text>
      <text x="42" y="56" textAnchor="middle" fill="#444" fontSize="9" fontFamily="Roboto,sans-serif">/10</text>
    </svg>
  )
}

function ProjectThumb({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.19)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (ref.current) setScale(ref.current.offsetWidth / 1440)
  }, [])

  function startScroll() {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    const body = doc.body || doc.documentElement
    const totalHeight = body.scrollHeight - (ref.current?.offsetHeight ?? 200) / scale
    if (totalHeight <= 0) return
    let pos = 0
    const step = 1.2
    scrollTimerRef.current = setInterval(() => {
      pos += step
      if (pos >= totalHeight) pos = 0
      body.scrollTop = pos
    }, 16)
  }

  function stopScroll() {
    if (scrollTimerRef.current) {
      clearInterval(scrollTimerRef.current)
      scrollTimerRef.current = null
    }
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      const body = doc.body || doc.documentElement
      body.scrollTop = 0
    }
  }

  return (
    <div ref={ref} className="proj-thumb" onMouseEnter={startScroll} onMouseLeave={stopScroll}>
      <iframe ref={iframeRef} srcDoc={html} scrolling="yes" title="thumb"
        style={{ width: 1440, height: 5400, border: 'none', pointerEvents: 'none', transform: `scale(${scale})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

function renderMsg(content: string) {
  return content.split('\n').map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith('**')
        ? <strong key={i} style={{ color: '#FF8C00', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )
    return <span key={li}>{parts}{li < content.split('\n').length - 1 ? <br /> : null}</span>
  })
}

function syntaxHighlight(code: string): string {
  const esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  return esc
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g,'<span class="sh-cm">$1</span>')
    .replace(/(&lt;\/?)([\w-]+)/g,'$1<span class="sh-tag">$2</span>')
    .replace(/ ([\w:-]+)(=&quot;)(.*?)(&quot;)/g,' <span class="sh-attr">$1</span>$2<span class="sh-str">$3</span>$4')
}

interface ReportViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase1: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase2: Record<string, any>
  screenshots: string[]
  phase3Loading: boolean
  phase3Lines: { text: string; type: string }[]
  onBack: () => void
  onGenerate: () => void
}

function ReportSection({ label, badge, badgeCls, children }: { label: string; badge?: string; badgeCls?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rpt-section">
      <div className="rpt-section-hd" onClick={() => setOpen(o => !o)}>
        <span className="rpt-sec-label">{label}</span>
        {badge && <span className={`rpt-sec-badge ${badgeCls || ''}`}>{badge}</span>}
        <span className={`rpt-chevron${open ? ' open' : ''}`}>▼</span>
      </div>
      {open && <div className="rpt-section-body">{children}</div>}
    </div>
  )
}

function ReportView({ phase1, phase2, screenshots, phase3Loading, phase3Lines, onBack, onGenerate }: ReportViewProps) {
  const nota = phase1.nota_entrada || {}
  const facilidade = nota.facilidade ?? 0
  const escalabilidade = nota.escalabilidade ?? 0
  const score = nota.score ?? 0

  const copyPatterns: string[] = phase1.copy_patterns || []
  const formatos: string[] = phase1.formatos_validados || []
  const pontosFragosCriativos: string[] = phase1.pontos_fracos_criativos || []

  const analise = phase2.analise_de_copy || {}
  const design = phase2.analise_de_design || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estrutura: Record<string, any>[] = phase2.estrutura || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pontosFracos: Record<string, any>[] = phase2.pontos_fracos || []
  const elementosFuncionam: string[] = phase2.elementos_que_funcionam || []
  const paleta: string[] = design.paleta_dominante || []

  const r = 34, circ = 2 * Math.PI * r, dash = (score / 10) * circ

  return (
    <div className="report-wrap">
      <div className="report-topbar">
        <button className="report-back" onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="report-title">Análise concluída</span>
        <span className="report-subtitle">{phase2.url_analisada || ''}</span>
      </div>

      <div className="report-body">

        {/* Phase 1 — Ads */}
        <ReportSection label="Fase 1 — Análise dos Anúncios" badge="Meta Ad Library" badgeCls="p1">
          <div className="score-ring-wrap">
            <svg className="score-ring-svg" width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r={r} fill="none" stroke="#111" strokeWidth="5" />
              <circle cx="42" cy="42" r={r} fill="none" stroke="#E8692A" strokeWidth="5"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform="rotate(-90 42 42)"
                style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)' }}
              />
              <text x="42" y="44" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Roboto,sans-serif">{score}</text>
              <text x="42" y="56" textAnchor="middle" fill="#444" fontSize="9" fontFamily="Roboto,sans-serif">/10</text>
            </svg>
            <div className="score-ring-info">
              <div className="score-sub">
                <span className="score-sub-lbl">Facilidade</span>
                <div className="score-sub-bar"><div className="score-sub-fill" style={{ width: `${(facilidade / 5) * 100}%` }} /></div>
                <span className="score-sub-num">{facilidade}/5</span>
              </div>
              <div className="score-sub">
                <span className="score-sub-lbl">Escalabilidade</span>
                <div className="score-sub-bar"><div className="score-sub-fill" style={{ width: `${(escalabilidade / 5) * 100}%` }} /></div>
                <span className="score-sub-num">{escalabilidade}/5</span>
              </div>
              {nota.justificativa && <div style={{ fontSize: 12, color: '#555', maxWidth: 360, lineHeight: 1.5, marginTop: 4 }}>{nota.justificativa}</div>}
            </div>
          </div>

          <div className="rpt-grid">
            <div className="rpt-card">
              <div className="rpt-card-lbl">Ângulo dominante</div>
              <div className="rpt-card-val">{phase1.angulo_dominante || '—'}</div>
            </div>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Formatos validados</div>
              <div className="chips-row">
                {formatos.map((f, i) => <span key={i} className="rpt-chip orange">{f}</span>)}
                {formatos.length === 0 && <span className="rpt-chip">—</span>}
              </div>
            </div>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Copy patterns</div>
              <div className="chips-row">
                {copyPatterns.map((p, i) => <span key={i} className="rpt-chip">{p}</span>)}
              </div>
            </div>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Fraquezas criativas</div>
              <div className="rpt-list">
                {pontosFragosCriativos.map((w, i) => (
                  <div key={i} className="rpt-list-item weak"><span className="ic">✗</span><span>{w}</span></div>
                ))}
              </div>
            </div>
          </div>

          {(phase1.sugestoes_criativos || []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="rpt-card-lbl" style={{ marginBottom: 8 }}>Sugestões de criativos</div>
              <div className="rpt-list">
                {(phase1.sugestoes_criativos as string[]).map((s, i) => (
                  <div key={i} className="rpt-list-item info"><span className="ic">→</span><span>{s}</span></div>
                ))}
              </div>
            </div>
          )}
        </ReportSection>

        {/* Phase 2 — Page */}
        <ReportSection label="Fase 2 — Análise da Página" badge={phase2.tipo_de_funil || 'página'} badgeCls="p2">
          <div className="rpt-grid" style={{ marginBottom: 16 }}>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Promessa central</div>
              <div className="rpt-card-val">{analise.promessa_central || '—'}</div>
            </div>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Mecanismo de dor</div>
              <div className="rpt-card-val">{analise.mecanismo_de_dor || '—'}</div>
            </div>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Linguagem</div>
              <div className="rpt-card-val">{analise.linguagem || '—'}</div>
            </div>
            <div className="rpt-card">
              <div className="rpt-card-lbl">Tom visual</div>
              <div className="rpt-card-val">{design.tom_visual || '—'}</div>
            </div>
          </div>

          {(analise.palavras_gatilho || []).length > 0 && (
            <div className="rpt-card" style={{ marginBottom: 14 }}>
              <div className="rpt-card-lbl">Palavras-gatilho</div>
              <div className="chips-row">
                {(analise.palavras_gatilho as string[]).map((w, i) => <span key={i} className="rpt-chip orange">{w}</span>)}
              </div>
            </div>
          )}

          {paleta.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="rpt-card-lbl" style={{ marginBottom: 6 }}>Paleta de cores</div>
              <div className="rpt-palette">
                {paleta.map((c, i) => (
                  <div key={i} className="rpt-swatch" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
          )}

          {estrutura.length > 0 && (
            <div>
              <div className="rpt-card-lbl" style={{ marginBottom: 8 }}>Estrutura da página ({estrutura.length} seções)</div>
              <div className="rpt-struct-list">
                {estrutura.map((sec, i) => (
                  <div key={i} className="rpt-struct-item">
                    <div className="rpt-struct-pos">{sec.posicao as number}</div>
                    <div className="rpt-struct-name">{sec.nome as string}</div>
                    <span className={`rpt-struct-qual ${(sec.qualidade as string) || ''}`}>{sec.qualidade as string}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportSection>

        {/* Weak points */}
        {pontosFracos.length > 0 && (
          <ReportSection label="Pontos Fracos" badge={`${pontosFracos.length} encontrados`} badgeCls="p2">
            <div className="rpt-pontos-fracos">
              {pontosFracos.map((pf, i) => (
                <div key={i} className="rpt-pf-item">
                  <div className="rpt-pf-header">
                    <div className="rpt-pf-rank">#{pf.rank as number || i + 1}</div>
                    <div className="rpt-pf-prob">{pf.problema as string}</div>
                    <span className={`rpt-pf-impact ${(pf.impacto as string || '').toLowerCase()}`}>{pf.impacto as string}</span>
                  </div>
                  {pf.como_corrigir && <div className="rpt-pf-fix">{pf.como_corrigir as string}</div>}
                </div>
              ))}
            </div>
            {elementosFuncionam.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="rpt-card-lbl" style={{ marginBottom: 8 }}>O que funciona</div>
                <div className="rpt-list">
                  {elementosFuncionam.map((e, i) => (
                    <div key={i} className="rpt-list-item strong"><span className="ic">✓</span><span>{e}</span></div>
                  ))}
                </div>
              </div>
            )}
          </ReportSection>
        )}

        {/* Screenshots */}
        {screenshots.length > 0 && (
          <ReportSection label="Screenshots da página">
            <div className="rpt-shots">
              {screenshots[0] && (
                <div className="rpt-shot">
                  <img src={`data:image/jpeg;base64,${screenshots[0]}`} alt="Desktop" />
                  <div className="rpt-shot-lbl">Desktop 1440px</div>
                </div>
              )}
              {screenshots[1] && (
                <div className="rpt-shot">
                  <img src={`data:image/jpeg;base64,${screenshots[1]}`} alt="Mobile" />
                  <div className="rpt-shot-lbl">Mobile 375px</div>
                </div>
              )}
            </div>
          </ReportSection>
        )}

      </div>

      {/* CTA */}
      <div className="report-cta-wrap">
        <div className="report-cta-box">
          <div className="report-cta-text">
            <h3>Gerar funil melhorado →</h3>
            <p>Claude Opus vai criar um HTML completo, superior ao original, aplicando todas as correções identificadas.</p>
          </div>
          <button className="report-gen-btn" onClick={onGenerate} disabled={phase3Loading}>
            {phase3Loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Gerando...
              </>
            ) : 'Acessar Funil Modelado →'}
          </button>
        </div>
        {phase3Loading && phase3Lines.length > 0 && (
          <div className="report-gen-term">
            <div className="term-bar">
              <div className="tbd" style={{ background: '#ff5f57' }} />
              <div className="tbd" style={{ background: '#febc2e' }} />
              <div className="tbd" style={{ background: '#28c840' }} />
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#333', marginLeft: 8 }}>claude-opus — geração</span>
            </div>
            <div className="term-body">
              {phase3Lines.filter(Boolean).map((l, i) => (
                <div key={i} className={`tl-${l.type}`}>{l.text}</div>
              ))}
              <span className="tcur" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ToolPage() {
  const [view, setView] = useState<'dashboard' | 'report' | 'editor'>('dashboard')
  const [dashTab, setDashTab] = useState<'mine' | 'recent'>('mine')
  const [chatTab, setChatTab] = useState<'details' | 'preview'>('details')
  const [editorTab, setEditorTab] = useState<'preview' | 'code'>('preview')

  // Dashboard
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [termLines, setTermLines] = useState<{ text: string; type: string }[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [generatedHtml, setGeneratedHtml] = useState('')
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [pageSaved, setPageSaved] = useState(false)
  const [dashProgress, setDashProgress] = useState(0)

  // 3-phase state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phase1Report, setPhase1Report] = useState<Record<string, any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phase2Report, setPhase2Report] = useState<Record<string, any> | null>(null)
  const [phase2Screenshots, setPhase2Screenshots] = useState<string[]>([])
  const [phase3Loading, setPhase3Loading] = useState(false)

  // Editor
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [editorHtml, setEditorHtml] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [lastEditType, setLastEditType] = useState<'patch' | 'full' | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [mobChatOpen, setMobChatOpen] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [loadProgress, setLoadProgress] = useState(0)
  const [routeLabel, setRouteLabel] = useState('/home')
  const [copied, setCopied] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [paneWidth, setPaneWidth] = useState(0)
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPlano, setUserPlano] = useState('pro')
  const [userCreatedAt, setUserCreatedAt] = useState('')
  const [creditos, setCreditos] = useState<number | null>(null)
  const [analises, setAnalises] = useState<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.nome) setUserName(d.user.nome.split(' ')[0])
      if (d.user?.email) setUserEmail(d.user.email)
      if (d.user?.plano) setUserPlano(d.user.plano)
      if (d.user?.created_at) setUserCreatedAt(d.user.created_at)
      if (typeof d.user?.creditos === 'number') setCreditos(d.user.creditos)
      if (typeof d.user?.analises === 'number') setAnalises(d.user.analises)
    }).catch(() => {})
  }, [])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/login'
  }

  function getResetDate(createdAt: string) {
    if (!createdAt) return ''
    try {
      const d = new Date(createdAt)
      const next = new Date(d)
      next.setMonth(next.getMonth() + 1)
      return next.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    } catch { return '' }
  }

  const [isListening, setIsListening] = useState(false)
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const editorHtmlRef = useRef<string>('')
  const previewPaneRef = useRef<HTMLDivElement>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('cc_projects')
    if (saved) setProjects(JSON.parse(saved))
  }, [])

  useEffect(() => {
    const v = localStorage.getItem('cc_analysis_open')
    if (v !== null) setAnalysisOpen(v === 'true')
  }, [])


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading, streamingContent])

  // Preview pane width tracking for scale
  useEffect(() => {
    const el = previewPaneRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setPaneWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Viewport meta injection on device change (no reload)
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.head) return
    const content = device === 'mobile' ? 'width=390' : device === 'tablet' ? 'width=768' : 'width=device-width,initial-scale=1'
    let meta = doc.querySelector('meta[name="viewport"]') as HTMLMetaElement | null
    if (!meta) {
      meta = doc.createElement('meta') as HTMLMetaElement
      meta.setAttribute('name', 'viewport')
      doc.head.appendChild(meta)
    }
    meta.setAttribute('content', content)
  }, [device])

  // Progress bar animation
  useEffect(() => {
    if (chatLoading) {
      setLoadProgress(2)
      const start = Date.now()
      const iv = setInterval(() => {
        const t = (Date.now() - start) / 22000
        setLoadProgress(Math.min(85, 2 + t * 83))
      }, 120)
      return () => clearInterval(iv)
    } else {
      setLoadProgress(100)
      const t = setTimeout(() => setLoadProgress(0), 500)
      return () => clearTimeout(t)
    }
  }, [chatLoading])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    setHasSpeechSupport(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  function toggleMic() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      setChatInput(final || interim)
    }

    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)

    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setAnalyzing(true)
    setAnalysis(null)
    setGeneratedHtml('')
    setError('')
    setPageSaved(false)
    setTermLines([])
    setDashProgress(0)
    setPhase1Report(null)
    setPhase2Report(null)
    setPhase2Screenshots([])
    if (stepTimer.current) clearInterval(stepTimer.current)

    async function readSSE(res: Response, onEvent: (ev: Record<string, unknown>) => boolean): Promise<void> {
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          let ev: Record<string, unknown>
          try { ev = JSON.parse(part.slice(6)) } catch { continue }
          if (onEvent(ev)) return
        }
      }
    }

    try {
      // ── Phase 1: Ad analysis ──
      setTermLines([{ text: '> Iniciando análise de anúncios...', type: 'wait' }])
      const res1 = await fetch('/api/phase1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': getSessionId() },
        body: JSON.stringify({ url }),
      })
      if (res1.status === 402) { setUpgradeModal(true); return }
      if (!res1.ok) { const e = await res1.json().catch(() => ({})); throw new Error(e.error || 'Erro na fase 1') }

      let p1: Record<string, unknown> | null = null
      await readSSE(res1, (ev) => {
        if (ev.type === 'error') throw new Error(ev.message as string)
        if (ev.type === 'progress') {
          setTermLines(prev => [...prev, { text: `> ${ev.text}`, type: 'wait' }])
          setDashProgress(30)
        }
        if (ev.type === 'done') {
          p1 = ev.report as Record<string, unknown>
          setTermLines(prev => [...prev, { text: '✓ Fase 1 concluída — anúncios analisados', type: 'done' }])
          setDashProgress(50)
          return true
        }
        return false
      })
      if (!p1) throw new Error('Fase 1 não retornou relatório')
      setPhase1Report(p1)

      // ── Phase 2: Page analysis ──
      const landingUrl = (p1 as Record<string, unknown>).landing_url as string
      if (!landingUrl) throw new Error('URL da página de destino não encontrada nos anúncios')

      setTermLines(prev => [...prev, { text: '> Analisando página de destino...', type: 'wait' }])
      const res2 = await fetch('/api/phase2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': getSessionId() },
        body: JSON.stringify({ url: landingUrl, phase1Report: p1 }),
      })
      if (res2.status === 402) { setUpgradeModal(true); return }
      if (!res2.ok) { const e = await res2.json().catch(() => ({})); throw new Error(e.error || 'Erro na fase 2') }

      let p2: Record<string, unknown> | null = null
      let shots: string[] = []
      await readSSE(res2, (ev) => {
        if (ev.type === 'error') throw new Error(ev.message as string)
        if (ev.type === 'progress') {
          setTermLines(prev => [...prev, { text: `> ${ev.text}`, type: 'wait' }])
          setDashProgress(75)
        }
        if (ev.type === 'done') {
          p2 = ev.report as Record<string, unknown>
          shots = (ev.screenshots as string[]) || []
          setTermLines(prev => [...prev, { text: '✓ Fase 2 concluída — página analisada', type: 'done' }])
          setDashProgress(100)
          return true
        }
        return false
      })
      if (!p2) throw new Error('Fase 2 não retornou relatório')
      setPhase2Report(p2)
      setPhase2Screenshots(shots)

      // ── Show report view ──
      setView('report')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar. Tente novamente.')
      setDashProgress(0)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handlePhase3() {
    if (!phase1Report || !phase2Report) return
    setPhase3Loading(true)
    setTermLines([])
    try {
      const res = await fetch('/api/phase3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': getSessionId() },
        body: JSON.stringify({ phase1Report, phase2Report, screenshots: phase2Screenshots }),
      })
      if (res.status === 402) { setUpgradeModal(true); return }
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', html = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          let ev: Record<string, unknown>
          try { ev = JSON.parse(part.slice(6)) } catch { continue }
          if (ev.type === 'error') throw new Error(ev.message as string)
          if (ev.type === 'progress') {
            setTermLines(prev => [...prev.slice(-5), { text: `> ${ev.text}`, type: 'wait' }])
          }
          if (ev.type === 'done') {
            html = ev.html as string
            if (typeof ev.creditos === 'number') setCreditos(ev.creditos)
          }
        }
      }
      if (!html) throw new Error('Fase 3 não retornou HTML')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p1 = phase1Report as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p2 = phase2Report as any
      const proj: Project = {
        id: Date.now().toString(),
        name: p2.url_analisada ? (() => { try { return new URL(p2.url_analisada).hostname } catch { return p2.url_analisada } })() : (p1.angulo_dominante || 'Funil Gerado'),
        score: Number(p1.nota_entrada?.score) || 7,
        html,
        analysis: {
          score: Number(p1.nota_entrada?.score) || 7,
          verdict: p1.nota_entrada?.justificativa || '',
          reason: p2.analise_de_copy?.promessa_central || '',
          dominant_angle: p1.angulo_dominante || '',
          page_name: p2.url_analisada || p1.angulo_dominante || 'Funil Gerado',
          weak_points: (p2.pontos_fracos || []).map((f: { problema: string }) => f.problema),
          strong_points: p2.elementos_que_funcionam || [],
          ctv_recommendations: [],
        },
        url,
        createdAt: Date.now(),
      }
      const updated = [proj, ...projects].slice(0, 12)
      setProjects(updated)
      localStorage.setItem('cc_projects', JSON.stringify(updated))
      openEditor({ ...proj, html: injectRevealFix(proj.html) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na geração do funil')
    } finally {
      setPhase3Loading(false)
    }
  }

  function saveAndOpen() {
    if (!analysis) { alert('Análise não concluída ainda.'); return }
    if (!generatedHtml) { alert('Página não foi gerada. Rode a análise novamente.'); return }
    if (pageSaved) return
    setPageSaved(true)
    const proj: Project = {
      id: Date.now().toString(),
      name: analysis.page_name || 'Oferta sem nome',
      score: analysis.score,
      html: generatedHtml,
      analysis,
      url,
      createdAt: Date.now(),
    }
    const updated = [proj, ...projects].slice(0, 12)
    setProjects(updated)
    localStorage.setItem('cc_projects', JSON.stringify(updated))
    openEditor({ ...proj, html: injectRevealFix(proj.html) })
  }

  async function confirmDelete(proj: Project) {
    setDeleting(true)
    setDeleteError('')
    let cacheClearFailed = false
    // Clear analysis_cache on the server so the next analysis of the same URL
    // runs from scratch instead of returning the cached old result.
    try {
      const pageId = new URL(proj.url).searchParams.get('view_all_page_id')
      if (pageId) {
        const res = await fetch('/api/projects/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || `HTTP ${res.status}`)
        }
      }
    } catch (err) {
      cacheClearFailed = true
      setDeleteError(
        `Projeto removido localmente, mas o cache não pôde ser limpo: ${err instanceof Error ? err.message : String(err)}. A próxima análise desta URL pode retornar o resultado anterior.`
      )
    }
    // Always remove from local state, regardless of cache clear result.
    const updated = projects.filter(p => p.id !== proj.id)
    setProjects(updated)
    localStorage.setItem('cc_projects', JSON.stringify(updated))
    setDeleting(false)
    // Keep modal open on failure so the user can read the error message.
    if (!cacheClearFailed) setPendingDelete(null)
  }

  function openReport(proj: Project) {
    const a = proj.analysis
    const score = Number(a.score) || 0
    const scoreColor = score >= 7 ? '#16a34a' : score >= 4 ? '#FF8C00' : '#ef4444'
    const scoreBg = score >= 7 ? '#f0fdf4' : score >= 4 ? '#fff7ed' : '#fef2f2'
    const weak = (a.weak_points || []).map((p: string) => `<div class="pt-item weak"><span class="pt-icon">✗</span><span>${p}</span></div>`).join('')
    const strong = (a.strong_points || []).map((p: string) => `<div class="pt-item strong"><span class="pt-icon">✓</span><span>${p}</span></div>`).join('')
    const ctv = (a.ctv_recommendations || []).map((r: { angle: string; hook: string; script: string }, i: number) => `
      <div class="ctv-card"><div class="ctv-header"><span class="ctv-num">${String(i + 1).padStart(2, '0')}</span><span class="ctv-angle">${r.angle}</span></div>
      <div class="ctv-hook">"${r.hook}"</div><div class="ctv-script">${r.script}</div></div>`).join('')
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório — ${a.page_name}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@media print{.no-print{display:none!important}body{background:#fff}.page{box-shadow:none;border-radius:0;margin:0;max-width:100%}.ctv-card,.pt-item{break-inside:avoid}}
body{font-family:'Inter',system-ui,sans-serif;background:#0d0d0d;min-height:100vh;padding:32px 16px;-webkit-font-smoothing:antialiased}
.page{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.5)}
.report-header{background:#0d0d0d;padding:32px 40px;position:relative;overflow:hidden}
.report-header::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,140,0,.15),transparent 70%);border-radius:50%}
.report-brand{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#FF8C00;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.report-brand::before{content:'';display:block;width:20px;height:1px;background:#FF8C00}
.report-title{font-size:26px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:8px;letter-spacing:-.3px}
.report-meta{font-size:12px;color:#555;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.report-meta a{color:#666;text-decoration:none}
.score-section{padding:32px 40px;background:#fafafa;border-bottom:1px solid #f0f0f0;display:flex;align-items:flex-start;gap:24px}
.score-circle{width:80px;height:80px;border-radius:50%;background:${scoreBg};border:3px solid ${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.score-num{font-size:28px;font-weight:900;color:${scoreColor};line-height:1}
.score-denom{font-size:10px;font-weight:600;color:${scoreColor};opacity:.7}
.score-verdict{font-size:16px;font-weight:700;color:#111;margin-bottom:6px}
.score-reason{font-size:13px;color:#666;line-height:1.65}
.content{padding:32px 40px}
.section{margin-bottom:32px}
.section-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#aaa;margin-bottom:12px;display:flex;align-items:center;gap:10px}
.section-label::after{content:'';flex:1;height:1px;background:#f0f0f0}
.angle-box{background:#fafafa;border:1px solid #efefef;border-radius:10px;padding:16px 18px;font-size:14px;font-weight:600;color:#111;line-height:1.5}
.pts-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:560px){.pts-grid{grid-template-columns:1fr}}
.pts-col-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.pts-col-label.w{color:#ef4444}.pts-col-label.s{color:#16a34a}
.pt-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:6px;font-size:13px;line-height:1.55;font-weight:500}
.pt-item.weak{background:#fef2f2;color:#7f1d1d}.pt-item.strong{background:#f0fdf4;color:#14532d}
.pt-icon{font-size:11px;font-weight:900;flex-shrink:0;margin-top:2px;width:16px;text-align:center}
.pt-item.weak .pt-icon{color:#ef4444}.pt-item.strong .pt-icon{color:#16a34a}
.ctv-card{border:1px solid #efefef;border-radius:12px;overflow:hidden;margin-bottom:10px}
.ctv-header{background:#fafafa;border-bottom:1px solid #efefef;padding:10px 16px;display:flex;align-items:center;gap:10px}
.ctv-num{font-size:11px;font-weight:900;color:#FF8C00;background:#fff7ed;border:1px solid #fed7aa;border-radius:4px;padding:2px 7px}
.ctv-angle{font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em}
.ctv-hook{font-size:14px;font-weight:700;color:#111;padding:14px 16px 8px;line-height:1.5}
.ctv-script{font-size:13px;color:#666;padding:0 16px 14px;line-height:1.7}
.report-footer{background:#fafafa;border-top:1px solid #f0f0f0;padding:20px 40px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.footer-brand{font-size:12px;font-weight:800;color:#ccc;letter-spacing:.06em}
.print-btn{display:inline-flex;align-items:center;gap:8px;background:#0d0d0d;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:background .15s}
.print-btn:hover{background:#222}
</style></head><body>
<div class="page">
  <div class="report-header">
    <div class="report-brand">ClickClone · Relatório de Inteligência</div>
    <div class="report-title">${a.page_name}</div>
    <div class="report-meta">
      <span>Analisado em ${new Date(proj.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
      ${proj.url ? `<span><a href="${proj.url}" target="_blank">${proj.url.replace(/^https?:\/\//, '').slice(0, 50)}</a></span>` : ''}
    </div>
  </div>
  <div class="score-section">
    <div class="score-circle"><div class="score-num">${a.score}</div><div class="score-denom">/10</div></div>
    <div><div class="score-verdict">${a.verdict || 'Análise concluída'}</div><div class="score-reason">${a.reason || ''}</div></div>
  </div>
  <div class="content">
    <div class="section"><div class="section-label">Ângulo dominante</div><div class="angle-box">${a.dominant_angle || ''}</div></div>
    <div class="section"><div class="section-label">Diagnóstico da oferta</div>
      <div class="pts-grid">
        <div><div class="pts-col-label w">✗ Fraquezas</div>${weak}</div>
        <div><div class="pts-col-label s">✓ Forças</div>${strong}</div>
      </div>
    </div>
    <div class="section"><div class="section-label">Scripts CTV recomendados</div>${ctv}</div>
  </div>
  <div class="report-footer">
    <span class="footer-brand">CLICKCLONE</span>
    <button class="print-btn no-print" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Baixar como PDF
    </button>
  </div>
</div></body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
  }

  function injectRevealFix(html: string): string {
    if (html.includes('cc-fix-v5')) return html
    const headFix = `<style id="cc-fix-v5">*{opacity:1!important;visibility:visible!important}</style>`
    let result = html
    if (result.includes('<head>')) result = result.replace('<head>', '<head>' + headFix)
    else if (result.includes('<html')) result = result.replace(/(<html[^>]*>)/i, '$1' + headFix)
    else result = headFix + result
    return result
  }

  function openEditor(proj: Project) {
    const injected = injectRevealFix(proj.html)
    setCurrentProject(proj)
    setEditorHtml(injected)
    editorHtmlRef.current = injected
    setMessages([{
      role: 'assistant',
      content: `Página carregada! **${proj.name}** — Score **${proj.score}/10** (${proj.analysis.verdict}).\n\nDigita o que quer editar — copy, cores, preço, estrutura — e eu atualizo em segundos.`,
    }])
    setRouteLabel('/home')
    setAnalysisOpen(false)
    setMobChatOpen(true)
    setEditorTab('preview')
    setChatTab('details')
    setView('editor')
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setPendingImage({ dataUrl })
    }
    reader.readAsDataURL(file)
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault()
    const msg = chatInput.trim()
    const imageToSend = pendingImage
    if ((!msg && !imageToSend) || chatLoading) return

    // Block if out of credits
    if (creditos !== null && creditos <= 0) {
      setUpgradeModal(true)
      return
    }

    setChatInput('')
    setPendingImage(null)
    const userMsg: Message = { role: 'user', content: msg, image: imageToSend?.dataUrl }
    const history: Message[] = [...messages, userMsg]
    setMessages(history)
    setChatLoading(true)
    setStreamingContent('')
    setLastEditType(null)
    const effectiveMessage = imageToSend
      ? `${msg ? msg + '\n\n' : ''}Analise esta imagem e aplique as mudanças necessárias na página:\n${imageToSend.dataUrl}`
      : msg
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 240000)
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': getSessionId() },
        signal: controller.signal,
        body: JSON.stringify({
          html: editorHtmlRef.current || editorHtml,
          message: effectiveMessage,
          analysis: currentProject?.analysis,
          history: history.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (res.status === 402) {
        setChatLoading(false)
        clearTimeout(timeout)
        setUpgradeModal(true)
        return
      }
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', gotDone = false, gotError = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              setStreamingContent(prev => prev + event.chunk)
            } else if (event.type === 'error') {
              setStreamingContent('')
              setMessages(prev => [...prev, { role: 'assistant', content: event.message || 'Erro ao processar. Tenta novamente.', isError: true }])
              gotError = true
            } else if (event.type === 'done') {
              gotDone = true
              setStreamingContent('')
              setLastEditType(event.editType || 'patch')
              const newHtml = event.html ? injectRevealFix(event.html) : (editorHtmlRef.current || editorHtml)
              editorHtmlRef.current = newHtml
              if (event.editType === 'patch' && event.html) {
                const iframeDoc = iframeRef.current?.contentDocument
                if (iframeDoc) {
                  const bodyMatch = newHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
                  if (bodyMatch) { iframeDoc.body.innerHTML = bodyMatch[1] }
                  else setEditorHtml(newHtml)
                } else setEditorHtml(newHtml)
              } else {
                setEditorHtml(newHtml)
              }
              const saved = JSON.parse(localStorage.getItem('cc_projects') || '[]') as Project[]
              const idx = saved.findIndex(p => p.id === currentProject?.id)
              if (idx !== -1) {
                saved[idx].html = newHtml
                localStorage.setItem('cc_projects', JSON.stringify(saved))
                setProjects(saved)
              }
              if (typeof event.creditos === 'number') setCreditos(event.creditos)
              setMessages(prev => [...prev, { role: 'assistant', content: event.message || 'Feito!' }])
            }
          } catch { /* skip */ }
        }
      }
      if (!gotDone && !gotError) setMessages(prev => [...prev, { role: 'assistant', content: 'Algo deu errado, tente novamente.', isError: true }])
    } catch (err: unknown) {
      setStreamingContent('')
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setMessages(prev => [...prev, { role: 'assistant', content: isAbort ? '⚠️ Tempo esgotado. Tenta novamente.' : '⚠️ Erro ao processar. Tenta novamente.' }])
    } finally {
      clearTimeout(timeout)
      setChatLoading(false)
    }
  }

  async function exportZip() {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    const site = zip.folder('site')!
    const assets = site.folder('assets')!
    let html = editorHtml
    let imgCount = 0
    html = html.replace(/src="data:(image\/[^;]+);base64,([A-Za-z0-9+/=]+)"/g, (_m, mime: string, b64: string) => {
      const ext = mime.split('/')[1].replace('jpeg', 'jpg')
      const filename = `image-${++imgCount}.${ext}`
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      assets.file(filename, bytes)
      return `src="assets/${filename}"`
    })
    site.file('index.html', html)
    site.file('README.txt', 'Suba essa pasta no seu servidor ou arraste no Netlify Drop (netlify.com/drop)')
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(currentProject?.name || 'site').replace(/\s+/g, '-')}.zip`
    a.click()
  }

  const recentProjects = [...projects].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4)
  const visibleProjects = dashTab === 'mine' ? projects
    : dashTab === 'recent' ? recentProjects
    : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;font-family:'Roboto',Helvetica,sans-serif;background:#0a0a0a;color:#fff;-webkit-font-smoothing:antialiased;cursor:default}

        /* ─── DASHBOARD ─── */
        .dash{min-height:100svh;display:flex;background:#0a0a0a}

        /* Sidebar */
        .sb{width:220px;flex-shrink:0;background:#111;border-right:1px solid #1a1a1a;display:flex;flex-direction:column;height:100svh;position:sticky;top:0;overflow-y:auto}
        @media(max-width:768px){.sb{display:none}}
        .sb-logo{padding:16px 14px 12px;flex-shrink:0}
        .sb-logo img{height:20px;width:auto;opacity:.85}
        .sb-workspace{display:flex;align-items:center;gap:9px;padding:7px 10px;margin:0 8px;border-radius:8px;background:#111;border:1px solid #1e1e1e;cursor:pointer;transition:border-color .15s}
        .sb-workspace:hover{border-color:#333}
        .sb-avatar{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#E8692A,#f07340);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;color:#fff}
        .sb-ws-name{font-size:13px;font-weight:500;flex:1;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sb-chevron{color:#555;font-size:10px;flex-shrink:0;line-height:1}
        .sb-nav{padding:10px 8px 0;display:flex;flex-direction:column;gap:1px}
        .sb-nav-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;font-size:13px;color:#555;transition:color .12s;cursor:pointer;border:none;background:transparent;font-family:inherit;width:100%;text-align:left}
        .sb-nav-item svg{color:#555;transition:color .12s;flex-shrink:0}
        .sb-nav-item:hover{color:#ccc}
        .sb-nav-item:hover svg{color:#ccc}
        .sb-nav-item.active{background:#111;color:#e8e8e8}
        .sb-nav-item.active svg{color:#e8e8e8}
        .sb-section{padding:20px 8px 0}
        .sb-section-label{font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#333;padding:0 8px;margin-bottom:2px}
        .sb-sub-item{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:6px;font-size:12px;color:#484848;transition:color .12s;cursor:pointer;border:none;background:transparent;font-family:inherit;width:100%;text-align:left}
        .sb-sub-item:hover{color:#999}
        .sb-sub-item.active{color:#bbb}
        .sb-diamond{font-size:7px;color:#2e2e2e;flex-shrink:0}
        .sb-bottom{margin-top:auto;padding:12px 8px;display:flex;flex-direction:column;gap:6px}
        .sb-upgrade{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 12px;background:#E8692A;border-radius:8px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;border:none;font-family:inherit;width:100%;transition:background .15s}
        .sb-upgrade:hover{background:#d4581f}

        /* Main content */
        .dash-main{flex:1;display:flex;flex-direction:column;min-width:0;overflow-y:auto}

        /* Hero */
        .dash-hero{position:relative;padding:56px 40px 48px;overflow:hidden;text-align:center;flex-shrink:0}
        .dash-hero::before{content:'';position:absolute;inset:0;background:
          radial-gradient(ellipse 60% 50% at 20% 40%,rgba(232,105,42,.18),transparent),
          radial-gradient(ellipse 50% 40% at 75% 30%,rgba(236,72,153,.12),transparent),
          radial-gradient(ellipse 40% 60% at 50% 80%,rgba(59,130,246,.1),transparent),
          radial-gradient(ellipse 30% 30% at 85% 70%,rgba(255,140,0,.08),transparent);
          animation:mesh-drift 8s ease-in-out infinite alternate}
        @keyframes mesh-drift{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.05) translate(-10px,8px)}}
        .hero-title{position:relative;font-size:clamp(22px,2.8vw,30px);font-weight:800;letter-spacing:-.03em;margin-bottom:28px;line-height:1.2}
        .hero-title .acc{color:#E8692A}
        .hero-input-wrap{position:relative;max-width:640px;margin:0 auto;display:flex;align-items:center;background:#141414;border:1px solid #222;border-radius:12px;padding:4px 6px 4px 14px;transition:border-color .2s;gap:6px}
        .hero-input-wrap:focus-within{border-color:rgba(232,105,42,.5);box-shadow:0 0 0 3px rgba(232,105,42,.08)}
        .hero-input-icon{color:#444;flex-shrink:0;display:flex;align-items:center}
        .hero-url-in{flex:1;background:transparent;border:none;outline:none;font-family:inherit;font-size:14px;color:#fff;padding:10px 0}
        .hero-url-in::placeholder{color:#333}
        .hero-send-btn{padding:9px 18px;background:#E8692A;color:#fff;border:none;border-radius:8px;font-family:inherit;font-weight:700;font-size:14px;flex-shrink:0;transition:background .2s}
        .hero-send-btn:hover:not(:disabled){background:#c4551d}
        .hero-send-btn:disabled{background:#2a1a0e;color:#5a3520}

        /* Tabs */
        .dash-tabs{display:flex;align-items:center;gap:2px;padding:0 40px;border-bottom:1px solid #161616;flex-shrink:0}
        .dash-tab{padding:12px 14px;font-size:13px;font-weight:500;color:#444;border:none;background:transparent;font-family:inherit;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}
        .dash-tab:hover{color:#888}
        .dash-tab.active{color:#fff;border-bottom-color:#E8692A}
        .dash-tab-spacer{flex:1}
        .dash-tab-link{font-size:12px;color:#444;padding:8px 4px;border:none;background:transparent;font-family:inherit;cursor:pointer;transition:color .15s;white-space:nowrap}
        .dash-tab-link:hover{color:#888}

        /* Projects grid */
        .dash-content{padding:32px 40px 80px;flex:1}
        @media(max-width:768px){.dash-hero,.dash-content,.dash-tabs{padding-left:20px;padding-right:20px}}
        .proj-sec-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:20px}
        .proj-sec-hd h2{font-size:16px;font-weight:700}
        .proj-count{font-size:12px;color:#333}
        .proj-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        @media(max-width:640px){.proj-grid{grid-template-columns:1fr}}
        @media(max-width:900px) and (min-width:641px){.proj-grid{grid-template-columns:repeat(2,1fr)}}
        @media(min-width:901px) and (max-width:1280px){.proj-grid{grid-template-columns:repeat(3,1fr)}}
        .proj-card{background:#111;border:1px solid #1e1e1e;border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;position:relative}
        .proj-card:hover{transform:scale(1.01);border-color:#333;box-shadow:0 8px 32px rgba(0,0,0,.5)}
        .proj-thumb{width:100%;height:160px;overflow:hidden;position:relative;background:#0a0a0a;border-bottom:1px solid #1a1a1a}
        .proj-footer{padding:10px 12px;display:flex;flex-direction:column;gap:4px}
        .proj-footer-top{display:flex;align-items:center;gap:8px;width:100%}
        .proj-avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
        .proj-avatar.score-green{background:linear-gradient(135deg,#16a34a,#22c55e)}
        .proj-avatar.score-yellow{background:linear-gradient(135deg,#d97706,#FF8C00)}
        .proj-avatar.score-red{background:linear-gradient(135deg,#b91c1c,#ef4444)}
        .proj-name{font-size:14px;font-weight:700;flex:1;color:#ccc;word-break:break-word;line-height:1.3}
        .proj-time{font-size:12px;color:#666}
        .proj-actions{position:absolute;top:8px;right:8px;display:flex;gap:5px;opacity:0;transition:opacity .15s;pointer-events:none}
        .proj-card:hover .proj-actions{opacity:1;pointer-events:auto}
        .proj-action-btn{width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:#aaa}
        .proj-action-btn:hover{background:rgba(30,30,30,.95);border-color:rgba(255,255,255,.2);color:#fff}
        .proj-action-btn.del:hover{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#ef4444}

        /* Terminal */
        .tool-term{background:#060606;border:1px solid #141414;border-radius:10px;overflow:hidden;margin-top:24px}
        .term-bar{background:#0d0d0d;border-bottom:1px solid #141414;padding:9px 14px;display:flex;align-items:center;gap:6px}
        .term-progress{height:2px;background:#111;position:relative;overflow:hidden}
        .term-progress-bar{height:100%;background:#FF8C00;transition:width .4s ease;border-radius:0 1px 1px 0}
        .tbd{width:9px;height:9px;border-radius:50%}
        .term-body{padding:16px 20px;font-family:'Space Mono',monospace;font-size:12px;line-height:2;min-height:80px}
        .tl-cmd{color:#2a2a2a;margin-bottom:4px}
        .tl-wait{color:#555;animation:fadein .3s ease}
        .tl-done{color:#FF8C00;animation:fadein .3s ease}
        .tl-ok{color:#fff;animation:fadein .3s ease}
        .tcur{display:inline-block;width:7px;height:13px;background:#FF8C00;animation:tblink .7s step-end infinite;vertical-align:middle;margin-left:3px}
        @keyframes tblink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadein{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}

        /* Analysis results */
        .res-wrap{margin-top:28px;display:flex;flex-direction:column;gap:12px}
        .res-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px}
        .res-eyebrow{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#FF8C00;margin-bottom:3px}
        .res-title{font-size:20px;font-weight:800;line-height:1.2}
        .pdf-btn{flex-shrink:0;padding:7px 14px;background:transparent;border:1px solid #222;border-radius:6px;color:#555;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.04em;transition:all .15s;white-space:nowrap}
        .pdf-btn:hover{border-color:#FF8C00;color:#FF8C00}
        .score-row{background:#070707;border:1px solid #141414;border-radius:12px;padding:20px 22px;display:flex;align-items:center;gap:20px}
        .score-ring-wrap{position:relative;flex-shrink:0}
        .score-info{flex:1}
        .score-verdict-big{font-size:17px;font-weight:800;margin-bottom:5px}
        .score-reason-text{font-size:12px;color:#444;line-height:1.6}
        .angle-row{background:#070707;border:1px solid #141414;border-radius:10px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .angle-block{flex:1}
        .card-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#FF8C00;margin-bottom:6px;display:flex;align-items:center;gap:6px}
        .angle-val{font-size:15px;font-weight:700;line-height:1.4}
        .niche-tag{padding:5px 12px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:100px;font-size:11px;color:#555;white-space:nowrap}
        .pts-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media(max-width:560px){.pts-row{grid-template-columns:1fr}}
        .pts-card{background:#070707;border:1px solid #141414;border-radius:10px;padding:16px 18px}
        .pt-item{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.55;padding:4px 0;color:#666;border-bottom:1px solid #0d0d0d}
        .pt-item:last-child{border-bottom:none}
        .pt-item .ic{flex-shrink:0;font-size:10px;margin-top:3px}
        .pt-item.weak .ic{color:#ef4444}.pt-item.strong .ic{color:#22c55e}
        .pt-item.weak{color:#888}.pt-item.strong{color:#888}
        .ctv-header-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
        .ctv-sub{font-size:11px;color:#333}
        .ctv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        @media(max-width:640px){.ctv-grid{grid-template-columns:1fr}}
        .ctv-card{background:#070707;border:1px solid #141414;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:6px;transition:border-color .15s}
        .ctv-card:hover{border-color:#222}
        .ctv-num{font-size:10px;font-weight:700;color:#222;font-family:'Space Mono',monospace}
        .ctv-angle{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#FF8C00}
        .ctv-hook{font-size:13px;font-weight:700;line-height:1.4;color:#ddd}
        .ctv-script{font-size:11px;color:#444;line-height:1.7;flex:1}
        .open-btn{width:100%;padding:16px;background:#E8692A;color:#fff;border:none;border-radius:10px;font-family:inherit;font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;letter-spacing:.02em}
        .open-btn:hover{background:#c4551d;transform:translateY(-2px);box-shadow:0 12px 40px rgba(232,105,42,.3)}
        .err{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.18);color:#ef4444;padding:12px 16px;border-radius:8px;font-size:13px;margin-top:16px;line-height:1.5}
        .empty-state{padding:60px 20px;text-align:center;color:#333;font-size:13px}

        /* ─── EDITOR ─── */
        .editor-wrap{display:flex;flex-direction:column;height:100svh;overflow:hidden;position:relative}

        /* Progress bar */
        .ed-progress{position:absolute;top:0;left:0;height:2px;background:#FF8C00;z-index:100;transition:width .12s linear,opacity .4s ease;pointer-events:none;border-radius:0 1px 1px 0}

        /* Topbar */
        .ed-topbar{height:44px;flex-shrink:0;display:flex;align-items:center;border-bottom:1px solid #1a1a1a;background:#0d0d0d;padding:0 20px 0 12px;gap:8px;z-index:10;overflow:visible;animation:ed-topbar-in .3s cubic-bezier(.16,1,.3,1)}
        @keyframes ed-topbar-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .ed-top-l{display:flex;align-items:center;gap:7px;flex:1;min-width:0}
        .ed-back{background:transparent;border:none;color:#555;font-size:12px;padding:5px 8px;border-radius:6px;transition:all .15s;font-family:inherit;display:flex;align-items:center;gap:4px;flex-shrink:0}
        .ed-back:hover{color:#ccc;background:#1a1a1a}
        .ed-proj-wrap{display:flex;align-items:center;gap:5px;min-width:0;flex:1}
        .ed-proj-name{font-size:13px;font-weight:600;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ed-proj-chevron{color:#444;font-size:10px;flex-shrink:0}
        .ed-top-c{display:flex;flex-direction:row;align-items:center;gap:8px;flex-shrink:0}
        .ed-tabs{display:flex;gap:2px;background:#1a1a1a;border-radius:8px;padding:3px}
        .ed-tab{padding:5px 16px;font-size:12px;font-weight:600;border:none;background:transparent;color:#666;font-family:inherit;cursor:pointer;transition:all .15s;white-space:nowrap;border-radius:6px;border-bottom:none}
        .ed-tab:hover{color:#aaa;background:#222}
        .ed-tab.active{background:#2a2a2a;color:#fff}
        .ed-url-bar{display:flex;align-items:center;gap:7px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:4px 6px 4px 10px;transition:border-color .2s;width:220px;overflow:visible}
        .ed-url-bar:focus-within{border-color:rgba(232,105,42,.4)}
        .ed-url-dot{width:6px;height:6px;background:#22c55e;border-radius:50%;flex-shrink:0;animation:pulse-dot 2.5s ease-in-out infinite}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
        .ed-route-input{background:transparent;border:none;outline:none;font-family:'Space Mono',monospace;font-size:11px;color:#888;width:130px}
        .ed-route-input::placeholder{color:#444}
        .ed-url-btns{display:flex;gap:2px;align-items:center;flex-shrink:0;overflow:visible;margin-left:auto}
        .ed-url-btn{padding:3px 5px;background:transparent;border:none;color:#666;display:flex;align-items:center;cursor:pointer;border-radius:4px;transition:all .15s;flex-shrink:0;min-width:24px}
        .ed-url-btn:hover{color:#fff;background:#222}
        .ed-top-r{display:flex;align-items:center;gap:6px;flex-shrink:0;min-width:0}
        .ed-top-r .ed-btn-orange{flex-shrink:0}
        .ed-btn-outline{padding:5px 12px;background:transparent;border:1px solid #222;border-radius:6px;color:#888;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
        .ed-btn-outline:hover{border-color:#444;color:#ccc}
        .ed-btn-dark{padding:6px 16px;background:#111;border:1px solid #333;border-radius:8px;color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
        .ed-btn-dark:hover{border-color:#666;background:#1a1a1a}
        .ed-btn-orange{padding:6px 16px;background:#E8692A;border:none;border-radius:8px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;white-space:nowrap}
        .ed-btn-orange:hover{background:#d4581f}
        .ed-btn-green{padding:5px 12px;background:#16a34a;border:none;border-radius:6px;color:#fff;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:background .15s;white-space:nowrap}
        .ed-btn-green:hover{background:#15803d}
        .ed-devices{display:flex;background:#111;border:1px solid #1a1a1a;border-radius:6px;overflow:hidden;flex-shrink:0;margin-right:4px}
        .ed-dev{padding:5px 9px;background:transparent;border:none;color:#666;font-size:13px;cursor:pointer;transition:all .15s;line-height:1;display:flex;align-items:center}
        .ed-dev:hover{color:#bbb}
        .ed-dev.active{background:#1e1e1e;color:#E8692A}
        .ed-dev+.ed-dev{border-left:1px solid #181818}
        .ed-top-divider{width:1px;height:22px;background:#1e1e1e;flex-shrink:0;margin:0 6px}

        /* Editor body */
        .ed-body{display:flex;flex:1;overflow:hidden}
        @keyframes ed-slide-left{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
        @keyframes ed-fade-in{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}

        /* Chat sidebar */
        .chat-side{width:480px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid #141414;background:#000;animation:ed-slide-left .35s cubic-bezier(.16,1,.3,1)}
        @media(max-width:900px){.chat-side{width:380px}}
        @media(max-width:768px){
          .chat-side{position:absolute;inset:0;z-index:20;width:100%;transform:translateX(-100%);transition:transform .3s cubic-bezier(.16,1,.3,1);animation:none}
          .chat-side.mob-open{transform:translateX(0)}
        }

        .chat-inner-tabs{display:flex;gap:0;margin-bottom:-1px}
        .chat-inner-tab{padding:6px 14px;font-size:12px;font-weight:600;color:#444;border:none;background:transparent;font-family:inherit;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s}
        .chat-inner-tab:hover{color:#888}
        .chat-inner-tab.active{color:#fff;border-bottom-color:#E8692A}

        /* Analysis panel (Details tab) */
        .analysis-panel{background:#040404;border-bottom:1px solid #080808;flex-shrink:0;overflow:hidden}
        .ap-header{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;cursor:pointer;flex-shrink:0;border-bottom:1px solid #080808;transition:background .15s}
        .ap-header:hover{background:#060606}
        .ap-header-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#555;display:flex;align-items:center;gap:6px}
        .ap-chevron{color:#333;font-size:10px;transition:transform .2s;flex-shrink:0}
        .ap-chevron.open{transform:rotate(180deg)}
        .ap-body{overflow:hidden;transition:max-height .25s ease}
        .ap-inner{padding:12px 14px;display:flex;flex-direction:column;gap:6px}
        .ap-row{display:flex;align-items:flex-start;gap:8px;font-size:12px}
        .ap-lbl{color:#333;flex-shrink:0;width:72px;padding-top:1px}
        .ap-val{color:#777;flex:1;line-height:1.5}
        .ap-pt{display:flex;align-items:flex-start;gap:5px;color:#333;line-height:1.5;padding:1px 0;font-size:12px}
        .ap-pt .ic{flex-shrink:0;margin-top:2px}
        .ap-pt.w .ic{color:#ef4444}.ap-pt.s .ic{color:#22c55e}

        /* Messages */
        .chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:#2a2a2a transparent}
        .chat-msgs::-webkit-scrollbar{width:4px}
        .chat-msgs::-webkit-scrollbar-track{background:transparent}
        .chat-msgs::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px}
        .chat-msgs::-webkit-scrollbar-thumb:hover{background:#444}
        .msg{display:flex;flex-direction:column;gap:3px;max-width:90%}
        .msg.user{align-self:flex-end;align-items:flex-end}
        .msg.assistant{align-self:flex-start;align-items:flex-start}
        .msg-who{font-size:10px;color:#2a2a2a;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
        .msg.user .msg-who{color:#4a2200}
        .msg-bubble{padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.6;word-break:break-word}
        .msg.user .msg-bubble{background:#FF8C00;color:#fff;border-bottom-right-radius:3px}
        .msg.assistant .msg-bubble{background:#0a0a0a;border:1px solid #141414;color:#bbb;border-bottom-left-radius:3px}
        .msg.assistant .msg-bubble.err-bubble{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.2);color:#f87171}
        .thinking-dots{display:flex;gap:4px;align-items:center;padding:10px 13px;background:#0a0a0a;border:1px solid #141414;border-radius:10px;border-bottom-left-radius:3px}
        .thinking-dots span{width:5px;height:5px;background:#FF8C00;border-radius:50%;animation:tdot 1.2s ease-in-out infinite}
        .thinking-dots span:nth-child(2){animation-delay:.2s}
        .thinking-dots span:nth-child(3){animation-delay:.4s}
        @keyframes tdot{0%,80%,100%{transform:scale(.55);opacity:.3}40%{transform:scale(1);opacity:1}}
        .edit-type-badge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:4px;margin-left:6px;vertical-align:middle}
        .edit-type-badge.patch{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
        .edit-type-badge.full{background:rgba(255,140,0,.1);color:#FF8C00;border:1px solid rgba(255,140,0,.2)}

        /* Reaction bar */
        .reaction-bar{display:flex;align-items:center;gap:2px;margin-top:4px;padding:0 2px}
        .react-btn{padding:4px 6px;background:transparent;border:none;color:#2a2a2a;font-size:12px;cursor:pointer;border-radius:5px;transition:all .15s;display:flex;align-items:center;gap:3px;font-family:inherit}
        .react-btn:hover{background:#111;color:#888}
        .react-btn svg{width:12px;height:12px}

        /* Chat form */
        .chat-form{padding:8px 12px 12px;flex-shrink:0;background:#000}
        .chat-quick{padding:7px 12px;border-top:1px solid #1e1e1e;background:#111;flex-shrink:0;overflow:hidden}
        .chat-chips{display:flex;gap:6px;flex-wrap:nowrap;overflow:hidden}
        .chip{background:#111;border:1px solid #2a2a2a;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:500;color:#ccc;transition:all .15s;white-space:nowrap;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
        .chip:hover{border-color:#E8692A;color:#fff;background:#1a0f08}
        .chat-in-outer{display:flex;flex-direction:column;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;background:#060606;transition:border-color .2s,box-shadow .2s}
        .chat-in-outer:focus-within{border-color:#E8692A;box-shadow:0 0 0 3px rgba(232,105,42,.08)}
        .chat-textarea{background:transparent;border:none;outline:none;padding:12px 16px 4px;font-family:inherit;font-size:13px;color:#fff;resize:none;line-height:1.5;min-height:38px;max-height:120px;scrollbar-width:none;overflow-y:auto;width:100%}
        .chat-textarea::placeholder{color:#222}
        .chat-in-footer{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid #0d0d0d}
        .chat-attach-btn{padding:4px 6px;background:transparent;border:none;color:#333;cursor:pointer;border-radius:5px;transition:all .15s;display:flex;align-items:center}
        .chat-attach-btn:hover{color:#888;background:#111}
        .chat-visual-pill{padding:4px 10px;background:#0f0f0f;border:1px solid #1e1e1e;border-radius:99px;font-size:10px;font-weight:700;color:#444;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:5px;font-family:inherit}
        .chat-visual-pill:hover{border-color:rgba(232,105,42,.3);color:#E8692A;background:#1a0f08}
        .chat-visual-pill .dot{width:5px;height:5px;background:#E8692A;border-radius:50%;opacity:.6}
        .chat-in-r{display:flex;align-items:center;gap:5px;margin-left:auto}
        .chat-mic-btn{padding:4px 6px;background:transparent;border:none;color:#333;cursor:pointer;border-radius:5px;transition:all .15s;display:flex;align-items:center}
        .chat-mic-btn:hover{color:#888;background:#111}
        .chat-mic-btn.listening{color:#E8692A;animation:mic-pulse 1.2s ease-in-out infinite}
        @keyframes mic-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)}}
        .chat-send-btn{width:30px;height:30px;background:#E8692A;border:none;border-radius:7px;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s;flex-shrink:0}
        .chat-send-btn:hover:not(:disabled){background:#c4551d}
        .chat-send-btn:disabled{background:#1e1008;color:#4a2510}
        .chat-form-wrap{position:relative}
        .drag-overlay{position:absolute;inset:0;background:rgba(0,0,0,.88);border:2px dashed #E8692A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#E8692A;z-index:20;pointer-events:none;letter-spacing:.02em}
        .img-preview-row{padding:6px 12px 0;display:flex;gap:8px}
        .img-preview-item{position:relative;display:inline-flex}
        .img-preview-thumb{width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #2a2a2a;display:block}
        .img-preview-x{position:absolute;top:-6px;right:-6px;width:16px;height:16px;background:#333;border:1px solid #444;border-radius:50%;color:#ccc;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;padding:0}
        .img-preview-x:hover{background:#E8692A;color:#fff;border-color:#E8692A}
        .msg-img-thumb{width:60px;height:60px;object-fit:cover;border-radius:6px;display:block;margin-bottom:5px}

        /* Preview pane */
        .preview-pane{flex:1;overflow:auto;background:#0a0a0a;display:flex;align-items:flex-start;justify-content:center;padding:0;position:relative;animation:ed-fade-in .5s ease;scrollbar-width:thin;scrollbar-color:#2a2a2a transparent}
        .preview-pane::-webkit-scrollbar{width:4px}
        .preview-pane::-webkit-scrollbar-track{background:transparent}
        .preview-pane::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px}
        .preview-pane::-webkit-scrollbar-thumb:hover{background:#444}
        .preview-device{display:flex;flex-direction:column;transition:width 300ms ease,transform 300ms ease;transform-origin:top center}
        .preview-device.dev-desktop{width:100%;height:100%;min-height:100%}
        .preview-device.dev-tablet{width:768px;min-height:calc(100% - 48px);margin:16px;border-radius:12px;overflow:hidden;border:2px solid #1e1e1e;box-shadow:0 24px 80px rgba(0,0,0,.8)}
        .preview-device.dev-mobile{width:390px;min-height:calc(100% - 48px);margin:16px;border-radius:24px;overflow:hidden;border:3px solid #1e1e1e;box-shadow:0 24px 80px rgba(0,0,0,.8)}
        .preview-dims{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:10px;color:#333;font-family:'Space Mono',monospace;pointer-events:none;white-space:nowrap}
        .preview-iframe{width:100%;height:100%;min-height:100vh;border:none;display:block;overflow:hidden}
        .code-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#0d0d0d;animation:ed-fade-in .3s ease}
        .code-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:8px 14px;border-bottom:1px solid #141414;flex-shrink:0;background:#0a0a0a}
        .code-toolbar-label{font-size:11px;color:#333;margin-right:auto;font-family:'Space Mono',monospace}
        .code-copy-btn{padding:4px 10px;background:#1a1a1a;border:1px solid #222;border-radius:5px;color:#888;font-family:inherit;font-size:11px;font-weight:600;transition:all .15s}
        .code-copy-btn:hover{border-color:#444;color:#ccc}
        .code-copy-btn.ok{border-color:rgba(34,197,94,.4);color:#22c55e}
        .code-export-btn{padding:4px 10px;background:transparent;border:1px solid #222;border-radius:5px;color:#555;font-family:inherit;font-size:11px;transition:all .15s}
        .code-export-btn:hover{border-color:#444;color:#aaa}
        .code-view{flex:1;overflow:auto;padding:20px;font-family:'Space Mono',monospace;font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-all;background:#0d0d0d;margin:0;border-radius:0}
        .sh-tag{color:#777}.sh-attr{color:#ccc}.sh-str{color:#E8692A}.sh-cm{color:#444}
        .preview-mob-toggle{display:none;position:absolute;bottom:16px;right:16px;padding:10px 18px;background:#E8692A;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:700;z-index:5;cursor:pointer}
        @media(max-width:768px){.preview-mob-toggle{display:block}}

        /* ── Report view ── */
        .report-wrap{min-height:100vh;background:#000;color:#ccc;display:flex;flex-direction:column}
        .report-topbar{display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid #141414;flex-shrink:0;background:#000}
        .report-back{display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:transparent;border:1px solid #222;border-radius:7px;color:#666;cursor:pointer;transition:all .15s;flex-shrink:0}
        .report-back:hover{border-color:#444;color:#ccc}
        .report-title{font-size:13px;font-weight:700;color:#fff}
        .report-subtitle{font-size:11px;color:#444;margin-left:auto}
        .report-body{flex:1;overflow-y:auto;padding:32px 24px;max-width:900px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:24px}
        .rpt-section{background:#070707;border:1px solid #141414;border-radius:12px;overflow:hidden}
        .rpt-section-hd{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #141414;cursor:pointer;user-select:none;transition:background .15s}
        .rpt-section-hd:hover{background:#0d0d0d}
        .rpt-sec-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#555}
        .rpt-sec-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:auto}
        .rpt-sec-badge.p1{background:rgba(232,105,42,.1);color:#E8692A;border:1px solid rgba(232,105,42,.2)}
        .rpt-sec-badge.p2{background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.2)}
        .rpt-chevron{color:#333;font-size:10px;transition:transform .2s;margin-left:8px}
        .rpt-chevron.open{transform:rotate(180deg)}
        .rpt-section-body{padding:18px}
        .rpt-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media(max-width:600px){.rpt-grid{grid-template-columns:1fr}}
        .rpt-card{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;padding:14px}
        .rpt-card-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#444;margin-bottom:6px}
        .rpt-card-val{font-size:13px;color:#bbb;line-height:1.6}
        .score-ring-wrap{display:flex;align-items:center;gap:20px;padding:4px 0 12px}
        .score-ring-svg{flex-shrink:0}
        .score-ring-info{display:flex;flex-direction:column;gap:8px}
        .score-sub{display:flex;align-items:center;gap:8px}
        .score-sub-lbl{font-size:11px;color:#444;width:96px}
        .score-sub-bar{flex:1;height:4px;background:#1a1a1a;border-radius:4px;overflow:hidden}
        .score-sub-fill{height:100%;border-radius:4px;background:#E8692A;transition:width .6s ease}
        .score-sub-num{font-size:11px;color:#666;width:20px;text-align:right}
        .chips-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
        .rpt-chip{font-size:11px;padding:3px 10px;border-radius:20px;background:#111;border:1px solid #1e1e1e;color:#888}
        .rpt-chip.orange{background:rgba(232,105,42,.08);border-color:rgba(232,105,42,.2);color:#E8692A}
        .rpt-list{display:flex;flex-direction:column;gap:6px;margin-top:4px}
        .rpt-list-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#888;line-height:1.5}
        .rpt-list-item .ic{flex-shrink:0;margin-top:2px;font-size:10px}
        .rpt-list-item.weak .ic{color:#ef4444}
        .rpt-list-item.strong .ic{color:#22c55e}
        .rpt-list-item.info .ic{color:#E8692A}
        .rpt-struct-list{display:flex;flex-direction:column;gap:6px;margin-top:4px}
        .rpt-struct-item{display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:#0d0d0d;border:1px solid #141414;border-radius:8px;font-size:12px}
        .rpt-struct-pos{width:20px;height:20px;border-radius:5px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#444;flex-shrink:0}
        .rpt-struct-name{font-weight:600;color:#bbb;flex:1}
        .rpt-struct-qual{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;flex-shrink:0}
        .rpt-struct-qual.forte{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
        .rpt-struct-qual.médio,.rpt-struct-qual.medio{background:rgba(234,179,8,.1);color:#eab308;border:1px solid rgba(234,179,8,.2)}
        .rpt-struct-qual.fraco{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
        .rpt-palette{display:flex;gap:8px;margin-top:4px}
        .rpt-swatch{width:32px;height:32px;border-radius:6px;border:1px solid rgba(255,255,255,.06);cursor:default;title:attr(title)}
        .rpt-shots{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
        .rpt-shot{border-radius:8px;overflow:hidden;border:1px solid #1a1a1a}
        .rpt-shot img{width:100%;height:auto;display:block}
        .rpt-shot-lbl{font-size:10px;color:#444;padding:6px 8px;background:#0d0d0d}
        .rpt-pontos-fracos{display:flex;flex-direction:column;gap:8px;margin-top:4px}
        .rpt-pf-item{padding:10px 14px;background:#0d0d0d;border:1px solid #141414;border-radius:8px;display:flex;flex-direction:column;gap:4px}
        .rpt-pf-header{display:flex;align-items:center;gap:8px}
        .rpt-pf-rank{width:18px;height:18px;border-radius:50%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#555;flex-shrink:0}
        .rpt-pf-prob{font-size:12px;font-weight:600;color:#bbb;flex:1}
        .rpt-pf-impact{font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px}
        .rpt-pf-impact.alto{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
        .rpt-pf-impact.médio,.rpt-pf-impact.medio{background:rgba(234,179,8,.1);color:#eab308;border:1px solid rgba(234,179,8,.2)}
        .rpt-pf-impact.baixo{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
        .rpt-pf-fix{font-size:11px;color:#555;line-height:1.5;padding-left:26px}
        .report-cta-wrap{padding:32px 24px;max-width:900px;width:100%;margin:0 auto}
        .report-cta-box{background:linear-gradient(135deg,#0f0700,#150c00);border:1px solid rgba(232,105,42,.2);border-radius:16px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px}
        @media(max-width:600px){.report-cta-box{flex-direction:column;align-items:flex-start}}
        .report-cta-text h3{font-size:18px;font-weight:800;color:#fff;margin:0 0 6px}
        .report-cta-text p{font-size:13px;color:#888;margin:0;line-height:1.5}
        .report-gen-btn{padding:14px 28px;background:#E8692A;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:8px}
        .report-gen-btn:hover:not(:disabled){background:#c4551d;transform:translateY(-1px)}
        .report-gen-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .report-gen-term{background:#060606;border:1px solid #1a1a1a;border-radius:10px;margin-top:16px;overflow:hidden}
        .report-gen-term .term-bar{padding:6px 12px;background:#0a0a0a;border-bottom:1px solid #141414;display:flex;align-items:center;gap:6px}
        .report-gen-term .term-body{padding:10px 14px;font-family:'Space Mono',monospace;font-size:11px;line-height:1.7;color:#555;max-height:120px;overflow-y:auto}

      `}</style>


      {view === 'dashboard' ? (
        <div className="dash">
          {/* ── Sidebar ── */}
          <aside className="sb">
            <div className="sb-logo">
              <img src="/logo.png" alt="clickclone" />
            </div>

            {/* Profile / workspace selector */}
            <div ref={profileRef} style={{ position: 'relative', padding: '0 0 8px' }}>
              <div className="sb-workspace" onClick={() => setProfileOpen(o => !o)}>
                <div className="sb-avatar">{userName ? userName[0].toUpperCase() : '?'}</div>
                <span className="sb-ws-name">{userName || '...'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sb-chevron" style={{ transition: 'transform .2s', transform: profileOpen ? 'rotate(180deg)' : 'none' }}><path d="m6 9 6 6 6-6"/></svg>
              </div>

              {profileOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 8, right: 8,
                  background: 'rgba(17,17,17,0.97)', backdropFilter: 'blur(20px)',
                  border: '1px solid #1e1e1e', borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,.5)', zIndex: 200, overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg,#E8692A,#f07340)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800, color: '#fff',
                    }}>
                      {userName ? userName[0].toUpperCase() : '?'}
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || '...'}</div>
                      <div style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                      background: userPlano === 'pro' ? 'rgba(232,105,42,.1)' : 'rgba(255,255,255,.05)',
                      color: userPlano === 'pro' ? '#E8692A' : '#555',
                      border: `1px solid ${userPlano === 'pro' ? 'rgba(232,105,42,.2)' : 'rgba(255,255,255,.06)'}`,
                      textTransform: 'capitalize', flexShrink: 0,
                    }}>
                      {userPlano === 'pro' ? 'Pro' : 'Free'}
                    </span>
                  </div>

                  {/* Créditos */}
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: '#555', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em' }}>Créditos</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: creditos === 0 ? '#ef4444' : creditos !== null && creditos <= 20 ? '#eab308' : '#e8e8e8' }}>
                        {creditos ?? '—'}
                      </span>
                    </div>
                    <div style={{ background: '#1a1a1a', borderRadius: 4, height: 4, marginBottom: 6 }}>
                      <div style={{
                        height: 4, borderRadius: 4,
                        width: `${creditos !== null ? Math.min(100, (creditos / 100) * 100) : 0}%`,
                        background: creditos === 0 ? '#ef4444' : creditos !== null && creditos <= 20 ? '#eab308' : '#E8692A',
                        transition: 'width .4s ease',
                      }} />
                    </div>
                    {userCreatedAt && (
                      <div style={{ fontSize: 11, color: '#3a3a3a' }}>Renova em {getResetDate(userCreatedAt)}</div>
                    )}
                  </div>

                  {/* Análises */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: '#555', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em' }}>Análises</span>
                    <span style={{ fontSize: 12, fontWeight: 400, color: analises === 0 ? '#ef4444' : analises !== null && analises <= 3 ? '#eab308' : '#666' }}>
                      {analises !== null ? `${analises} restantes` : '—'}
                    </span>
                  </div>

                  {/* Menu */}
                  <div style={{ padding: '5px 6px' }}>
                    <a
                      href="/settings/plans"
                      onClick={() => setProfileOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, fontSize: 13, color: '#888', textDecoration: 'none', transition: 'background .12s, color .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#ccc' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: '#555', flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      Configurações
                    </a>
                    <button
                      onClick={handleLogout}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 6, fontSize: 13, color: '#666', background: 'transparent', border: 'none', fontFamily: 'inherit', width: '100%', cursor: 'pointer', textAlign: 'left', transition: 'background .12s, color .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.08)'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>

            <nav className="sb-nav">
              <button className="sb-nav-item active">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Início
              </button>
              <button className="sb-nav-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Buscar
              </button>
            </nav>

            <div className="sb-section">
              <div className="sb-section-label">Projetos</div>
              {(['mine', 'recent'] as const).map(tab => (
                <button key={tab} className={`sb-sub-item${dashTab === tab ? ' active' : ''}`} onClick={() => setDashTab(tab)}>
                  <span className="sb-diamond">◇</span>
                  {tab === 'mine' ? 'Todos' : 'Recentes'}
                </button>
              ))}
            </div>

            {recentProjects.length > 0 && (
              <div className="sb-section">
                <div className="sb-section-label">Recentes</div>
                {recentProjects.map(p => (
                  <button key={p.id} className="sb-sub-item" onClick={() => openEditor(p)} title={p.name}>
                    <span className="sb-diamond">◆</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="sb-bottom">
              <a href="/settings/plans" style={{ textDecoration: 'none', display: 'block' }}>
                <button className="sb-upgrade">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Upgrade
                </button>
              </a>
            </div>
          </aside>

          {/* ── Main ── */}
          <div className="dash-main">
            {/* Hero */}
            <div className="dash-hero">
              <h1 className="hero-title">O que vamos <span className="acc">construir</span> hoje?</h1>
              <form onSubmit={handleAnalyze}>
                <div className="hero-input-wrap">
                  <span className="hero-input-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  </span>
                  <input
                    className="hero-url-in"
                    type="url"
                    placeholder="Cole o link da Ad Library do concorrente..."
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                  />
                  <button className="hero-send-btn" type="submit" disabled={analyzing || !url.trim()}>
                    {analyzing ? 'Analisando...' : 'Analisar →'}
                  </button>
                </div>
              </form>

              {(termLines.length > 0 || analyzing) && (
                <div className="tool-term" style={{ maxWidth: 640, margin: '24px auto 0', textAlign: 'left' }}>
                  <div className="term-bar">
                    <div className="tbd" style={{ background: '#ff5f57' }} />
                    <div className="tbd" style={{ background: '#febc2e' }} />
                    <div className="tbd" style={{ background: '#28c840' }} />
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#333', marginLeft: 8 }}>clickclone — análise</span>
                  </div>
                  <div className="term-progress">
                    <div className="term-progress-bar" style={{ width: `${dashProgress}%` }} />
                  </div>
                  <div className="term-body">
                    <div className="tl-cmd">$ clickclone analyze --url=&quot;{url.slice(0, 52)}...&quot;</div>
                    {termLines.filter(Boolean).map((l, i) => (
                      <div key={i} className={`tl-${l.type}`}>{l.text}</div>
                    ))}
                    {analyzing && <span className="tcur" />}
                  </div>
                </div>
              )}
              {error && <div className="err" style={{ maxWidth: 640, margin: '16px auto 0', textAlign: 'left' }}>{error}</div>}
            </div>

            {/* Tabs */}
            <div className="dash-tabs">
              {(['mine', 'recent'] as const).map(tab => (
                <button
                  key={tab}
                  className={`dash-tab${dashTab === tab ? ' active' : ''}`}
                  onClick={() => setDashTab(tab)}
                >
                  {tab === 'mine' ? 'Meus projetos' : 'Vistos recentemente'}
                </button>
              ))}
              <span className="dash-tab-spacer" />
              <button className="dash-tab-link">Ver todos →</button>
            </div>

            {/* Content */}
            <div className="dash-content">
              {visibleProjects.length > 0 ? (
                <div>
                  <div className="proj-sec-hd">
                    <h2>{dashTab === 'mine' ? 'Meus projetos' : 'Recentes'}</h2>
                    <span className="proj-count">{visibleProjects.length} projeto{visibleProjects.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="proj-grid">
                    {visibleProjects.map(p => {
                      const sc = Number(p.analysis?.score) || 0
                      const avatarCls = sc >= 7 ? 'proj-avatar score-green' : sc >= 4 ? 'proj-avatar score-yellow' : 'proj-avatar score-red'
                      return (
                        <div key={p.id} className="proj-card" onClick={() => openEditor(p)}>
                          <ProjectThumb html={p.html} />
                          <div className="proj-actions">
                            <button className="proj-action-btn" title="Ver relatório" onClick={e => { e.stopPropagation(); openReport(p) }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </button>
                            <button className="proj-action-btn" title="Baixar HTML" onClick={e => {
                              e.stopPropagation()
                              const blob = new Blob([p.html], { type: 'text/html' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `${p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
                              a.click()
                              URL.revokeObjectURL(url)
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </button>
                            <button className="proj-action-btn del" title="Excluir" onClick={e => {
                              e.stopPropagation()
                              setPendingDelete(p)
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                          <div className="proj-footer">
                            <div className="proj-footer-top">
                              <div className={avatarCls}>{p.name[0]?.toUpperCase()}</div>
                              <div className="proj-name">{p.name}</div>
                            </div>
                            <div className="proj-time">Editado {timeAgo(p.createdAt)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
                  <div style={{ color: '#444', marginBottom: 6 }}>Nenhum projeto ainda</div>
                  <div style={{ color: '#2a2a2a', fontSize: 12 }}>Cole um link de Ad Library acima para começar</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : view === 'report' ? (
        <ReportView
          phase1={phase1Report!}
          phase2={phase2Report!}
          screenshots={phase2Screenshots}
          phase3Loading={phase3Loading}
          phase3Lines={termLines}
          onBack={() => setView('dashboard')}
          onGenerate={handlePhase3}
        />
      ) : (
        <div className="editor-wrap">
          {/* Progress bar */}
          <div className="ed-progress" style={{
            width: loadProgress > 0 ? `${loadProgress}%` : '0%',
            opacity: loadProgress > 0 && loadProgress < 100 ? 1 : loadProgress === 100 ? 0 : 0,
          }} />

          {/* Topbar */}
          <div className="ed-topbar">
            <div className="ed-top-l">
              <button className="ed-back" onClick={() => setView('dashboard')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="ed-proj-wrap">
                <span className="ed-proj-name">{currentProject?.name}</span>
              </div>
            </div>
            <span className="ed-top-divider" />

            <div className="ed-top-c">
              <div className="ed-tabs">
                <button className={`ed-tab${editorTab === 'preview' ? ' active' : ''}`} onClick={() => setEditorTab('preview')}>Preview</button>
                <button className={`ed-tab${editorTab === 'code' ? ' active' : ''}`} onClick={() => setEditorTab('code')}>Code</button>
              </div>
              <div className="ed-url-bar">
                <span className="ed-url-dot" />
                <input
                  className="ed-route-input"
                  value={routeLabel}
                  onChange={e => setRouteLabel(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const iframeDoc = iframeRef.current?.contentDocument
                      if (!iframeDoc) return
                      const sectionId = routeLabel.replace(/^\//, '').toLowerCase()
                      const el = iframeDoc.getElementById(sectionId)
                        || iframeDoc.querySelector(`[data-section="${sectionId}"]`)
                        || iframeDoc.querySelector(`section[id*="${sectionId}"], div[id*="${sectionId}"]`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      else setMessages(prev => [...prev, { role: 'assistant', content: `Criar página "${routeLabel}"?` }])
                    }
                  }}
                  spellCheck={false}
                  placeholder="/home"
                />
                <div className="ed-url-btns">
                  <button className="ed-url-btn" title="Abrir em nova aba" onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) { w.document.write(editorHtml); w.document.close() }
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                  <button className="ed-url-btn" title="Recarregar" onClick={() => {
                    const doc = iframeRef.current?.contentDocument
                    if (doc) { doc.open(); doc.write(editorHtml); doc.close() }
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <span className="ed-top-divider" />
            <div className="ed-top-r">
              <div className="ed-devices">
                <button className={`ed-dev${device === 'desktop' ? ' active' : ''}`} onClick={() => setDevice('desktop')} title="Desktop">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </button>
                <button className={`ed-dev${device === 'tablet' ? ' active' : ''}`} onClick={() => setDevice('tablet')} title="Tablet">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>
                </button>
                <button className={`ed-dev${device === 'mobile' ? ' active' : ''}`} onClick={() => setDevice('mobile')} title="Mobile">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>
                </button>
              </div>
              <button className="ed-btn-dark">Upgrade</button>
              <button className="ed-btn-orange" onClick={exportZip}>Baixar ↓</button>
            </div>
          </div>

          {/* Body */}
          <div className="ed-body">
            {/* Chat — esquerda */}
            <div className={`chat-side${mobChatOpen ? ' mob-open' : ''}`}>

              <>
                  {currentProject && (
                    <div className="analysis-panel">
                      <div className="ap-header" onClick={() => {
                        const next = !analysisOpen
                        setAnalysisOpen(next)
                        localStorage.setItem('cc_analysis_open', String(next))
                      }}>
                        <span className="ap-header-lbl">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                          Resumo da análise
                        </span>
                        <span className={`ap-chevron${analysisOpen ? ' open' : ''}`}>▾</span>
                      </div>
                      <div className="ap-body" style={{ maxHeight: analysisOpen ? 300 : 0 }}>
                        <div className="ap-inner">
                          <div className="ap-row">
                            <span className="ap-lbl">Ângulo</span>
                            <span className="ap-val">{currentProject.analysis.dominant_angle}</span>
                          </div>
                          <div className="ap-row">
                            <span className="ap-lbl">Veredicto</span>
                            <span className="ap-val" style={{ color: '#FF8C00' }}>{currentProject.analysis.verdict}</span>
                          </div>
                          <div className="ap-row">
                            <span className="ap-lbl">Score</span>
                            <span className="ap-val">{currentProject.score}/10</span>
                          </div>
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {currentProject.analysis.weak_points.slice(0, 3).map((p, i) => (
                              <div key={i} className="ap-pt w"><span className="ic">✗</span>{p}</div>
                            ))}
                            {currentProject.analysis.strong_points.slice(0, 2).map((p, i) => (
                              <div key={i} className="ap-pt s"><span className="ic">✓</span>{p}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="chat-msgs">
                    {messages.map((m, i) => {
                      const isLastAssistant = m.role === 'assistant' && i === messages.length - 1 && !chatLoading
                      return (
                        <div key={i} className={`msg ${m.role}`}>
                          {(i === 0 || messages[i - 1]?.role !== m.role) && (
                            <div className="msg-who">
                              {m.role === 'user' ? 'Você' : 'ClickClone AI'}
                              {isLastAssistant && lastEditType === 'patch' && <span className="edit-type-badge patch">⚡ patch</span>}
                              {isLastAssistant && lastEditType === 'full' && <span className="edit-type-badge full">↻ gerado</span>}
                            </div>
                          )}
                          <div className={`msg-bubble${m.isError ? ' err-bubble' : ''}`}>
                            {m.image && <img src={m.image} className="msg-img-thumb" alt="imagem" />}
                            {m.content && renderMsg(m.content)}
                          </div>
                          {isLastAssistant && (
                            <div className="reaction-bar">
                              <button className="react-btn" title="Desfazer">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {chatLoading && (
                      <div className="msg assistant">
                        <div className="msg-who">ClickClone AI</div>
                        {streamingContent ? (
                          <div className="msg-bubble">{renderMsg(streamingContent)}<span className="tcur" /></div>
                        ) : (
                          <div className="thinking-dots"><span /><span /><span /></div>
                        )}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
              </>

              <div className="chat-quick">
                <div className="chat-chips">
                  {(() => {
                    const wp = currentProject?.analysis?.weak_points ?? []
                    const text = wp.join(' ').toLowerCase()
                    const chips: { emoji: string; label: string; action: string }[] = []
                    if (text.includes('depoimento') || text.includes('prova') || text.includes('testimon') || text.includes('social proof'))
                      chips.push({ emoji: '📝', label: 'Adiciona prova social', action: 'Adiciona seção de depoimentos com 3 cases reais' })
                    if (text.includes('preço') || text.includes('valor') || text.includes('price') || text.includes('preco'))
                      chips.push({ emoji: '💰', label: 'Destaca o preço', action: 'Destaca o preço principal com mais contraste e urgência' })
                    if (text.includes('cta') || text.includes('call to action') || text.includes('botão') || text.includes('button'))
                      chips.push({ emoji: '⚡', label: 'Fortalece o CTA', action: 'Melhora o CTA principal com copy mais forte e contraste maior' })
                    if (text.includes('urgência') || text.includes('escassez') || text.includes('urgencia') || text.includes('limitad'))
                      chips.push({ emoji: '⚡', label: 'Adiciona escassez', action: 'Adiciona countdown e aviso de vagas limitadas' })
                    if (text.includes('headline') || text.includes('título') || text.includes('titulo'))
                      chips.push({ emoji: '📝', label: 'Reescreve a headline', action: 'Reescreve a headline principal com copy mais impactante e específico' })
                    chips.push({ emoji: '🎨', label: 'Melhora o design geral', action: 'Melhora o design geral da página com mais hierarquia visual e contraste' })
                    return chips.slice(0, 3).map(chip => (
                      <button key={chip.label} type="button" className="chip" onClick={() => setChatInput(chip.action)}>
                        {chip.emoji} {chip.label}
                      </button>
                    ))
                  })()}
                </div>
              </div>
              <div
                className="chat-form-wrap"
                onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }}
                onDrop={e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
              >
                {isDragOver && <div className="drag-overlay">Solte a imagem aqui</div>}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
              <form className="chat-form" onSubmit={sendChat}>
                <div className="chat-in-outer">
                  {pendingImage && (
                    <div className="img-preview-row">
                      <div className="img-preview-item">
                        <img src={pendingImage.dataUrl} className="img-preview-thumb" alt="preview" />
                        <button type="button" className="img-preview-x" onClick={() => setPendingImage(null)}>×</button>
                      </div>
                    </div>
                  )}
                  <textarea
                    className="chat-textarea"
                    placeholder={isListening ? 'Ouvindo...' : 'Pergunte algo ou peça uma edição...'}
                    value={chatInput}
                    onChange={e => {
                      setChatInput(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(e as unknown as React.FormEvent) }
                    }}
                    onPaste={e => {
                      const items = e.clipboardData?.items
                      if (!items) return
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith('image/')) {
                          e.preventDefault()
                          const f = item.getAsFile()
                          if (f) handleImageFile(f)
                          break
                        }
                      }
                    }}
                  />
                  <div className="chat-in-footer">
                    <button type="button" className="chat-attach-btn" title="Anexar imagem" onClick={() => fileInputRef.current?.click()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <button type="button" className="chat-visual-pill">
                      <span className="dot" />
                      Visual Edits
                    </button>
                    <div className="chat-in-r">
                      {hasSpeechSupport && (
                        <button
                          type="button"
                          className={`chat-mic-btn${isListening ? ' listening' : ''}`}
                          title={isListening ? 'Parar gravação' : 'Gravar voz'}
                          onClick={toggleMic}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                        </button>
                      )}
                      <button className="chat-send-btn" type="submit" disabled={(!chatInput.trim() && !pendingImage) || chatLoading || (creditos !== null && creditos === 0)}>
                        {chatLoading
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </form>
              </div>
            </div>

            {/* Preview — direita */}
            <div ref={previewPaneRef} className="preview-pane">
              {editorTab === 'preview' ? (() => {
                const devW = device === 'mobile' ? 390 : device === 'tablet' ? 768 : paneWidth
                const scale = device !== 'desktop' && paneWidth > 0 && paneWidth < devW ? paneWidth / devW : 1
                const devH = device === 'mobile' ? 844 : device === 'tablet' ? 1024 : undefined
                return (
                  <>
                    <div
                      className={`preview-device dev-${device}`}
                      style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
                    >
                      <iframe
                        ref={iframeRef}
                        className="preview-iframe"
                        srcDoc={editorHtml}
                        title="preview"
                      />
                    </div>
                    {device !== 'desktop' && <div className="preview-dims">{devW} × {devH}</div>}
                  </>
                )
              })() : (
                <div className="code-wrap">
                  <div className="code-toolbar">
                    <span className="code-toolbar-label">index.html</span>
                    <button className={`code-copy-btn${copied ? ' ok' : ''}`} onClick={() => {
                      navigator.clipboard.writeText(editorHtml)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}>{copied ? '✓ Copiado' : 'Copiar'}</button>
                    <button className="code-export-btn" onClick={() => {
                      const blob = new Blob([editorHtml], { type: 'text/html' })
                      const a = document.createElement('a')
                      a.href = URL.createObjectURL(blob)
                      a.download = `${currentProject?.name || 'page'}.html`
                      a.click()
                    }}>Baixar HTML ↓</button>
                  </div>
                  <pre className="code-view" dangerouslySetInnerHTML={{ __html: syntaxHighlight(editorHtml) }} />
                </div>
              )}
              <button className="preview-mob-toggle" onClick={() => setMobChatOpen(true)}>Chat ↑</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999 }} onClick={() => { if (!deleting) { setPendingDelete(null); setDeleteError('') } }}>
          <div style={{ background:'#111',border:'1px solid #222',borderRadius:16,padding:'32px 28px',maxWidth:360,width:'90%',textAlign:'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:32,marginBottom:12 }}>🗑️</div>
            <h2 style={{ fontSize:18,fontWeight:800,color:'#fff',marginBottom:8 }}>
              {deleteError ? 'Aviso' : 'Excluir projeto?'}
            </h2>
            {deleteError ? (
              <p style={{ color:'#f87171',fontSize:13,lineHeight:1.6,marginBottom:24,textAlign:'left' }}>{deleteError}</p>
            ) : (
              <p style={{ color:'#888',fontSize:14,lineHeight:1.6,marginBottom:24 }}>
                <strong style={{ color:'#fff' }}>{pendingDelete.name}</strong> será removido permanentemente.<br />
                A próxima análise da mesma URL será gerada do zero.
              </p>
            )}
            {!deleteError && (
              <button
                onClick={() => confirmDelete(pendingDelete)}
                disabled={deleting}
                style={{ display:'block',width:'100%',background:'#ef4444',color:'#fff',padding:'12px 0',borderRadius:8,fontWeight:700,fontSize:15,border:'none',cursor:deleting?'not-allowed':'pointer',marginBottom:8,opacity:deleting?0.6:1 }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            )}
            <button
              onClick={() => { setPendingDelete(null); setDeleteError('') }}
              disabled={deleting}
              style={{ display:'block',width:'100%',background:'transparent',border:'1px solid #333',color:'#666',padding:'10px 0',borderRadius:8,fontWeight:500,fontSize:14,cursor:'pointer' }}
            >
              {deleteError ? 'Fechar' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {upgradeModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999 }} onClick={() => setUpgradeModal(false)}>
          <div style={{ background:'#111',border:'1px solid #222',borderRadius:16,padding:'36px 32px',maxWidth:400,width:'90%',textAlign:'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:36,marginBottom:12 }}>🔒</div>
            <h2 style={{ fontSize:20,fontWeight:800,color:'#fff',marginBottom:10 }}>Limite atingido</h2>
            <p style={{ color:'#888',fontSize:14,lineHeight:1.6,marginBottom:24 }}>
              Você usou todas as suas análises gratuitas.<br />
              Assine o ClickClone Pro e ganhe <strong style={{ color:'#fff' }}>10 análises/mês</strong> + edição ilimitada por apenas <strong style={{ color:'#E8692A' }}>R$57,90/mês</strong>.
            </p>
            <a
              href="https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9"
              target="_blank"
              rel="noreferrer"
              style={{ display:'block',background:'#E8692A',color:'#fff',padding:'13px 0',borderRadius:8,fontWeight:700,fontSize:15,textDecoration:'none',marginBottom:10 }}
            >
              Assinar agora →
            </a>
            <button
              onClick={() => setUpgradeModal(false)}
              style={{ background:'transparent',border:'1px solid #333',color:'#666',padding:'10px 0',borderRadius:8,fontWeight:500,fontSize:14,cursor:'pointer',width:'100%' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
