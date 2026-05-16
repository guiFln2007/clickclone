'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import RatMascot from './RatMascot'

/* ─────────── TYPES ─────────── */

interface SavedAnalysis {
  id: string
  name: string
  score: number
  url: string
  nicho?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase1: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase2: Record<string, any>
  screenshots: string[]
  createdAt: number
}

interface TrackedOffer {
  id: string
  pagina_nome: string
  ad_library_url: string
  landing_url: string | null
  nicho: string | null
  ultimo_snapshot_ads: number | null
  primeiro_snapshot_ads: number | null
  status: string
  alertas_nao_lidos: number
  criado_em: string
  verificado_em: string | null
}

interface OfferAlert {
  id: string
  tipo: string
  mensagem: string
  dados_anteriores: string | null
  dados_novos: string | null
  criado_em: string
  lido: number
}

interface Snapshot {
  id: string
  ads_count: number
  variacao: number
  variacao_percent: number
  registrado_em: string
}

interface MineResult {
  pagina_nome: string
  ad_library_url: string
  landing_url: string | null
  total_anuncios: number
  dias_rodando: number | null
  score_escalabilidade: number
  nicho: string
  resumo_angulo?: string
}

/* ─────────── HELPERS ─────────── */

function getSessionId(): string {
  const key = 'cc_session_id'
  let id = localStorage.getItem(key)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id) }
  return id
}

function timeAgo(ts: number | string) {
  const d = (Date.now() - (typeof ts === 'string' ? new Date(ts).getTime() : ts)) / 1000
  if (d < 60) return 'agora'
  if (d < 3600) return `${Math.floor(d / 60)}min`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

/* ─────────── REPORT SECTION ─────────── */

function ReportSection({ label, badge, badgeCls, children }: { label: string; badge?: string; badgeCls?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rpt-section">
      <div className="rpt-section-hd" onClick={() => setOpen(o => !o)}>
        <span className="rpt-sec-label">{label}</span>
        {badge && <span className={`rpt-sec-badge ${badgeCls || ''}`}>{badge}</span>}
        <span className={`rpt-chevron${open ? ' open' : ''}`}>&#9660;</span>
      </div>
      {open && <div className="rpt-section-body">{children}</div>}
    </div>
  )
}

/* ─────────── REPORT VIEW ─────────── */

function ReportView({ phase1, phase2, onBack, onSaveToRadar, saving }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase1: Record<string, any>; phase2: Record<string, any>
  onBack: () => void; onSaveToRadar: () => void; saving?: boolean
}) {
  const handleSave = () => { onSaveToRadar() }
  const nota = phase1.nota_entrada || {}
  const score = nota.score ?? 0
  const volumePts = nota.volume_pts ?? 0
  const tempoPts = nota.tempo_pts ?? 0
  const expertPts = nota.expert_pts ?? 0
  const volumeDesc = (nota.volume_desc as string) ?? ''
  const tempoDesc = (nota.tempo_desc as string) ?? ''
  const expertDesc = (nota.expert_desc as string) ?? ''

  // Phase 1 data
  const pontosFortes: string[] = phase1.pontos_fortes_criativos || []
  const pontosFracos: string[] = phase1.pontos_fracos_criativos || []
  const modelar = phase1.o_que_modelar || { manter: [], corrigir: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scripts: { numero: number; formato: string; hook: string; corpo: string; cta: string }[] = phase1.scripts_ctv || []
  const anguloD: string = phase1.angulo_dominante || ''
  const usaPraVender: string[] = phase1.o_que_usa_pra_vender || []
  const angulosNaoExplorados: string[] = phase1.angulos_nao_explorados || []

  // Top criativos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topCriativos: { index: number; texto_completo: string; hook: string; formato: string; dias_rodando: number; score: number; angulo: string; media_url?: string }[] = phase1.top_criativos || []

  // Phase 2 data
  const promptLovable: string = phase2.prompt_lovable || ''
  const estruturaFunil: string[] = phase2.estrutura_funil || []
  const diferenciaisAplicados: string[] = phase2.diferenciais_aplicados || []
  const [promptCopied, setPromptCopied] = useState(false)
  const r = 40, circ = 2 * Math.PI * r, dash = (score / 10) * circ
  const verdict = score >= 9 ? { label: 'Oportunidade Excelente', cls: 'vrd-green' }
    : score >= 7 ? { label: 'Vale Entrar', cls: 'vrd-green' }
    : score >= 5 ? { label: 'Entrada com Cautela', cls: 'vrd-yellow' }
    : { label: 'Evitar', cls: 'vrd-red' }

  return (
    <div className="report-wrap">
      <div className="report-topbar">
        <button className="report-back" onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <span className="report-subtitle">{phase1.pagina_nome || phase2.url_analisada || ''}</span>
      </div>
      <div className="report-body">

        {/* ══ BLOCO 1 — NOTA DA OFERTA ══ */}
        <div className={`nota-card ${verdict.cls}`}>
          <div className="nota-badge">{verdict.label}</div>
          <div className="nota-score-row">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="6" />
              <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)' }} />
              <text x="55" y="60" textAnchor="middle" fill="currentColor" fontSize="28" fontWeight="900">{score}</text>
              <text x="55" y="74" textAnchor="middle" fill="currentColor" fontSize="12" opacity=".5">/10</text>
            </svg>
            <div className="nota-breakdown">
              <div className="nota-crit"><div className="nota-crit-top"><span>Volume de an{'\u00FA'}ncios</span><span className="nota-crit-pts">{volumePts}/4</span></div><div className="nota-bar"><div className="nota-bar-fill" style={{ width: `${(volumePts / 4) * 100}%` }} /></div><div className="nota-crit-desc">{volumeDesc}</div></div>
              <div className="nota-crit"><div className="nota-crit-top"><span>Tempo rodando</span><span className="nota-crit-pts">{tempoPts !== null ? `${tempoPts}/3` : '\u2014/3'}</span></div><div className="nota-bar">{tempoPts !== null ? <div className="nota-bar-fill" style={{ width: `${(tempoPts / 3) * 100}%` }} /> : <div className="nota-bar-na" />}</div><div className="nota-crit-desc">{tempoDesc}</div></div>
              <div className="nota-crit"><div className="nota-crit-top"><span>Expert identific{'\u00E1'}vel</span><span className="nota-crit-pts">{expertPts}/3</span></div><div className="nota-bar"><div className="nota-bar-fill" style={{ width: `${(expertPts / 3) * 100}%` }} /></div><div className="nota-crit-desc">{expertDesc}</div></div>
            </div>
          </div>
          {nota.justificativa && <div className="nota-just">{nota.justificativa as string}</div>}
        </div>

        {/* ══ TOP CRIATIVOS (logo após a nota) ══ */}

        {/* ══ TOP 6 CRIATIVOS ESCALADOS ══ */}
        {topCriativos.length > 0 && (
          <div>
            <div className="rpt-card-lbl" style={{ marginBottom: 16 }}>TOP {topCriativos.length} CRIATIVOS MAIS ESCALADOS</div>
            <div className="criativos-grid">
              {topCriativos.map((c, i) => {
                const scoreCls = c.score >= 8 ? 'green' : c.score >= 5 ? 'yellow' : 'red'
                return (
                  <div key={i} className="criativo-card">
                    {c.media_url && (
                      <div className="criativo-media">
                        {c.media_url.includes('.mp4') || c.media_url.includes('video_hd') || c.media_url.includes('video_sd') || c.media_url.includes('/v/') ? (
                          <video src={c.media_url} controls preload="metadata" />
                        ) : (
                          <img src={c.media_url} alt="" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                        )}
                      </div>
                    )}
                    <div className="criativo-header">
                      <div className={`criativo-score ${scoreCls}`}>{c.score}</div>
                      <div className="criativo-meta">
                        <span className="criativo-formato">{c.media_url && (c.media_url.includes('.mp4') || c.media_url.includes('video')) ? 'V\u00cdDEO' : c.formato.toUpperCase()}</span>
                        {c.dias_rodando > 0 && <span className="criativo-dias">{c.dias_rodando}d</span>}
                      </div>
                    </div>
                    <div className="criativo-hook">&ldquo;{c.hook}&rdquo;</div>
                    <div className="criativo-angulo">{c.angulo}</div>
                    <div className="criativo-actions">
                      <button
                        className="criativo-btn"
                        onClick={() => {
                          const blob = new Blob([c.texto_completo], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `criativo-${c.index}-transcricao.txt`
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Baixar transcri{'\u00e7\u00e3'}o
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ ANÁLISE DOS CRIATIVOS ══ */}
        <div className="rpt-divider" />
        <div className="rpt-sec-title">AN{'\u00C1'}LISE DOS CRIATIVOS <span className="rpt-sec-count">{phase1.total_ads_analyzed || '?'} an{'\u00FA'}ncios analisados</span></div>

        {pontosFortes.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">PONTOS FORTES</div><div className="rpt-list">{pontosFortes.map((p, i) => <div key={i} className="rpt-list-item strong"><span className="ic">{'\u2713'}</span><span>{p}</span></div>)}</div></div>}
        {pontosFracos.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">PONTOS FRACOS</div><div className="rpt-list">{pontosFracos.map((p, i) => <div key={i} className="rpt-list-item weak"><span className="ic">{'\u2715'}</span><span>{p}</span></div>)}</div></div>}

        {/* ══ PROMPT LOVABLE ══ */}
        <div className="rpt-divider" />
        <div className="rpt-sec-title">PROMPT LOVABLE</div>

        {promptLovable && (
          <div className="rpt-card" style={{ position: 'relative' }}>
            <div className="rpt-card-lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PROMPT {'\u2014'} COPIE E COLE NO LOVABLE</span>
              <button
                onClick={() => { navigator.clipboard.writeText(promptLovable); setPromptCopied(true); setTimeout(() => setPromptCopied(false), 2000) }}
                style={{ background: promptCopied ? '#10B981' : '#FF6B00', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}
              >
                {promptCopied ? '\u2713 Copiado!' : 'Copiar prompt'}
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, lineHeight: 1.7, color: '#ccc', background: 'rgba(0,0,0,.3)', padding: 16, borderRadius: 8, maxHeight: 400, overflowY: 'auto', marginTop: 10, border: '1px solid rgba(255,255,255,.06)' }}>{promptLovable}</pre>
          </div>
        )}

        {/* ══ BLOCO 4 — AN{'\u00C1'}LISE GERAL ══ */}
        <div className="rpt-divider" />
        <div className="rpt-sec-title">AN{'\u00C1'}LISE GERAL DA OFERTA</div>

        {anguloD && <div className="rpt-card rpt-card-orange"><div className="rpt-card-lbl">{'\u00C2'}NGULO DOMINANTE</div><div className="rpt-card-val">{anguloD}</div></div>}
        {usaPraVender.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">O QUE O CONCORRENTE USA PRA VENDER</div><div className="rpt-list">{usaPraVender.map((u, i) => <div key={i} className="rpt-list-item"><span className="ic" style={{ color: '#FF6B00' }}>{'\u2022'}</span><span>{u}</span></div>)}</div></div>}
        {angulosNaoExplorados.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">{'\u00C2'}NGULOS N{'\u00C3'}O EXPLORADOS</div><div className="rpt-list">{angulosNaoExplorados.map((a, i) => <div key={i} className="rpt-list-item info"><span className="ic">{'\u2192'}</span><span>{a}</span></div>)}</div></div>}
      </div>

      {/* CTA STICKY */}
      <div className="report-cta-sticky">
        <button className="cta-pdf-btn" onClick={() => window.print()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Baixar PDF
        </button>
        <button className="cta-radar-btn" onClick={handleSave} disabled={saving}>
          {saving ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Salvando...</>
          : <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Salvar no Radar</>}
        </button>
      </div>
    </div>
  )
}

/* ─────────── MAIN PAGE ─────────── */

export default function ToolPage() {
  type Tab = 'home' | 'ofertas' | 'analise' | 'rastreamento' | 'minerador'
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [showReport, setShowReport] = useState(false)

  // Analysis
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [termLines, setTermLines] = useState<{ text: string; type: string }[]>([])
  const [error, setError] = useState('')
  const [dashProgress, setDashProgress] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phase1Report, setPhase1Report] = useState<Record<string, any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phase2Report, setPhase2Report] = useState<Record<string, any> | null>(null)
  const [phase2Screenshots, setPhase2Screenshots] = useState<string[]>([])
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([])

  // Radar
  const [trackedOffers, setTrackedOffers] = useState<TrackedOffer[]>([])
  const [radarSearch, setRadarSearch] = useState('')
  const [historyView, setHistoryView] = useState<{ offer: TrackedOffer; snapshots: Snapshot[] } | null>(null)
  const [totalAlerts, setTotalAlerts] = useState(0)

  // Ofertas feed
  interface FeedOffer { id: string; page_name: string; page_id: string; ad_count: number; landing_url: string | null; thumbnail_url: string | null; creative_urls: string | null; nicho: string | null; dias_rodando: number | null; first_seen: string; last_seen: string; enriched: number; ig_handle: string | null; ig_followers: number | null; fb_followers: number | null; landing_screenshot: string | null; ad_copies: string | null }
  const [feedOffers, setFeedOffers] = useState<FeedOffer[]>([])
  const [feedTotal, setFeedTotal] = useState(0)
  const [feedSearch, setFeedSearch] = useState('')
  const [feedNicho, setFeedNicho] = useState('')
  const [feedSort, setFeedSort] = useState<'ad_count' | 'dias_rodando' | 'last_seen'>('ad_count')
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedOffset, setFeedOffset] = useState(0)
  const [feedDetail, setFeedDetail] = useState<FeedOffer | null>(null)
  const [feedFilterOpen, setFeedFilterOpen] = useState(false)
  const [feedEstrutura, setFeedEstrutura] = useState<string[]>([])
  const [fdTranscriptExpanded, setFdTranscriptExpanded] = useState(false)
  const [fdShowAllCreatives, setFdShowAllCreatives] = useState(false)

  const loadFeed = useCallback(async (reset = false) => {
    setFeedLoading(true)
    const off = reset ? 0 : feedOffset
    try {
      const params = new URLSearchParams({ limit: '48', offset: String(off), sort: feedSort })
      if (feedSearch) params.set('search', feedSearch)
      if (feedNicho) params.set('nicho', feedNicho)
      const res = await fetch(`/api/offers?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (reset) { setFeedOffers(data.offers); setFeedOffset(48) }
        else { setFeedOffers(prev => [...prev, ...data.offers]); setFeedOffset(off + 48) }
        setFeedTotal(data.total)
      }
    } catch { /* ok */ }
    setFeedLoading(false)
  }, [feedOffset, feedSearch, feedNicho, feedSort])

  useEffect(() => { if (activeTab === 'ofertas') loadFeed(true) }, [activeTab, feedSearch, feedNicho, feedSort]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mine
  const [mineKeyword, setMineKeyword] = useState('')
  const [mineMinAds, setMineMinAds] = useState(20)
  const [mineMinDays, setMineMinDays] = useState(15)
  const [mining, setMining] = useState(false)
  const [mineResults, setMineResults] = useState<MineResult[]>([])
  const [mineError, setMineError] = useState('')
  const [mineStatus, setMineStatus] = useState('')

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Auth
  const [userId, setUserId] = useState<number | null>(null)
  const [userName, setUserName] = useState('')
  const [analises, setAnalises] = useState<number | null>(null)
  const [mineracoes, setMineracoes] = useState<number | null>(null)
  const [maxAnalises, setMaxAnalises] = useState(5)
  const [maxMineracoes, setMaxMineracoes] = useState(5)
  const [maxSlots, setMaxSlots] = useState(5)
  const [plano, setPlano] = useState('starter')
  const [renovaEm, setRenovaEm] = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const nichos = ['Relacionamento', 'Financas', 'Emagrecimento', 'Espiritualidade', 'Maternidade', 'Carreira', 'Saude', 'Beleza'] // usado no modal de adicionar oferta

  // Auth init
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (typeof d.user?.id === 'number') setUserId(d.user.id)
      if (d.user?.nome) setUserName(d.user.nome.split(' ')[0])
      if (typeof d.user?.analises === 'number') setAnalises(d.user.analises)
      if (typeof d.user?.mineracoes === 'number') setMineracoes(d.user.mineracoes)
      if (typeof d.user?.max_analises === 'number') setMaxAnalises(d.user.max_analises)
      if (typeof d.user?.max_mineracoes === 'number') setMaxMineracoes(d.user.max_mineracoes)
      if (typeof d.user?.max_slots_radar === 'number') setMaxSlots(d.user.max_slots_radar)
      if (d.user?.plano) setPlano(d.user.plano)
      if (d.user?.renova_em) setRenovaEm(d.user.renova_em)
      // Save for visitor tracking
      if (d.user?.id) {
        try { localStorage.setItem('rato_user', JSON.stringify({ id: d.user.id, email: d.user.email })) } catch {}
      }
    }).catch(() => {})
  }, [])

  // Load saved analyses
  useEffect(() => {
    const saved = localStorage.getItem('cc_analyses')
    if (saved) setSavedAnalyses(JSON.parse(saved))
  }, [])

  // Load radar offers
  const loadRadar = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/radar', { headers: { 'x-user-id': String(userId) } })
      if (res.ok) {
        const data = await res.json()
        setTrackedOffers(data.offers || [])
        setTotalAlerts((data.offers || []).reduce((s: number, o: TrackedOffer) => s + o.alertas_nao_lidos, 0))
      }
    } catch { /* ok */ }
  }, [userId])

  useEffect(() => { loadRadar() }, [loadRadar])

  // Click outside profile
  useEffect(() => {
    const h = (e: MouseEvent) => { if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const authHeaders = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json', 'x-session-id': getSessionId() }
    if (userId) h['x-user-id'] = String(userId)
    return h
  }

  // ── ANALYZE ──
  async function handleAnalyze(e?: React.FormEvent, overrideUrl?: string) {
    if (e) e.preventDefault()
    const analyzeUrl = overrideUrl || url
    if (!analyzeUrl.trim()) return
    setShowReport(false); setAnalyzing(true); setError(''); setTermLines([]); setDashProgress(0)
    setPhase1Report(null); setPhase2Report(null); setPhase2Screenshots([])
    if (stepTimer.current) clearInterval(stepTimer.current)

    async function readSSE(res: Response, onEvent: (ev: Record<string, unknown>) => boolean): Promise<void> {
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      function processBuffer(): boolean {
        const parts = buffer.split('\n\n'); buffer = parts.pop() ?? ''
        for (const part of parts) { if (!part.startsWith('data: ')) continue; let ev: Record<string, unknown>; try { ev = JSON.parse(part.slice(6)) } catch { continue }; if (onEvent(ev)) return true }
        return false
      }
      while (true) { const { done, value } = await reader.read(); if (value) buffer += decoder.decode(value, { stream: !done }); if (processBuffer()) return; if (done) break }
      if (buffer.trim()) { buffer += '\n\n'; processBuffer() }
    }

    try {
      setTermLines([{ text: '> Iniciando analise de anuncios...', type: 'wait' }])
      const res1 = await fetch('/api/phase1', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: analyzeUrl }) })
      if (res1.status === 402) { setUpgradeModal(true); return }
      if (!res1.ok) { const e = await res1.json().catch(() => ({})); throw new Error(e.error || 'Erro na fase 1') }

      let p1: Record<string, unknown> | null = null; let phase1Err: string | null = null
      await readSSE(res1, ev => {
        if (ev.type === 'error') { phase1Err = ev.message as string; return true }
        if (ev.type === 'progress') { setTermLines(prev => [...prev, { text: `> ${ev.text}`, type: 'wait' }]); setDashProgress(30) }
        if (ev.type === 'done') { p1 = ev.report as Record<string, unknown>; setTermLines(prev => [...prev, { text: '\u2713 Fase 1 concluida', type: 'done' }]); setDashProgress(50); return true }
        return false
      })
      if (phase1Err) throw new Error(phase1Err)
      if (!p1) throw new Error('Fase 1 nao retornou relatorio')
      setPhase1Report(p1)

      const landingUrl = (p1 as Record<string, unknown>).landing_url as string
      if (!landingUrl) throw new Error('URL da pagina nao encontrada')
      setTermLines(prev => [...prev, { text: '> Gerando prompt do funil...', type: 'wait' }])

      const res2 = await fetch('/api/phase2', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: landingUrl, phase1Report: p1 }) })
      if (res2.status === 402) { setUpgradeModal(true); return }
      if (!res2.ok) { const e = await res2.json().catch(() => ({})); throw new Error(e.error || 'Erro na fase 2') }

      let p2: Record<string, unknown> | null = null; let shots: string[] = []; let phase2Err: string | null = null
      await readSSE(res2, ev => {
        if (ev.type === 'error') { phase2Err = ev.message as string; return true }
        if (ev.type === 'progress') { setTermLines(prev => [...prev, { text: `> ${ev.text}`, type: 'wait' }]); setDashProgress(75) }
        if (ev.type === 'done') { p2 = ev.report as Record<string, unknown>; shots = (ev.screenshots as string[]) || []; setTermLines(prev => [...prev, { text: '\u2713 Prompt do funil pronto', type: 'done' }]); setDashProgress(100); return true }
        return false
      })
      if (phase2Err) throw new Error(phase2Err)
      if (!p2) throw new Error('Fase 2 nao retornou relatorio')
      setPhase2Report(p2); setPhase2Screenshots(shots)

      // Save to history
      const promessa = ((p2 as Record<string, unknown>).promessa_central as string)?.split(' ').slice(0, 5).join(' ') || ''
      const record: SavedAnalysis = { id: Date.now().toString(), name: promessa || ((p1 as Record<string, unknown>).angulo_dominante as string) || 'Oferta', score: Number((p1 as Record<string, unknown>).nota_entrada && ((p1 as Record<string, unknown>).nota_entrada as Record<string, number>).score) || 0, url: analyzeUrl, phase1: p1 as Record<string, unknown>, phase2: p2 as Record<string, unknown>, screenshots: shots.slice(0, 2), createdAt: Date.now() }
      const updated = [record, ...savedAnalyses.filter(a => a.url !== analyzeUrl)].slice(0, 20)
      setSavedAnalyses(updated); localStorage.setItem('cc_analyses', JSON.stringify(updated))
      setShowReport(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao analisar') } finally { setAnalyzing(false) }
  }

  // ── SAVE TO RADAR ──
  const [savedModal, setSavedModal] = useState(false)
  const [savingRadar, setSavingRadar] = useState(false)
  const savingRef = useRef(false)

  async function saveToRadar() {
    if (!phase1Report || !phase2Report) return
    if (!userId) { showToast('Fa\u00e7a login para salvar no Radar', 'err'); return }
    if (savingRef.current || savedModal) return
    savingRef.current = true
    setSavingRadar(true)
    try {
      const totalAds = phase1Report.total_ads_analyzed || phase1Report.ad_analysis?.total_ads || 0
      const res = await fetch('/api/radar', { method: 'POST', headers: authHeaders(), body: JSON.stringify({
        pagina_nome: phase1Report.pagina_nome || phase2Report.url_analisada?.replace(/^https?:\/\//, '').split('/')[0] || phase1Report.angulo_dominante || 'Oferta',
        ad_library_url: url,
        landing_url: phase2Report.url_analisada || phase1Report.landing_url || null,
        nicho: phase1Report.nicho_identificado || phase1Report.nota_entrada?.nicho || null,
        snapshot_ads: totalAds,
        snapshot_data: { phase1: phase1Report, phase2: phase2Report },
      }) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSavingRadar(false)
      setSavedModal(true)
      loadRadar().catch(() => {})
    } catch (err) {
      setSavingRadar(false)
      savingRef.current = false
      showToast(`Erro ao salvar: ${(err as Error).message}`, 'err')
    }
  }

  // ── RADAR ACTIONS ──
  async function viewHistory(offer: TrackedOffer) {
    try {
      const res = await fetch(`/api/radar/${offer.id}/snapshots`, { headers: { 'x-user-id': String(userId) } })
      const data = res.ok ? await res.json() : { snapshots: [] }
      setHistoryView({ offer, snapshots: data.snapshots || [] })
      if (offer.alertas_nao_lidos > 0) {
        await fetch(`/api/radar/${offer.id}/read`, { method: 'PATCH', headers: authHeaders() })
        await loadRadar()
      }
    } catch { setHistoryView({ offer, snapshots: [] }) }
  }

  // Returns a string like "amanhã às 07:00" or "hoje às 07:00" — all offers update together at 7am BRT
  function nextUpdateLabel(): string {
    const now = new Date()
    // Brasil UTC-3 → 07:00 BRT = 10:00 UTC
    const next = new Date()
    next.setUTCHours(10, 0, 0, 0)
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
    const sameDay = next.toDateString() === now.toDateString()
    return sameDay ? 'hoje às 07:00' : 'amanhã às 07:00'
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function removeFromRadar(id: string) {
    setConfirmDeleteId(null)
    // Remove from local state INSTANTLY
    setTrackedOffers(prev => prev.filter(o => o.id !== id))
    // Delete from server and WAIT for it to complete before any future loadRadar
    try {
      await fetch('/api/radar', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id }) })
    } catch { /* ignore */ }
  }

  // ── MINE ──
  async function handleMine() {
    if (!mineKeyword.trim() || mining) return
    setMining(true); setMineError(''); setMineResults([]); setMineStatus('Conectando \u00E0 biblioteca de an\u00FAncios...')
    try {
      // 1. Start the mining run
      const startRes = await fetch('/api/mine', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ keyword: mineKeyword.trim() }) })
      if (!startRes.ok) { const e = await startRes.json().catch(() => ({})); throw new Error(e.error || 'Erro ao iniciar') }
      const { runId } = await startRes.json()
      if (!runId) throw new Error('Falha ao iniciar busca')

      setMineStatus('Minerando an\u00FAncios na biblioteca...')

      // 2. Poll every 5s until done
      const statusMsgs = ['Vasculhando bibliotecas de an\u00FAncios...', 'Analisando p\u00E1ginas encontradas...', 'Filtrando ofertas validadas...', 'Isso pode levar alguns minutos...', 'Processando resultados...', 'Quase l\u00E1...']
      let msgIdx = 0
      for (let attempt = 0; attempt < 240; attempt++) { // max 20 min
        await new Promise(r => setTimeout(r, 5000))
        if (attempt % 6 === 5) { msgIdx = Math.min(msgIdx + 1, statusMsgs.length - 1); setMineStatus(statusMsgs[msgIdx]) }

        const pollRes = await fetch(`/api/mine?runId=${runId}&nicho=${encodeURIComponent(mineKeyword.trim())}`, { headers: authHeaders() })
        if (!pollRes.ok) continue
        const data = await pollRes.json()

        if (data.status === 'running') continue
        if (data.status === 'failed') throw new Error(data.error || 'Minera\u00E7\u00E3o falhou')
        if (data.status === 'done') {
          setMineResults(data.ofertas || [])
          if (!data.ofertas?.length) setMineError('Nenhuma oferta encontrada com esses filtros. Tente diminuir o m\u00EDnimo de an\u00FAncios.')
          setMining(false); setMineStatus(''); return
        }
      }
      throw new Error('Tempo esgotado. Tente novamente.')
    } catch (err) { setMineError(err instanceof Error ? err.message : 'Erro') } finally { setMining(false); setMineStatus('') }
  }

  // toggleNicho removido — agora usa input de keyword

  const [savedToRadar, setSavedToRadar] = useState<Set<string>>(new Set())
  async function saveMinedToRadar(o: MineResult) {
    if (!userId || savedToRadar.has(o.pagina_nome)) return
    setSavedToRadar(prev => new Set(prev).add(o.pagina_nome))
    try {
      // Extract numeric page_id from ad_library_url if present
      const pageIdMatch = o.ad_library_url.match(/view_all_page_id=(\d+)/)
      const pageId = pageIdMatch?.[1]
      await fetch('/api/radar', { method: 'POST', headers: authHeaders(), body: JSON.stringify({
        pagina_nome: o.pagina_nome, ad_library_url: o.ad_library_url,
        landing_url: o.landing_url, nicho: o.nicho, snapshot_ads: o.total_anuncios,
        page_id: pageId,
      }) })
      showToast('Oferta adicionada ao Radar!')
      loadRadar().catch(() => {})
    } catch {
      setSavedToRadar(prev => { const n = new Set(prev); n.delete(o.pagina_nome); return n })
      showToast('Erro ao salvar', 'err')
    }
  }

  function openSavedAnalysis(a: SavedAnalysis) {
    setPhase1Report(a.phase1); setPhase2Report(a.phase2); setPhase2Screenshots(a.screenshots); setUrl(a.url); setShowReport(true)
  }

  const filteredOffers = trackedOffers.filter(o => {
    if (radarSearch) {
      const q = radarSearch.toLowerCase()
      if (!o.pagina_nome.toLowerCase().includes(q) && !o.ad_library_url.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Mutual exclusive: oferta só pode estar em escalando OU caindo OU estável, nunca em duas
  const countByStatus = {
    total: trackedOffers.length,
    escalando: trackedOffers.filter(o => {
      const ads = o.ultimo_snapshot_ads ?? 0
      const initial = o.primeiro_snapshot_ads ?? 0
      if (initial > 0 && ads > initial) return true
      // Se não tem snapshots ainda mas status do banco diz escalando
      return ads === 0 && initial === 0 && o.status === 'escalando'
    }).length,
    caindo: trackedOffers.filter(o => {
      const ads = o.ultimo_snapshot_ads ?? 0
      const initial = o.primeiro_snapshot_ads ?? 0
      if (initial > 0 && ads < initial) return true
      // Inclui mortas (0 ads atual, tinha antes)
      if (ads === 0 && initial > 0) return true
      return ads === 0 && initial === 0 && (o.status === 'caindo' || o.status === 'morta')
    }).length,
  }
  const lastUpdate = trackedOffers.reduce((latest, o) => {
    if (o.verificado_em && (!latest || o.verificado_em > latest)) return o.verificado_em
    return latest
  }, '' as string)

  const statusIcon = (s: string, alertas: number) => alertas > 0 ? '\uD83D\uDD34' : s === 'escalando' ? '\uD83D\uDFE0' : s === 'morta' ? '\u26AB' : '\uD83D\uDFE2'
  const statusLabel = (s: string, alertas: number) => alertas > 0 ? 'ALERTA' : s === 'escalando' ? 'ESCALANDO' : s === 'morta' ? 'MORTA' : s === 'caindo' ? 'CAINDO' : 'ESTAVEL'

  // ── RENDER ──
  if (showReport && phase1Report && phase2Report) {
    return (
      <>
        <style>{CSS}</style>
        <ReportView phase1={phase1Report} phase2={phase2Report} onBack={() => { setShowReport(false); setSavedModal(false); savingRef.current = false }} onSaveToRadar={saveToRadar} saving={savingRadar} />
        {savedModal && (
          <div className="modal-overlay" onClick={() => setSavedModal(false)}>
            <div className="saved-modal" onClick={e => e.stopPropagation()}>
              <div className="saved-check">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h3 className="saved-title">Oferta salva no Radar!</h3>
              <p className="saved-desc">Voc{'\u00EA'} ser{'\u00E1'} notificado quando houver mudan{'\u00E7'}as nos an{'\u00FA'}ncios.</p>
              <div className="saved-btns">
                <button className="saved-btn-outline" onClick={() => { setSavedModal(false); setShowReport(false); setActiveTab('rastreamento') }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  Ir pro Rastreamento
                </button>
                <button className="saved-btn-solid" onClick={() => setSavedModal(false)}>
                  Voltar pra An{'\u00E1'}lise
                </button>
              </div>
            </div>
          </div>
        )}
        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <div className="header-logo-circle" onClick={() => setActiveTab('home')}>
              <img src="/rato-mascot.png" alt="RatoAds" />
            </div>
          </div>
          <nav className="header-tabs">
            {[
              {
                id: 'ofertas' as Tab,
                label: 'Ofertas',
                svg: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                ),
              },
              {
                id: 'minerador' as Tab,
                label: 'Minera\u00e7\u00e3o',
                svg: (
                  <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{width:20,height:20}}><path d="M3 13 Q16 3 24 6 Q32 3 45 13 Q32 9 24 11 Q16 9 3 13 Z" fill="currentColor"/><rect x="22" y="10" width="4" height="32" rx="1.4" fill="currentColor"/><rect x="20.5" y="40" width="7" height="4" rx="1.5" fill="currentColor"/></svg>
                ),
              },
              {
                id: 'analise' as Tab,
                label: 'An\u00e1lise',
                svg: (
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:20,height:20}}><circle cx="19" cy="19" r="15" stroke="currentColor" strokeWidth="4.5"/><rect x="9" y="22" width="4" height="7" rx="1" fill="currentColor"/><rect x="15" y="18" width="4" height="11" rx="1" fill="currentColor"/><rect x="21" y="14" width="4" height="15" rx="1" fill="currentColor"/><line x1="30" y1="30" x2="44" y2="44" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round"/></svg>
                ),
              },
              {
                id: 'rastreamento' as Tab,
                label: 'Radar',
                svg: (
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:20,height:20}}><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round"/><circle cx="24" cy="18" r="6" stroke="currentColor" strokeWidth="3" fill="none"/><circle cx="24" cy="18" r="1.8" fill="currentColor"/></svg>
                ),
                badge: totalAlerts,
              },
            ].map(t => {
              const tooltips: Record<string, string> = {
                'minerador': 'Encontre ofertas escaladas por palavra-chave',
                'analise': 'Analise criativos, score e gere funil completo',
                'rastreamento': 'Acompanhe ofertas e varia\u00e7\u00f5es di\u00e1rias',
              }
              return (
                <button key={t.id} className={`header-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)} data-tooltip={tooltips[t.id]}>
                  <span className="tab-icon">{t.svg}</span>
                  <span className="tab-label">{t.label}</span>
                  {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
                </button>
              )
            })}
          </nav>
          <div className="header-right" ref={profileRef}>
            <div className="header-saldo">{plano === 'trial' ? 'Trial' : plano === 'premium' ? 'Premium' : 'Starter'}</div>
            <button className="header-avatar" onClick={() => setProfileOpen(o => !o)}>
              {userName ? userName[0].toUpperCase() : '?'}
            </button>
            {profileOpen && (
              <div className="profile-drop">
                <div className="profile-name">{userName}</div>
                <div className="profile-plan-badge" style={plano === 'trial' ? { background: 'rgba(16,185,129,.12)', color: '#10B981', borderColor: 'rgba(16,185,129,.25)' } : undefined}>{plano === 'trial' ? 'Trial' : plano === 'premium' ? 'Premium' : 'Starter'}</div>
                <div className="profile-quotas">
                  <div className="pq-row"><span className="pq-label">An{'\u00e1'}lises</span><span className="pq-val">{analises ?? 0}/{maxAnalises}</span></div>
                  <div className="pq-row"><span className="pq-label">Minera{'\u00e7\u00f5'}es</span><span className="pq-val">{mineracoes ?? 0}/{maxMineracoes}</span></div>
                  <div className="pq-row"><span className="pq-label">Slots Radar</span><span className="pq-val">{trackedOffers.length}/{maxSlots}</span></div>
                  {renovaEm && (
                    <div className="pq-row pq-renew"><span className="pq-label">Renova em</span><span className="pq-val">{Math.max(0, Math.ceil((new Date(renovaEm).getTime() - Date.now()) / 86400000))} dias</span></div>
                  )}
                </div>
                <a href="/settings/plans" className="profile-link">Gerenciar plano</a>
                <button className="profile-link" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}>Sair</button>
              </div>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main className="content">

          {/* TRIAL BANNER */}
          {plano === 'trial' && (() => {
            const diasRestantes = renovaEm ? Math.max(0, Math.ceil((new Date(renovaEm).getTime() - Date.now()) / 86400000)) : 30
            const usouAnalise = analises === 0
            const usouMineracao = mineracoes === 0
            const urgente = diasRestantes <= 7
            const expirado = diasRestantes === 0

            const msgs = expirado
              ? { title: 'Seu teste gratuito expirou', sub: 'Assine agora pra continuar minerando.', color: '#ef4444', bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.25)' }
              : urgente
              ? { title: `Faltam ${diasRestantes} dias pro seu teste acabar`, sub: 'Garanta seu plano antes de perder o acesso.', color: '#f59e0b', bg: 'rgba(245,158,11,.06)', border: 'rgba(245,158,11,.25)' }
              : usouMineracao
              ? { title: 'Suas minera\u00e7\u00f5es gratuitas acabaram', sub: 'Desbloqueie 10 minera\u00e7\u00f5es + 10 an\u00e1lises com o Starter.', color: '#f59e0b', bg: 'rgba(245,158,11,.06)', border: 'rgba(245,158,11,.25)' }
              : usouAnalise
              ? { title: 'Suas an\u00e1lises gratuitas acabaram', sub: 'Quer mais? O plano Starter d\u00e1 10x mais recursos.', color: '#f59e0b', bg: 'rgba(245,158,11,.06)', border: 'rgba(245,158,11,.25)' }
              : { title: `Voc\u00ea est\u00e1 no teste gr\u00e1tis \u2014 ${diasRestantes} dias restantes`, sub: 'Explore o RatoAds! Assine quando quiser pra desbloquear mais.', color: '#10B981', bg: 'rgba(16,185,129,.06)', border: 'rgba(16,185,129,.25)' }

            return (
              <div style={{
                margin: '0 auto 0', maxWidth: 1000, padding: '0 32px',
              }}>
                <div style={{
                  background: msgs.bg, border: `1px solid ${msgs.border}`,
                  borderRadius: 12, padding: '16px 24px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 16, flexWrap: 'wrap', marginTop: 20,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: msgs.color, marginBottom: 2 }}>{msgs.title}</div>
                    <div style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>{msgs.sub}</div>
                  </div>
                  <a href="/settings/plans" style={{
                    background: msgs.color, color: '#fff', padding: '10px 20px',
                    borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {expirado ? 'Assinar agora' : 'Ver planos'}
                  </a>
                </div>
              </div>
            )
          })()}

          {/* ── HOME ── */}
          {activeTab === 'home' && (
            <div className="tab-content">
              <div className="home-wrap">
                <div className="home-header">
                  <h1 className="home-title">Seu fluxo de trabalho</h1>
                  <p className="home-sub">Siga o caminho abaixo pra encontrar, analisar e rastrear ofertas lucrativas.</p>
                </div>
                <div className="home-path">
                  {[
                    { id: 'ofertas' as Tab, n: 'OFERTAS', t: 'Feed de Ofertas', d: 'Ofertas mineradas automaticamente 24h. Navegue, filtre e encontre oportunidades prontas.', cta: 'Explorar',
                      icon: <svg viewBox="0 0 24 24" fill="none" stroke="#FF8C00" strokeWidth="1.8" style={{width:22,height:22}}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
                    { id: 'minerador' as Tab, n: 'PASSO 01', t: 'Minera\u00e7\u00e3o Autom\u00e1tica', d: 'Busque por palavra-chave espec\u00edfica e encontre ofertas escaladas do nicho.', cta: 'Minerar',
                      icon: <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{width:22,height:22}}><path d="M3 13 Q16 3 24 6 Q32 3 45 13 Q32 9 24 11 Q16 9 3 13 Z" fill="#FF8C00"/><rect x="22" y="10" width="4" height="32" rx="1.4" fill="#FF8C00"/><rect x="20.5" y="40" width="7" height="4" rx="1.5" fill="#FF8C00"/></svg> },
                    { id: 'analise' as Tab, n: 'PASSO 02', t: 'An\u00e1lise Completa', d: 'Score de 1 a 10, transcri\u00e7\u00e3o dos criativos mais escalados, scripts de CTV e prompt pra clonar a p\u00e1gina.', cta: 'Analisar',
                      icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:22,height:22}}><circle cx="19" cy="19" r="15" fill="rgba(255,140,0,.08)"/><circle cx="19" cy="19" r="15" stroke="#FF8C00" strokeWidth="4.5"/><rect x="9" y="22" width="4" height="7" rx="1" fill="#FF8C00"/><rect x="15" y="18" width="4" height="11" rx="1" fill="#FF8C00"/><rect x="21" y="14" width="4" height="15" rx="1" fill="#FF8C00"/><polyline points="11,21 17,17 23,13 27,15" stroke="#FFB347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/><line x1="30" y1="30" x2="44" y2="44" stroke="#FF8C00" strokeWidth="5.5" strokeLinecap="round"/></svg> },
                    { id: 'rastreamento' as Tab, n: 'PASSO 03', t: 'Rastreamento da oferta', d: 'Adicione no rastreamento e acompanhe em tempo real os ads ativos e como eles variam diariamente.', cta: 'Ver radar',
                      icon: <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:22,height:22}}><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" fill="rgba(255,140,0,.08)"/><path d="M24 4c-7.7 0-14 6.1-14 13.6 0 9.9 12.3 22.6 13.1 23.4a1.3 1.3 0 0 0 1.8 0c.8-.8 13.1-13.5 13.1-23.4C38 10.1 31.7 4 24 4Z" stroke="#FF8C00" strokeWidth="4.5" strokeLinejoin="round"/><circle cx="24" cy="18" r="6" stroke="#FF8C00" strokeWidth="3" fill="none"/><line x1="24" y1="9" x2="24" y2="13" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="24" y1="23" x2="24" y2="27" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="15" y1="18" x2="19" y2="18" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><line x1="29" y1="18" x2="33" y2="18" stroke="#FFB347" strokeWidth="2.5" strokeLinecap="round"/><circle cx="24" cy="18" r="1.8" fill="#FF8C00"/></svg> },
                  ].map(s => (
                    <div key={s.id} className="home-step" onClick={() => setActiveTab(s.id)}>
                      <div className="home-step-num">{s.n}</div>
                      <div className="home-step-dot" />
                      <div className="home-step-icon">{s.icon}</div>
                      <h3 className="home-step-title">{s.t}</h3>
                      <p className="home-step-desc">{s.d}</p>
                      <span className="home-step-cta">{s.cta} {'\u2192'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ABA OFERTAS ── */}
          {activeTab === 'ofertas' && (
            <div className="tab-content rdr-full" style={{ maxWidth: '100%' }}>
              {/* Search bar — full width */}
              <div className="of-searchbar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input className="of-search-input" placeholder="Buscar oferta..." value={feedSearch} onChange={e => setFeedSearch(e.target.value)} />
                <div className="of-search-actions">
                  <img src="https://flagcdn.com/w40/br.png" alt="BR" className="of-flag-active" title="Brasil" />
                  <select className="of-sort-btn" value={feedSort} onChange={e => setFeedSort(e.target.value as typeof feedSort)}>
                    <option value="ad_count">Mais an{'\u00fa'}ncios</option>
                    <option value="dias_rodando">Mais tempo</option>
                    <option value="last_seen">Mais recentes</option>
                  </select>
                  <button className="of-filter-toggle" onClick={() => setFeedFilterOpen(p => !p)} title="Filtros">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  </button>
                </div>
              </div>

              <div className="of-layout">
                {/* Grid */}
                <div className="of-grid-area">
                  {feedLoading && feedOffers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>Carregando ofertas...</div>
                  )}
                  {!feedLoading && feedOffers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>
                      <p style={{ fontSize: 16, marginBottom: 8 }}>Nenhuma oferta minerada ainda</p>
                      <p style={{ fontSize: 13 }}>O minerador autom{'\u00e1'}tico roda 24h. As ofertas v{'\u00e3'}o aparecer aqui conforme forem encontradas.</p>
                    </div>
                  )}
                  {feedOffers.length > 0 && (() => {
                    // Compute structure per offer + filter
                    const getStructure = (o: FeedOffer) => {
                      // Detect by landing URL patterns + creative types
                      const land = (o.landing_url || '').toLowerCase()
                      if (land.includes('quiz') || land.includes('typeform') || land.includes('bucket')) return 'Quiz'
                      try {
                        const urls: string[] = o.creative_urls ? JSON.parse(o.creative_urls) : []
                        const hasVid = urls.some(u => u.includes('.mp4') || u.includes('video_hd') || u.includes('video_sd'))
                        if (hasVid) return 'VSL'
                      } catch { /* */ }
                      return 'P\u00e1gina de vendas'
                    }
                    const filtered = feedEstrutura.length === 0 ? feedOffers : feedOffers.filter(o => feedEstrutura.includes(getStructure(o)))
                    return (
                    <>
                      <div className="of-grid">
                        {filtered.map(o => {
                          const struct = getStructure(o)
                          const hasVid = struct === 'VSL'
                          return (
                            <div key={o.id} className="of-card" onClick={() => { setFeedDetail(o); setFdTranscriptExpanded(false); setFdShowAllCreatives(false) }}>
                              <div className="of-card-img">
                                {o.thumbnail_url ? (
                                  <img src={o.thumbnail_url} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                ) : o.landing_screenshot ? (
                                  <img src={o.landing_screenshot} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                ) : (
                                  <div className="of-card-placeholder">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                  </div>
                                )}
                                {/* Play badge for video offers */}
                                {hasVid && <div className="of-card-play"><svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>}
                                {/* Bookmark */}
                                <button className="of-card-bm" onClick={e => { e.stopPropagation(); saveMinedToRadar({ pagina_nome: o.page_name, ad_library_url: /^\d+$/.test(o.page_id) ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${o.page_id}` : '', landing_url: o.landing_url, total_anuncios: o.ad_count, dias_rodando: o.dias_rodando, score_escalabilidade: 0, nicho: o.nicho || '' }) }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                                </button>
                              </div>
                              <div className="of-card-body">
                                <div className="of-card-name">{o.page_name}</div>
                                <div className="of-card-footer">
                                  <div className="of-card-ads">{o.ad_count}<span>Ads</span></div>
                                  <img className="of-card-flag" src="https://flagcdn.com/w40/br.png" alt="BR" />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {feedOffers.length < feedTotal && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                          <button className="fd-btn-more" onClick={() => loadFeed(false)} disabled={feedLoading}>
                            {feedLoading ? 'Carregando...' : `Ver mais (${feedTotal - feedOffers.length} restantes)`}
                          </button>
                        </div>
                      )}
                    </>
                    )
                  })()}
                </div>

                {/* Sidebar filters */}
                {feedFilterOpen && (
                  <div className="of-sidebar">
                    <div className="of-sidebar-inner">
                      <div className="of-sb-hd">
                        <span>Filtros</span>
                        <button className="of-sb-close" onClick={() => setFeedFilterOpen(false)}>{'\u00d7'}</button>
                      </div>

                      {/* Estrutura */}
                      <div className="of-sb-section">
                        <div className="of-sb-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg> Estrutura</div>
                        {['VSL', 'P\u00e1gina de vendas', 'Quiz'].map(e => (
                          <label key={e} className="of-sb-check">
                            <input type="checkbox" checked={feedEstrutura.includes(e)} onChange={() => setFeedEstrutura(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])} />
                            <span>{e}</span>
                          </label>
                        ))}
                      </div>

                      {/* Nichos */}
                      <div className="of-sb-section">
                        <div className="of-sb-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Nichos</div>
                        {['', 'emagrecimento', 'renda extra', 'packs', 'educa\u00e7\u00e3o', 'beleza', 'pets', 'sa\u00fade', 'relacionamento'].map(n => (
                          <label key={n} className="of-sb-check">
                            <input type="radio" name="nicho" checked={feedNicho === n} onChange={() => setFeedNicho(n)} />
                            <span>{n || 'Todos'}</span>
                          </label>
                        ))}
                      </div>

                      {/* Sort */}
                      <div className="of-sb-section">
                        <div className="of-sb-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg> Ordenar por</div>
                        {([['ad_count', 'Mais an\u00fancios'], ['dias_rodando', 'Mais tempo rodando'], ['last_seen', 'Mais recentes']] as const).map(([v, l]) => (
                          <label key={v} className="of-sb-check">
                            <input type="radio" name="sort" checked={feedSort === v} onChange={() => setFeedSort(v as typeof feedSort)} />
                            <span>{l}</span>
                          </label>
                        ))}
                      </div>

                      <div className="of-sb-total">{feedTotal} ofertas encontradas</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail full page — AdSpy style */}
              {feedDetail && (() => {
                const adLibUrl = /^\d+$/.test(feedDetail.page_id)
                  ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&view_all_page_id=${feedDetail.page_id}`
                  : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(feedDetail.page_name)}&search_type=keyword_exact_phrase`
                const rawCreatives: string[] = feedDetail.creative_urls ? (() => { try { return JSON.parse(feedDetail.creative_urls) } catch { return [] } })() : []
                // Deduplicate and filter out preview thumbnails (video_preview_image_url pattern)
                const creatives = [...new Set(rawCreatives)].filter(u => !u.includes('video_preview_image'))
                const adCopies: { text: string; format: string; date: string }[] = (feedDetail as unknown as Record<string, string>).ad_copies ? (() => { try { return JSON.parse((feedDetail as unknown as Record<string, string>).ad_copies) } catch { return [] } })() : []
                const isVideo = (u: string) => u.includes('.mp4') || u.includes('video_hd') || u.includes('video_sd') || u.includes('/v/')
                const videoCount = creatives.filter(isVideo).length
                const imageCount = creatives.length - videoCount
                const CREATIVES_INITIAL = 8
                return (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg)', overflowY: 'auto' }}>
                    <div className="fd">
                      {/* Top bar */}
                      <button className="fd-back" onClick={() => setFeedDetail(null)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        Voltar
                      </button>

                      <div className="fd-breadcrumb">Ofertas / <span>{feedDetail.page_name}</span></div>
                      <h2 className="fd-title">{feedDetail.page_name}</h2>

                      {/* ═══ TOP: Preview + Sidebar ═══ */}
                      <div className="fd-top">
                        <div className="fd-main-area">
                          {/* Landing page preview */}
                          {feedDetail.landing_screenshot && (
                            <div className="fd-hero-wrap">
                              <img src={feedDetail.landing_screenshot} alt="Landing page" className="fd-hero-img" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                            </div>
                          )}
                          <div className="fd-action-bar">
                            <button className="fd-btn-analyze" onClick={() => {
                              setUrl(adLibUrl); setFeedDetail(null); setActiveTab('analise')
                              setTimeout(() => handleAnalyze(undefined, adLibUrl), 300)
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                              Analisar oferta completa
                            </button>
                            {feedDetail.landing_url && (
                              <a className="fd-btn-dl" href={feedDetail.landing_url} target="_blank" rel="noopener noreferrer">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                Ver Landing Page
                              </a>
                            )}
                            <div className="fd-stats-pills">
                              {videoCount > 0 && <span className="fd-pill fd-pill-vid">{videoCount} v{'\u00ed'}deo{videoCount > 1 ? 's' : ''}</span>}
                              {imageCount > 0 && <span className="fd-pill fd-pill-img">{imageCount} imag{imageCount > 1 ? 'ens' : 'em'}</span>}
                              <span className="fd-pill">{feedDetail.ad_count} an{'\u00fa'}ncios</span>
                            </div>
                          </div>
                        </div>

                        {/* Sidebar — golden accent */}
                        <div className="fd-sidebar">
                          <div className="fd-sidebar-card">
                            <div className="fd-sidebar-hd">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                              Informa{'\u00e7\u00f5'}es
                            </div>
                            <div className="fd-sidebar-rows">
                              <div className="fd-row"><span>Rede</span><span>FACEBOOK</span></div>
                              <div className="fd-row"><span>Estrutura</span><span>{(() => { const land = (feedDetail.landing_url || '').toLowerCase(); if (land.includes('quiz') || land.includes('typeform') || land.includes('bucket')) return 'Quiz'; return videoCount > 0 ? 'VSL' : 'P\u00e1gina de vendas' })()}</span></div>
                              <div className="fd-row"><span>Idioma</span><span>PT_BR</span></div>
                              <div className="fd-row"><span>Tipo</span><span>Low Ticket</span></div>
                              {feedDetail.nicho && <div className="fd-row"><span>Nicho</span><span style={{ textTransform: 'capitalize' }}>{feedDetail.nicho}</span></div>}
                              <div className="fd-row"><span>Pa{'\u00eds'}</span><span>Brasil</span></div>
                              <div className="fd-row"><span>Primeira vez</span><span>{new Date(feedDetail.first_seen).toLocaleDateString('pt-BR')}</span></div>
                              {feedDetail.dias_rodando !== null && <div className="fd-row"><span>Dias rodando</span><span>{feedDetail.dias_rodando}d</span></div>}
                            </div>
                          </div>
                          <div className="fd-sidebar-card">
                            <div className="fd-sidebar-hd">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                              M{'\u00e9'}tricas
                            </div>
                            <div className="fd-sidebar-rows">
                              <div className="fd-row"><span>Qtd. An{'\u00fa'}ncios</span><span className="fd-row-accent">{feedDetail.ad_count}</span></div>
                              <div className="fd-row"><span>Criativos</span><span>{creatives.length}</span></div>
                              {feedDetail.ig_followers != null && feedDetail.ig_followers > 0 && <div className="fd-row"><span>IG Seguidores</span><span>{feedDetail.ig_followers.toLocaleString('pt-BR')}</span></div>}
                              {feedDetail.ig_handle && <div className="fd-row"><span>Instagram</span><span className="fd-row-accent">@{feedDetail.ig_handle.replace(/^@/, '')}</span></div>}
                              {feedDetail.fb_followers != null && feedDetail.fb_followers > 0 && <div className="fd-row"><span>FB Seguidores</span><span>{feedDetail.fb_followers.toLocaleString('pt-BR')}</span></div>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ═══ TRANSCRIÇÃO ═══ */}
                      {adCopies.length > 0 && (() => {
                        const fullText = adCopies.map((c, i) => `[Criativo ${i+1}] ${c.format} | ${c.date}\n${c.text}`).join('\n\n---\n\n')
                        const preview = adCopies[0]?.text || ''
                        return (
                          <div className="fd-section">
                            <div className="fd-section-hd">
                              <div className="fd-section-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Transcri{'\u00e7\u00e3'}o
                              </div>
                              <button className="fd-btn-sm" onClick={() => {
                                const blob = new Blob([fullText], { type: 'text/plain' })
                                const u = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = u; a.download = `${feedDetail.page_name}-transcricao.txt`; a.click()
                                URL.revokeObjectURL(u)
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Baixar transcri{'\u00e7\u00e3'}o
                              </button>
                            </div>
                            <div className="fd-transcript-box">
                              <div className={`fd-transcript-text${fdTranscriptExpanded ? ' expanded' : ''}`}>
                                {fdTranscriptExpanded ? fullText : preview}
                              </div>
                              {adCopies.length > 1 && (
                                <button className="fd-transcript-toggle" onClick={() => setFdTranscriptExpanded(e => !e)}>
                                  {fdTranscriptExpanded ? 'Mostrar menos' : `Ler mais (${adCopies.length} criativos)`}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* ═══ CRIATIVOS — grid 4 colunas ═══ */}
                      {creatives.length > 0 && (() => {
                        const visible = fdShowAllCreatives ? creatives : creatives.slice(0, CREATIVES_INITIAL)
                        const remaining = creatives.length - CREATIVES_INITIAL
                        return (
                          <div className="fd-section">
                            <div className="fd-section-hd">
                              <div className="fd-section-title">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                Criativos
                              </div>
                              <span className="fd-section-count">{creatives.length} criativos</span>
                            </div>
                            <div className="fd-creatives-grid">
                              {visible.map((url, i) => {
                                const isVid = isVideo(url)
                                const adCopy = adCopies[i]
                                const hideCard = (el: HTMLElement | null) => { const card = el?.closest('.fd-creative-card') as HTMLElement; if (card) card.style.display = 'none' }
                                return (
                                  <div key={url} className="fd-creative-card">
                                    <div className="fd-creative-media">
                                      {isVid ? (
                                        <video
                                          src={url} controls preload="metadata"
                                          onError={e => hideCard(e.target as HTMLElement)}
                                          onStalled={e => { setTimeout(() => { const v = e.target as HTMLVideoElement; if (v.readyState === 0) hideCard(v) }, 3000) }}
                                        />
                                      ) : (
                                        <img src={url} alt="" onError={e => hideCard(e.target as HTMLElement)} />
                                      )}
                                      <a href={url} download target="_blank" rel="noopener noreferrer" className="fd-creative-dl">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                      </a>
                                      {isVid && <div className="fd-creative-type-badge">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                      </div>}
                                    </div>
                                    <div className="fd-creative-info">
                                      <div className="fd-creative-name">{isVid ? 'V\u00eddeo' : 'Imagem'} {i + 1}</div>
                                      <div className="fd-creative-tags">
                                        <span className="fd-tag">PT_BR</span>
                                        <span className="fd-tag">FACEBOOK</span>
                                        {isVid ? <span className="fd-tag fd-tag-vid">V{'\u00ed'}deo</span> : <span className="fd-tag fd-tag-img">Imagem</span>}
                                        <span className="fd-tag fd-tag-active">Ativo</span>
                                      </div>
                                      {adCopy?.date && <div className="fd-creative-date">{adCopy.date}</div>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {remaining > 0 && !fdShowAllCreatives && (
                              <div style={{ textAlign: 'center', marginTop: 16 }}>
                                <button className="fd-btn-more" onClick={() => setFdShowAllCreatives(true)}>
                                  Ver mais criativos ({remaining} restantes)
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ═══ PÁGINAS ═══ */}
                      <div className="fd-section">
                        <div className="fd-section-hd">
                          <div className="fd-section-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            P{'\u00e1'}ginas
                          </div>
                        </div>
                        <div className="fd-pages-grid">
                          {/* Site Principal */}
                          {feedDetail.landing_url && (
                            <div className="fd-page-card">
                              <div className="fd-page-screenshot">
                                {feedDetail.landing_screenshot ? (
                                  <img src={feedDetail.landing_screenshot} alt="Landing page" />
                                ) : (
                                  <div className="fd-page-placeholder">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><circle cx="7.5" cy="6" r=".5"/><circle cx="10" cy="6" r=".5"/></svg>
                                  </div>
                                )}
                              </div>
                              <div className="fd-page-info">
                                <div className="fd-page-label">Site Principal</div>
                                <code className="fd-page-url">{feedDetail.landing_url}</code>
                                <div className="fd-page-actions">
                                  <button className="fd-btn-sm" onClick={() => navigator.clipboard.writeText(feedDetail.landing_url || '')}>Copiar</button>
                                  <a className="fd-btn-sm" href={feedDetail.landing_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Abrir</a>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Facebook Ad Library */}
                          <div className="fd-page-card">
                            <div className="fd-page-screenshot">
                              <div className="fd-page-placeholder fd-page-fb">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                                <span className="fd-page-badge">{feedDetail.ad_count} An{'\u00fa'}ncios</span>
                              </div>
                            </div>
                            <div className="fd-page-info">
                              <div className="fd-page-label">Biblioteca de An{'\u00fa'}ncios</div>
                              <code className="fd-page-url">{adLibUrl}</code>
                              <div className="fd-page-actions">
                                <button className="fd-btn-sm" onClick={() => navigator.clipboard.writeText(adLibUrl)}>Copiar</button>
                                <a className="fd-btn-sm" href={adLibUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Abrir</a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── ABA ANALISE ── */}
          {activeTab === 'analise' && (
            <div className="tab-content">
              <div className="analyze-hero">
                <div className="tool-sec-label"><span>Intelig{'\u00ea'}ncia competitiva</span></div>
                <h1 className="analyze-title">Analise de <span className="acc">Biblioteca</span></h1>
                <p className="analyze-sub">Descubra pontos fracos, modele criativos e gere funis em segundos</p>
                <form onSubmit={handleAnalyze} className="analyze-form">
                  <div className="analyze-input-wrap">
                    <svg className="analyze-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input className="analyze-input" type="url" placeholder="Cole o link da biblioteca de anúncios do concorrente..." value={url} onChange={e => setUrl(e.target.value)} />
                  </div>
                  <button className="analyze-btn" type="submit" disabled={analyzing || !url.trim()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    {analyzing ? 'Analisando...' : 'Analisar'}
                  </button>
                </form>
              </div>

              {/* Stats cards */}
              <div className="stats-row">
                <div className="stat-card">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,107,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  </div>
                  <div>
                    <div className="stat-num">{savedAnalyses.length}</div>
                    <div className="stat-label">An{'\u00e1'}lises realizadas</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,107,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <div>
                    <div className="stat-num">{trackedOffers.length}</div>
                    <div className="stat-label">Ofertas rastreadas</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,107,0,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                  </div>
                  <div>
                    <div className="stat-num">{analises ?? '\u2014'}</div>
                    <div className="stat-label">An{'\u00e1'}lises restantes</div>
                  </div>
                </div>
              </div>

              {/* Rat Mascot + Loading */}
              <RatMascot isAnalyzing={analyzing} />
              {analyzing && (
                <div className="status-bar-wrap">
                  <div className="status-track"><div className="status-fill" style={{ width: `${dashProgress}%` }} /></div>
                  <div className="status-text">
                    <span className="st-pulse" />
                    <span>{termLines.length > 0 ? termLines[termLines.length - 1].text.replace(/^> /, '').replace(/^\u2713 /, '') : 'Iniciando analise...'}</span>
                  </div>
                </div>
              )}
              {!analyzing && error && <div className="err" style={{ maxWidth: 680, margin: '0 auto 24px' }}>{error}</div>}

              {/* History */}
              {!analyzing && savedAnalyses.length > 0 && (
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                  <div className="sec-hd"><h2>Ultimas analises</h2><span className="sec-count">{savedAnalyses.length}</span></div>
                  <div className="history-grid">
                    {savedAnalyses.slice(0, 8).map(a => {
                      const cls = a.score >= 7 ? 'green' : a.score >= 5 ? 'yellow' : 'red'
                      return (
                        <div key={a.id} className="history-card">
                          <div className={`hc-score ${cls}`} onClick={() => openSavedAnalysis(a)}>{a.score || '?'}</div>
                          <div className="hc-info" onClick={() => openSavedAnalysis(a)} style={{ cursor: 'pointer' }}>
                            <div className="hc-name">{(a.phase1.pagina_nome as string) || a.url?.replace(/^https?:\/\//, '').split('/')[0] || a.name}</div>
                            <div className="hc-meta">{timeAgo(a.createdAt)} &middot; {new Date(a.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                          </div>
                          <button className="hc-btn" onClick={() => openSavedAnalysis(a)}>Ver relatorio</button>
                          <button className="hc-del" onClick={() => { const updated = savedAnalyses.filter(x => x.id !== a.id); setSavedAnalyses(updated); localStorage.setItem('cc_analyses', JSON.stringify(updated)) }} title="Excluir">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!analyzing && savedAnalyses.length === 0 && !error && (
                <div className="analysis-explainer">
                  <div className="explainer-title">O que voc{'\u00ea'} recebe ao analisar</div>
                  <div className="explainer-subtitle">Cole o link da biblioteca de an{'\u00FA'}ncios de qualquer concorrente e receba em segundos:</div>
                  <div className="explainer-grid">
                    <div className="explainer-card">
                      <div className="explainer-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                      </div>
                      <div className="explainer-card-title">Score 0-10</div>
                      <div className="explainer-card-desc">Nota baseada em volume, tempo e presen{'\u00e7'}a de expert</div>
                    </div>
                    <div className="explainer-card">
                      <div className="explainer-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                      </div>
                      <div className="explainer-card-title">Top 6 criativos</div>
                      <div className="explainer-card-desc">Os criativos mais escalados com transcri{'\u00e7\u00e3'}o completa</div>
                    </div>
                    <div className="explainer-card">
                      <div className="explainer-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                      </div>
                      <div className="explainer-card-title">3 scripts de CTV</div>
                      <div className="explainer-card-desc">Roteiros prontos com hook, corpo e CTA</div>
                    </div>
                    <div className="explainer-card">
                      <div className="explainer-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m7.5 4.27 9 5.15"/><path d="M3.29 7 12 12l8.71-5"/><path d="M12 22V12"/></svg>
                      </div>
                      <div className="explainer-card-title">Prompt Lovable</div>
                      <div className="explainer-card-desc">Prompt com m{'\u00ed'}dias reais pra clonar a p{'\u00e1'}gina</div>
                    </div>
                  </div>
                  <div className="explainer-tip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    <span>Dica: minere uma oferta e clique em <strong>&ldquo;Ver pontos fracos + scripts&rdquo;</strong> pra analisar direto</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ABA RASTREAMENTO ── */}
          {activeTab === 'rastreamento' && (
            <div className="tab-content rdr-full">
              {/* Header */}
              <div className="rdr-header">
                <div className="rdr-search-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input className="rdr-search" placeholder="Buscar por nome ou URL..." value={radarSearch} onChange={e => setRadarSearch(e.target.value)} />
                </div>
              </div>

              {/* Banner removido — info de atualização fica nos cards */}

              {/* 4 Metric cards */}
              <div className="rdr-metrics">
                <div className="rdr-mc"><div className="rdr-mc-row"><span className="rdr-mc-label">Total de Ofertas</span><div className="rdr-mc-ic" style={{ background: 'rgba(255,107,0,.1)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div></div><div className="rdr-mc-val">{countByStatus.total}</div></div>
                <div className="rdr-mc"><div className="rdr-mc-row"><span className="rdr-mc-label">Ofertas em Progress&atilde;o</span><div className="rdr-mc-ic" style={{ background: 'rgba(16,185,129,.1)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div></div><div className="rdr-mc-val" style={{ color: '#10B981' }}>{countByStatus.escalando}</div></div>
                <div className="rdr-mc"><div className="rdr-mc-row"><span className="rdr-mc-label">Ofertas em Regress&atilde;o</span><div className="rdr-mc-ic" style={{ background: 'rgba(239,68,68,.1)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg></div></div><div className="rdr-mc-val" style={{ color: '#EF4444' }}>{countByStatus.caindo}</div></div>
                <div className="rdr-mc"><div className="rdr-mc-row"><span className="rdr-mc-label">&Uacute;ltima Atualiza&ccedil;&atilde;o</span><div className="rdr-mc-ic" style={{ background: 'rgba(139,92,246,.1)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></div></div><div className="rdr-mc-val">{(() => { const d = lastUpdate || trackedOffers[0]?.criado_em; return d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--' })()}</div></div>
              </div>

              {/* Offer cards — 4 column grid */}
              {filteredOffers.length > 0 ? (
                <div className="rdr-grid">
                  {filteredOffers.map(o => {
                    const ads = o.ultimo_snapshot_ads ?? o.primeiro_snapshot_ads ?? 0
                    const initial = o.primeiro_snapshot_ads ?? 0
                    const diff = ads - initial
                    const pct = initial > 0 ? ((diff / initial) * 100).toFixed(1) : '0.0'
                    const pctNum = parseFloat(pct)
                    return (
                      <div key={o.id} className="rc">
                        <div className="rc-hd">
                          <div className="rc-fb"><svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></div>
                          <div className="rc-hd-info"><div className="rc-name">{o.pagina_nome}</div><a href={o.ad_library_url} target="_blank" rel="noopener noreferrer" className="rc-url" onClick={e => e.stopPropagation()}>{o.ad_library_url.replace(/^https?:\/\//, '').slice(0, 38)}...</a></div>
                        </div>
                        <button className="rc-del" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(o.id) }} title="Remover">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        </button>
                        <div className="rc-mets">
                          <div className="rc-met"><div className="rc-met-lbl">Total Hoje:</div><div className="rc-met-num">{ads}</div><span className={`rc-met-badge ${pctNum > 0 ? 'up' : pctNum < 0 ? 'dn' : 'flat'}`}>{pctNum > 0 ? '+' : ''}{pct}% de varia&ccedil;&atilde;o</span></div>
                          <div className="rc-met"><div className="rc-met-lbl">Primeiro registro:</div><div className="rc-met-num">{initial}</div><span className="rc-met-date">{new Date(o.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span></div>
                        </div>
                        <div className="rc-vars">
                          <div className="rc-var"><span className="rc-var-l">Varia&ccedil;&atilde;o di&aacute;ria:</span><span className={`rc-var-v${diff > 0 ? ' up' : diff < 0 ? ' dn' : ''}`}>{diff !== 0 ? (diff > 0 ? '+' : '') + diff : '0'} an&uacute;ncios <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={diff >= 0 ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'}/></svg></span></div>
                          <div className="rc-var"><span className="rc-var-l">Varia&ccedil;&atilde;o semanal:</span><span className={`rc-var-v${diff > 0 ? ' up' : diff < 0 ? ' dn' : ''}`}>{diff !== 0 ? (diff > 0 ? '+' : '') + diff : '0'} an&uacute;ncios <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={diff >= 0 ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'}/></svg></span></div>
                        </div>
                        <div className="rc-acts">
                          <button className="rc-hist-btn" onClick={() => viewHistory(o)} style={{ flex: 1 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            Ver Hist&oacute;rico
                          </button>
                        </div>
                        <div className="rc-next-update" style={{ marginTop: 10, fontSize: 11, color: '#6B7280', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Pr&oacute;xima atualiza&ccedil;&atilde;o: {nextUpdateLabel()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">{radarSearch ? 'Nenhuma oferta encontrada.' : 'Nenhuma oferta no radar. Analise uma oferta e clique em "Salvar no Radar".'}</div>
              )}
            </div>
          )}

          {/* ── ABA MINERADOR ── */}
          {activeTab === 'minerador' && (
            <div className="tab-content">
              <div className="mine-hero">
                <div className="tool-sec-label"><span>Descoberta de ofertas</span></div>
                <h1 className="mine-title">Minerador <span className="acc">Autom{'\u00E1'}tico</span></h1>
                <p className="mine-sub">Encontre ofertas validadas no seu nicho em segundos</p>
              </div>

              <div className="mine-filters">
                <div className="rpt-card-lbl" style={{ marginBottom: 10 }}>PALAVRA-CHAVE</div>
                <input
                  type="text"
                  className="mine-keyword-input"
                  placeholder="Ex: emagrecer r&#225;pido, renda extra, tarot..."
                  value={mineKeyword}
                  onChange={e => setMineKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && mineKeyword.trim() && !mining) handleMine() }}
                  disabled={mining}
                  style={{ width: '100%', padding: '12px 16px', fontSize: 15, borderRadius: 8, border: '1px solid #444', background: '#1a1a1a', color: '#fff', marginBottom: 20, outline: 'none' }}
                />
                <p style={{ color: '#888', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>Filtros inteligentes: <span style={{ color: '#e8a040' }}>3+ dias rodando</span>, sem marcas grandes e sem redes sociais como landing.</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                  <button className="mine-btn" onClick={handleMine} disabled={!mineKeyword.trim() || mining}>
                    {mining ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Minerando...</> : <>{'\u26CF\uFE0F'} Minerar Agora</>}
                  </button>
                </div>
                {mineError && <div className="err" style={{ marginTop: 12 }}>{mineError}</div>}
              </div>

              {/* Rat mascot */}
              <RatMascot isAnalyzing={mining} />
              {mining && mineStatus && (
                <div className="status-bar-wrap">
                  <div className="status-track"><div className="status-fill" style={{ width: '60%' }} /></div>
                  <div className="status-text"><span className="st-pulse" /><span>{mineStatus}</span></div>
                </div>
              )}
              {!mining && mineResults.length === 0 && !mineError && <div className="mine-hint">Digite uma palavra-chave e clique em Minerar</div>}

              {/* Results */}
              {mineResults.length > 0 && (
                <div className="mine-results-wrap">
                  <div className="sec-hd"><h2>{mineResults.length} ofertas encontradas</h2></div>
                  <div className="mine-results">
                    {mineResults.map((o, i) => {
                      const sc = o.score_escalabilidade ?? (o as unknown as Record<string, number>).score ?? 0
                      const cls = sc >= 7 ? 'green' : sc >= 5 ? 'yellow' : 'red'
                      return (
                        <div key={i} className="mrc">
                          <div className="mrc-top">
                            <div className={`mrc-score ${cls}`}>{sc}</div>
                            {(() => {
                              const pageIdMatch = o.ad_library_url.match(/view_all_page_id=(\d+)/)
                              const fbPageId = pageIdMatch?.[1]
                              return fbPageId ? (
                                <div className="mrc-preview">
                                  <img
                                    src={`https://graph.facebook.com/${fbPageId}/picture?type=large`}
                                    alt=""
                                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                                  />
                                </div>
                              ) : null
                            })()}
                            <div className="mrc-info">
                              <div className="mrc-name">{o.pagina_nome}</div>
                              <div className="mrc-meta">{o.dias_rodando !== null ? `${o.dias_rodando} dias rodando` : 'Tempo indeterminado'}{o.total_anuncios > 1 ? ` \u00B7 ${o.total_anuncios} ads encontrados` : ''}</div>
                            </div>
                            {o.nicho && <span className="mrc-nicho">{o.nicho}</span>}
                          </div>
                          {o.resumo_angulo && <div className="mrc-angle">{o.resumo_angulo}</div>}
                          <div className="mrc-acts">
                            <button className="mrc-btn-orange" onClick={() => { setUrl(o.ad_library_url); setActiveTab('analise'); setTimeout(() => handleAnalyze(undefined, o.ad_library_url), 150) }} style={{ cursor: 'pointer', border: 'none' }}>Modelar funil e criativos</button>
                            <a className="mrc-btn-outline" href={o.ad_library_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>Ver Biblioteca</a>
                            <button className="mrc-btn-outline" onClick={() => saveMinedToRadar(o)} disabled={savedToRadar.has(o.pagina_nome)} style={savedToRadar.has(o.pagina_nome) ? { opacity: 0.5, cursor: 'default' } : {}}>{savedToRadar.has(o.pagina_nome) ? 'Salvo' : '+ Radar'}</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}

      {/* History full-page view */}
      {historyView && (
        <div className="modal-overlay" onClick={() => setHistoryView(null)}>
          <div className="hist-page" onClick={e => e.stopPropagation()}>
            {/* Breadcrumb */}
            <div className="hist-bread">
              <button className="hist-back" onClick={() => setHistoryView(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="hist-bread-txt">Rastreamento de Ofertas / <span style={{ color: '#FF6B00' }}>{historyView.offer.pagina_nome}</span></span>
            </div>

            <h2 className="hist-title">Hist&oacute;rico de M&eacute;tricas</h2>
            <p className="hist-sub">{historyView.offer.pagina_nome}</p>

            {/* 3 metric cards */}
            <div className="hist-mets">
              <div className="hist-met"><div className="hist-met-lbl">Total Hoje</div><div className="hist-met-num">{historyView.offer.ultimo_snapshot_ads ?? historyView.offer.primeiro_snapshot_ads ?? 0}</div></div>
              <div className="hist-met"><div className="hist-met-lbl">Varia&ccedil;&atilde;o Di&aacute;ria</div><div className="hist-met-num" style={{ color: (historyView.snapshots[0]?.variacao ?? 0) > 0 ? '#10B981' : (historyView.snapshots[0]?.variacao ?? 0) < 0 ? '#EF4444' : '#6B7280' }}>{(historyView.snapshots[0]?.variacao ?? 0) > 0 ? '+' : ''}{historyView.snapshots[0]?.variacao ?? 0}%</div></div>
              <div className="hist-met"><div className="hist-met-lbl">Varia&ccedil;&atilde;o Semanal</div><div className="hist-met-num" style={{ color: '#FF6B00' }}>+{historyView.snapshots.slice(0, 7).reduce((s, sn) => s + sn.variacao, 0)}</div></div>
            </div>

            {/* Chart */}
            <div className="hist-chart-wrap">
              <h3 className="hist-chart-title">Evolu{'\u00e7\u00e3'}o dos Criativos</h3>
              <div style={{ width: '100%', height: 260 }}>
                {(() => {
                  const points = historyView.snapshots.slice().reverse().map(p => ({
                    date: new Date(p.registrado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    ads: p.ads_count,
                  }))
                  if (points.length < 1) return <div className="empty-state" style={{ padding: 40 }}>Nenhum dado ainda</div>
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF8C00" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#FF8C00" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
                        <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 11, fontFamily: 'Sora' }} axisLine={{ stroke: 'rgba(255,255,255,.06)' }} tickLine={false} />
                        <YAxis tick={{ fill: '#555', fontSize: 11, fontFamily: 'Sora' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(10,10,10,.95)', border: '1px solid rgba(255,140,0,.25)', borderRadius: 10, fontFamily: 'Sora', fontSize: 13, backdropFilter: 'blur(12px)' }}
                          labelStyle={{ color: '#888', fontWeight: 600, marginBottom: 4 }}
                          itemStyle={{ color: '#FF8C00', fontWeight: 700 }}
                          formatter={(value) => [`${value} an\u00fancios`, 'Ativos']}
                        />
                        <Area type="monotone" dataKey="ads" stroke="#FF8C00" strokeWidth={2.5} fill="url(#chartGrad)" dot={{ r: 4, fill: '#FF8C00', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#FF8C00', stroke: 'rgba(255,140,0,.3)', strokeWidth: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>
            </div>

            {/* Table */}
            <div className="hist-table-wrap">
              <h3 className="hist-table-title">Dados Hist&oacute;ricos</h3>
              <table className="hist-table">
                <thead><tr><th>Data</th><th>An&uacute;ncios Ativos</th><th>Varia&ccedil;&atilde;o</th><th>Varia&ccedil;&atilde;o %</th></tr></thead>
                <tbody>
                  {historyView.snapshots.length > 0 ? historyView.snapshots.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.registrado_em).toLocaleDateString('pt-BR')}</td>
                      <td>{s.ads_count}</td>
                      <td style={{ color: s.variacao > 0 ? '#10B981' : s.variacao < 0 ? '#EF4444' : '#6B7280' }}>{s.variacao > 0 ? '+' : ''}{s.variacao}</td>
                      <td style={{ color: s.variacao_percent > 0 ? '#10B981' : s.variacao_percent < 0 ? '#EF4444' : '#6B7280' }}>{s.variacao_percent > 0 ? '+' : ''}{s.variacao_percent.toFixed(2)}%</td>
                    </tr>
                  )) : <tr><td colSpan={4} style={{ textAlign: 'center', color: '#4B5563', padding: 32 }}>Nenhum snapshot registrado</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </div>
            <h3 className="confirm-title">Tem certeza que deseja excluir?</h3>
            <p className="confirm-desc">Essa oferta ser&aacute; removida do seu radar permanentemente.</p>
            <div className="confirm-btns">
              <button className="confirm-cancel" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
              <button className="confirm-delete" onClick={() => removeFromRadar(confirmDeleteId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {upgradeModal && (
        <div className="modal-overlay" onClick={() => setUpgradeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, padding: '36px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{'\uD83D\uDEA8'}</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Seus cr{'\u00e9'}ditos acabaram</h2>
              <p style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 1.7 }}>
                Voc{'\u00ea'} usou todas as suas minera{'\u00e7\u00f5'}es e an{'\u00e1'}lises do teste.
                <br />Desbloqueie <strong style={{ color: '#FF6B00' }}>10x mais</strong> com o Starter.
              </p>
            </div>
            <div style={{ background: 'rgba(255,107,0,.06)', border: '1px solid rgba(255,107,0,.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#a1a1aa' }}>Minera{'\u00e7\u00f5'}es</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B00' }}>10/m{'\u00ea'}s</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#a1a1aa' }}>An{'\u00e1'}lises completas</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B00' }}>10/m{'\u00ea'}s</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#a1a1aa' }}>Slots de rastreamento</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B00' }}>10</span>
              </div>
            </div>
            <a href="https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9" target="_blank" rel="noreferrer" className="mine-btn IC-Geral" style={{ width: '100%', textAlign: 'center', textDecoration: 'none', display: 'block', padding: '16px 24px', fontSize: 15, fontWeight: 800 }}>
              Desbloquear por R$57,90/m{'\u00ea'}s {'\u2192'}
            </a>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#52525b', marginTop: 10 }}>Cancele quando quiser {'\u00b7'} Acesso imediato</p>
            <button className="btn-outline" style={{ width: '100%', marginTop: 8 }} onClick={() => setUpgradeModal(false)}>Agora n{'\u00e3'}o</button>
          </div>
        </div>
      )}
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  )
}

/* ─────────── CSS ─────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{overflow-y:scroll}
html,body{height:100%;font-family:'Inter',system-ui,-apple-system,sans-serif;background:#06080f;color:#fafafa;-webkit-font-smoothing:antialiased;overflow-x:hidden}

/* GLOBAL TOKENS */
:root{
  --bg:#06080f;
  --bg-elev:#0a0d16;
  --bg-elev-2:#10131c;
  --bg-card:rgba(8,11,21,.8);
  --border:rgba(255,255,255,.06);
  --border-2:rgba(255,255,255,.1);
  --text:#fafafa;
  --text-2:#a1a1aa;
  --text-3:#71717a;
  --accent:#FF6B00;
  --accent-2:#FF8C42;
  --accent-glow:rgba(255,107,0,.15);
  --radius:12px;
  --ease-out:cubic-bezier(.16,1,.3,1);
  --ease-spring:cubic-bezier(.34,1.56,.64,1);
}

/* BG — clean, no glow */

/* LAYOUT */
.app{min-height:100vh;display:flex;flex-direction:column;position:relative;z-index:1;overflow-x:hidden}

/* HEADER */
.header{
  display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
  padding:14px 28px;height:64px;
  background:rgba(6,8,15,.9);
  border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:50;
  backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);
}
.header-left{display:flex;align-items:center}
.header-logo-circle{display:flex;align-items:center;cursor:pointer}
.header-logo-circle img{
  height:38px;width:auto;display:block;
  filter:
    drop-shadow(1px 0 0 rgba(255,160,0,.85))
    drop-shadow(-1px 0 0 rgba(255,160,0,.85))
    drop-shadow(0 1px 0 rgba(255,160,0,.85))
    drop-shadow(0 -1px 0 rgba(255,160,0,.85))
    drop-shadow(0 0 6px rgba(255,140,0,.5))
    drop-shadow(0 0 14px rgba(255,140,0,.25));
  transition:filter .2s;
}
.header-logo-circle:hover img{
  filter:
    drop-shadow(1px 0 0 rgba(255,170,0,.95))
    drop-shadow(-1px 0 0 rgba(255,170,0,.95))
    drop-shadow(0 1px 0 rgba(255,170,0,.95))
    drop-shadow(0 -1px 0 rgba(255,170,0,.95))
    drop-shadow(0 0 8px rgba(255,140,0,.7))
    drop-shadow(0 0 20px rgba(255,140,0,.4));
}

/* PILL NAV */
.header-tabs{
  display:flex;align-items:center;gap:2px;
  background:var(--bg-elev);
  border:1px solid var(--border);
  padding:4px;border-radius:10px;
  width:480px;flex-shrink:0;
}
.header-tab{
  display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 0;
  flex:1 1 0;min-width:0;
  border:none;background:transparent;color:var(--text-3);
  font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;
  border-radius:8px;transition:background .15s ease, color .15s ease;
  white-space:nowrap;position:relative;
}
.header-tab::before{display:none}
.header-tab:hover{color:var(--text-2);background:rgba(255,255,255,.03)}
.header-tab:hover .tab-icon{color:var(--text-2)}
.header-tab.active{
  color:#fff;
  background:var(--bg-elev-2);
  box-shadow:0 1px 3px rgba(0,0,0,.3);
}
.header-tab.active .tab-icon{color:var(--accent)}
.tab-icon{display:flex;align-items:center;color:var(--text-3);transition:color .15s}
.tab-label{font-weight:600;pointer-events:none}

/* TOOLTIP — disabled, was clipping */
.tab-badge{
  background:#ef4444;color:#fff;font-size:10px;font-weight:800;
  padding:2px 7px;border-radius:999px;min-width:18px;text-align:center;
  box-shadow:0 0 12px rgba(239,68,68,.5);
}
.header-tab.active .tab-badge{background:rgba(0,0,0,.25);box-shadow:none}

/* HEADER RIGHT */
.header-right{display:flex;align-items:center;gap:14px;justify-content:flex-end;position:relative}
.header-saldo{
  font-size:11px;color:var(--text-3);font-weight:600;white-space:nowrap;
  padding:6px 12px;background:var(--bg-elev);border:1px solid var(--border);
  border-radius:6px;
}
.header-avatar{
  width:34px;height:34px;border-radius:8px;
  background:var(--accent);
  border:none;color:#fff;font-weight:800;font-size:13px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  transition:opacity .15s;
}
.header-avatar:hover{opacity:.85}
.profile-drop{
  position:absolute;top:calc(100% + 8px);right:0;
  background:var(--bg-elev);border:1px solid var(--border-2);
  border-radius:var(--radius);padding:8px;min-width:200px;z-index:100;
  box-shadow:0 8px 24px rgba(0,0,0,.5);
  animation:dropIn .15s ease;
}
@keyframes dropIn{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.profile-name{padding:10px 12px;font-size:13px;font-weight:700;color:var(--text);border-bottom:1px solid var(--border);margin-bottom:6px}
.profile-link{display:block;width:100%;text-align:left;padding:9px 12px;border:none;background:transparent;color:var(--text-2);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;border-radius:8px;transition:all .15s;text-decoration:none}
.profile-link:hover{background:var(--bg-elev-2);color:var(--text)}
.profile-plan-badge{
  padding:6px 12px;margin:8px 12px;border-radius:999px;font-size:11px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase;text-align:center;
  background:linear-gradient(135deg,rgba(255,107,0,.15),rgba(255,107,0,.05));
  color:var(--accent);border:1px solid rgba(255,107,0,.25);
}
.profile-quotas{padding:8px 12px;display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:6px 0}
.pq-row{display:flex;justify-content:space-between;align-items:center;font-size:12px}
.pq-label{color:var(--text-3);font-weight:500}
.pq-val{color:var(--text);font-weight:700;font-variant-numeric:tabular-nums}
.pq-renew .pq-val{color:var(--accent)}
@media(max-width:900px){
  .header{display:flex;flex-wrap:wrap;padding:14px 16px 0;height:auto}
  .header-left{flex-shrink:0}
  .header-right{flex-shrink:0;margin-left:auto}
  .header-tabs{order:3;width:100%;justify-content:center;margin-top:12px;flex-shrink:0}
  .tab-label{display:none}
  .header-tab{padding:10px 14px}
}

/* CONTENT */
.content{flex:1;overflow-y:auto}
@keyframes contentFade{from{opacity:0}to{opacity:1}}
.tab-content{max-width:1000px;margin:0 auto;padding:48px 32px 100px;animation:contentFade .2s ease}
@media(max-width:768px){.tab-content{padding:32px 16px 80px}}

/* ANALYZE */
.analyze-hero{text-align:center;margin-bottom:32px;animation:contentFade .5s var(--ease-out)}
.analyze-title{font-size:clamp(26px,3.5vw,38px);font-weight:800;letter-spacing:-.03em;margin-bottom:10px;line-height:1.15;color:#fff}
.acc{color:var(--accent);-webkit-text-fill-color:var(--accent)}
.analyze-sub{font-size:15px;color:var(--text-2);margin-bottom:32px;font-weight:500}

.analyze-form{display:flex;gap:10px;max-width:640px;margin:0 auto}
.analyze-input-wrap{
  flex:1;display:flex;align-items:center;gap:10px;
  background:var(--bg-elev);border:1px solid var(--border);
  border-radius:var(--radius);padding:0 16px;
  transition:all .2s ease;
}
.analyze-input-wrap:focus-within{
  border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(255,107,0,.08);
}
.analyze-input-icon{flex-shrink:0;color:var(--text-3);transition:color .2s}
.analyze-input-wrap:focus-within .analyze-input-icon{color:var(--accent)}
.analyze-input{flex:1;background:transparent;border:none;padding:14px 0;font-family:inherit;font-size:14px;color:var(--text);outline:none;font-weight:500}
.analyze-input::placeholder{color:var(--text-3)}
.analyze-btn{
  padding:0 24px;background:var(--accent);
  border:none;border-radius:var(--radius);color:#fff;font-family:inherit;font-size:14px;
  font-weight:700;cursor:pointer;transition:all .15s ease;
  white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:8px;
}
.analyze-btn:hover:not(:disabled){background:#e05e00}
.analyze-btn:active:not(:disabled){transform:scale(.98)}
.analyze-btn:disabled{opacity:.4;cursor:not-allowed}

/* STATS */
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:720px;margin:24px auto 8px}
@media(max-width:500px){.stats-row{grid-template-columns:1fr}}
.stat-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);padding:18px 20px;display:flex;align-items:center;gap:14px;
  transition:all .2s ease;
}
.stat-card::after{display:none}
.stat-card::before{display:none}
.stat-card:hover{border-color:var(--border-2);background:var(--bg-elev)}
.stat-card>*{position:relative;z-index:2}
.stat-card svg{flex-shrink:0}
.stat-num{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em}
.stat-label{font-size:11px;color:var(--text-3);line-height:1.3;font-weight:500}

/* TERM */
.term{
  background:rgba(15,15,20,.6);
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:16px;overflow:hidden;
  box-shadow:0 16px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04);
  margin-top:24px;animation:fadein .4s var(--ease-out);
}
.term-bar{background:rgba(20,20,28,.5);border-bottom:1px solid var(--border);padding:11px 18px;display:flex;align-items:center;gap:7px}
.tbd{width:10px;height:10px;border-radius:50%;box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}.tbd.r{background:#ff5f57}.tbd.y{background:#febc2e}.tbd.g{background:#28c840}
.term-title{font-size:11px;color:var(--text-3);margin-left:10px;font-family:'JetBrains Mono',monospace;font-weight:600}
.term-progress{height:3px;background:rgba(255,255,255,.04);overflow:hidden}
.term-progress-bar{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .5s var(--ease-out);box-shadow:0 0 12px rgba(255,107,0,.4)}
.term-body{padding:18px 22px;font-family:'JetBrains Mono','Menlo',monospace;font-size:12.5px;line-height:1.9;min-height:80px;color:var(--text-3)}
.tl-wait{color:var(--text-3);animation:fadein .35s var(--ease-out)}
.tl-done{color:var(--accent);animation:fadein .35s var(--ease-out)}
.tcur{display:inline-block;width:8px;height:14px;background:var(--accent);animation:blink .8s step-end infinite;vertical-align:middle;margin-left:4px;box-shadow:0 0 8px rgba(255,107,0,.6)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}

/* HOME */
.home-wrap{display:flex;flex-direction:column;align-items:center;padding-top:48px}
.home-header{text-align:center;margin-bottom:48px}
.home-title{font-size:clamp(24px,3.5vw,34px);font-weight:800;color:#fff;letter-spacing:-.03em;margin-bottom:8px}
.home-sub{font-size:14px;color:#666;font-weight:300;max-width:400px;margin:0 auto;line-height:1.7}
.home-path{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;width:100%;max-width:960px;position:relative}
@media(max-width:900px){.home-path{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.home-path{grid-template-columns:1fr;gap:16px}}
.home-path-line{display:none}
.home-step{
  background:#06080f;border:1px solid rgba(255,140,0,.12);
  border-radius:18px;padding:38px 26px 32px;width:100%;
  text-align:center;cursor:pointer;position:relative;z-index:1;overflow:hidden;
  transition:transform .4s cubic-bezier(.16,1,.3,1),border-color .35s,box-shadow .35s,background .35s;
  display:flex;flex-direction:column;align-items:center;
}
.home-step::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.035) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;z-index:0}
.home-step>*{position:relative;z-index:1}
.home-step:hover{transform:translateY(-4px);border-color:rgba(255,140,0,.32);background:#080b15;box-shadow:0 28px 70px rgba(0,0,0,.7),0 0 0 1px rgba(255,140,0,.18)}
.home-step-num{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:rgba(255,140,0,.5);letter-spacing:.15em;text-transform:uppercase;margin-bottom:14px}
.home-step-dot{width:8px;height:8px;border-radius:50%;background:#FF8C00;box-shadow:0 0 10px rgba(255,140,0,.5);margin-bottom:10px}
.home-step-icon{
  width:56px;height:56px;border-radius:50%;
  border:1px solid rgba(255,140,0,.3);background:rgba(255,140,0,.06);
  display:flex;align-items:center;justify-content:center;
  margin-bottom:28px;position:relative;
  transition:border-color .3s,box-shadow .3s,background .3s;
}
.home-step:hover .home-step-icon{border-color:rgba(255,140,0,.6);box-shadow:0 0 28px rgba(255,140,0,.2);background:rgba(255,140,0,.1)}
.home-step-icon::before{
  content:'';position:absolute;inset:-4px;border-radius:50%;
  border:1.5px solid transparent;border-top-color:rgba(255,140,0,.6);border-right-color:rgba(255,140,0,.15);
  animation:arc-spin 4s linear infinite;
}
@keyframes arc-spin{to{transform:rotate(360deg)}}
.home-step-icon svg{transition:transform .3s}
.home-step:hover .home-step-icon svg{transform:scale(1.15)}
.home-step-title{font-size:18px;font-weight:700;color:#fff;margin-bottom:14px;letter-spacing:-.02em}
.home-step-desc{font-size:13px;color:#888;line-height:1.75;font-weight:300;max-width:260px;margin:0 auto 16px}
.home-step-cta{font-size:13px;font-weight:700;color:var(--accent);transition:color .15s}
.home-step:hover .home-step-cta{color:var(--accent-2)}

/* ═══ FEED OFERTAS V2 — Escalonador style ═══ */
.of-searchbar{
  display:flex;align-items:center;gap:12px;
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:14px;padding:0 18px;margin-bottom:24px;
  transition:border-color .2s;
}
.of-searchbar:focus-within{border-color:rgba(255,140,0,.4);box-shadow:0 0 0 3px rgba(255,140,0,.06)}
.of-search-input{flex:1;background:transparent;border:none;padding:14px 0;font-family:inherit;font-size:14px;color:var(--text);outline:none;font-weight:500}
.of-search-input::placeholder{color:var(--text-3)}
.of-search-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.of-flag-active{width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);cursor:pointer}
.of-sort-btn{
  background:var(--bg-elev);border:1px solid var(--border);border-radius:10px;
  padding:8px 14px;font-family:inherit;font-size:12px;font-weight:600;
  color:var(--text-2);outline:none;cursor:pointer;transition:all .15s;
}
.of-sort-btn:hover{border-color:var(--accent);color:var(--text)}
.of-filter-toggle{
  width:38px;height:38px;border-radius:10px;
  background:var(--bg-elev);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  color:var(--text-2);cursor:pointer;transition:all .15s;
}
.of-filter-toggle:hover{border-color:var(--accent);color:var(--accent)}

/* Layout: grid only, sidebar overlays */
.of-layout{position:relative}
.of-grid-area{width:100%}

/* 5-column grid */
.of-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
@media(max-width:1200px){.of-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:900px){.of-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){.of-grid{grid-template-columns:repeat(2,1fr);gap:10px}}

/* Card */
.of-card{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:14px;overflow:hidden;cursor:pointer;
  transition:all .25s cubic-bezier(.16,1,.3,1);
}
.of-card:hover{border-color:rgba(255,140,0,.35);transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.45)}
.of-card-img{width:100%;aspect-ratio:1;background:var(--bg-elev);position:relative;overflow:hidden}
.of-card-img img{width:100%;height:100%;object-fit:cover;display:block}
.of-card-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(10,10,20,.8),rgba(15,15,25,.6))}
/* Play badge */
.of-card-play{
  position:absolute;top:10px;left:10px;width:28px;height:28px;
  background:#FF6B00;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 8px rgba(255,107,0,.5);
}
/* Bookmark */
.of-card-bm{
  position:absolute;top:10px;right:10px;width:30px;height:30px;
  background:rgba(0,0,0,.45);backdrop-filter:blur(6px);border:none;
  border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;
  color:rgba(255,255,255,.55);transition:all .15s;
}
.of-card-bm:hover{color:#fff;background:rgba(0,0,0,.7)}
.of-card-body{padding:12px 14px}
.of-card-name{
  font-size:14px;font-weight:700;color:var(--text);margin-bottom:10px;
  line-height:1.35;min-height:38px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.of-card-footer{display:flex;align-items:center;gap:10px}
.of-card-ads{
  background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.2);
  color:var(--accent);font-size:14px;font-weight:800;
  padding:6px 14px;border-radius:10px;display:flex;flex-direction:column;align-items:center;line-height:1.2;
}
.of-card-ads span{font-size:10px;font-weight:600;opacity:.6}
.of-card-flag{width:24px;height:24px;border-radius:50%;object-fit:cover;border:1px solid var(--border)}

/* Sidebar filters — overlay below header */
.of-sidebar{position:fixed;top:64px;right:0;bottom:0;z-index:40;width:300px;background:var(--bg);border-left:1px solid var(--border);box-shadow:-8px 0 40px rgba(0,0,0,.6);animation:of-slide-in .2s ease}
@keyframes of-slide-in{from{transform:translateX(100%)}to{transform:translateX(0)}}
.of-sidebar-inner{
  padding:24px 20px;height:100%;overflow-y:auto;
}
.of-sb-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;font-size:16px;font-weight:800;color:var(--text)}
.of-sb-close{background:none;border:none;color:var(--text-3);font-size:22px;cursor:pointer;padding:0 4px;line-height:1}
.of-sb-close:hover{color:var(--text)}
.of-sb-section{margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:16px}
.of-sb-section:last-of-type{border-bottom:none;padding-bottom:0}
.of-sb-label{font-size:13px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.of-sb-label svg{color:var(--accent)}
.of-sb-check{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:var(--text-2);cursor:pointer}
.of-sb-check:hover{color:var(--text)}
.of-sb-check input[type="radio"],.of-sb-check input[type="checkbox"]{
  width:16px;height:16px;accent-color:var(--accent);cursor:pointer;
}
.of-sb-total{text-align:center;font-size:12px;color:var(--text-3);font-weight:600;margin-top:12px}

/* ═══ FEED DETAIL V2 — AdSpy style ═══ */
.fd{
  background:var(--bg);width:100%;max-width:1080px;margin:0 auto;min-height:100vh;
  padding:24px 32px 80px;position:relative;
}
.fd-back{position:sticky;top:16px;z-index:10;background:var(--bg-elev);border:1px solid var(--border);color:var(--text-2);cursor:pointer;padding:8px 16px;border-radius:8px;transition:all .15s;font-family:inherit;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}
.fd-back:hover{color:var(--text);border-color:var(--border-2)}
.fd-breadcrumb{font-size:12px;color:var(--text-3);margin-top:20px;margin-bottom:6px}
.fd-breadcrumb span{color:var(--accent)}
.fd-title{font-size:24px;font-weight:800;color:var(--accent);margin-bottom:28px;letter-spacing:-.02em}

/* Top area: VSL + sidebar */
.fd-top{display:grid;grid-template-columns:1fr 300px;gap:24px;margin-bottom:36px}
@media(max-width:860px){.fd-top{grid-template-columns:1fr}}
.fd-main-area{min-width:0}
.fd-hero-wrap{margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid var(--border);background:#000}
.fd-hero-img{width:100%;max-height:400px;object-fit:contain;display:block}
.fd-action-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.fd-stats-pills{display:flex;gap:6px;margin-left:auto}
.fd-pill{font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;background:rgba(255,255,255,.06);color:var(--text-3)}
.fd-pill-vid{background:rgba(139,92,246,.12);color:#a78bfa}
.fd-pill-img{background:rgba(59,130,246,.12);color:#60a5fa}
.fd-btn-dl{
  display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
  background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.25);
  color:var(--accent);font-size:13px;font-weight:700;border-radius:10px;
  cursor:pointer;font-family:inherit;transition:all .15s;text-decoration:none;
}
.fd-btn-dl:hover{background:rgba(255,140,0,.2)}
.fd-btn-analyze{
  display:inline-flex;align-items:center;gap:8px;padding:10px 20px;
  background:linear-gradient(135deg,#FF6B00,#FF8C42);border:none;
  color:#fff;font-size:13px;font-weight:800;border-radius:10px;
  cursor:pointer;font-family:inherit;transition:all .15s;
  box-shadow:0 4px 16px rgba(255,107,0,.3);
}
.fd-btn-analyze:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(255,107,0,.4)}

/* Sidebar cards — golden accent */
.fd-sidebar{display:flex;flex-direction:column;gap:16px}
.fd-sidebar-card{
  background:var(--bg-card);border:1px solid rgba(255,180,50,.18);
  border-radius:14px;overflow:hidden;
}
.fd-sidebar-hd{
  padding:14px 16px;font-size:14px;font-weight:700;
  color:#FFB347;display:flex;align-items:center;gap:8px;
  border-bottom:1px solid rgba(255,180,50,.1);
  background:rgba(255,180,50,.04);
}
.fd-sidebar-rows{padding:4px 0}
.fd-row{display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04)}
.fd-row:last-child{border-bottom:none}
.fd-row span:first-child{color:var(--text-3)}
.fd-row span:last-child{color:var(--text);font-weight:600}
.fd-row-accent{color:var(--accent)!important;font-weight:800!important}

/* Sections */
.fd-section{margin-bottom:40px}
.fd-section-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.fd-section-title{font-size:18px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:10px}
.fd-section-title svg{color:var(--accent)}
.fd-section-count{font-size:13px;color:var(--text-3);font-weight:600}

/* Buttons */
.fd-btn-sm{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(255,140,0,.1);border:1px solid rgba(255,140,0,.25);
  color:var(--accent);font-size:11px;font-weight:700;padding:6px 14px;
  border-radius:8px;cursor:pointer;font-family:inherit;transition:all .15s;
}
.fd-btn-sm:hover{background:rgba(255,140,0,.2)}
.fd-btn-more{
  background:var(--bg-card);border:1px solid var(--border);color:var(--text-2);
  font-size:13px;font-weight:700;padding:12px 28px;border-radius:10px;
  cursor:pointer;font-family:inherit;transition:all .15s;
}
.fd-btn-more:hover{border-color:var(--accent);color:var(--accent)}

/* Transcript box — golden border */
.fd-transcript-box{
  background:rgba(0,0,0,.25);
  border:1px solid rgba(255,180,50,.2);
  border-radius:12px;padding:20px;position:relative;
}
.fd-transcript-text{
  font-size:13px;color:var(--text-2);line-height:1.8;white-space:pre-wrap;word-break:break-word;
  max-height:160px;overflow:hidden;transition:max-height .3s ease;
}
.fd-transcript-text.expanded{max-height:none}
.fd-transcript-toggle{
  display:block;margin:12px auto 0;background:none;border:none;
  color:var(--accent);font-size:13px;font-weight:700;cursor:pointer;
  font-family:inherit;padding:4px 8px;
}
.fd-transcript-toggle:hover{text-decoration:underline}

/* Creatives grid — 4 cols */
.fd-creatives-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media(max-width:900px){.fd-creatives-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){.fd-creatives-grid{grid-template-columns:repeat(2,1fr)}}
.fd-creative-card{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;transition:all .2s;
}
.fd-creative-card:hover{border-color:rgba(255,140,0,.3);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.fd-creative-media{position:relative;width:100%;aspect-ratio:1;background:#0a0a0f;overflow:hidden}
.fd-creative-media video,.fd-creative-media img{width:100%;height:100%;object-fit:cover;display:block}
.fd-creative-dl{
  position:absolute;top:8px;right:8px;width:30px;height:30px;
  background:rgba(0,0,0,.6);backdrop-filter:blur(4px);border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  color:#fff;text-decoration:none;transition:all .15s;opacity:0;
}
.fd-creative-card:hover .fd-creative-dl{opacity:1}
.fd-creative-dl:hover{background:rgba(255,140,0,.8)}
.fd-creative-info{padding:10px 12px}
.fd-creative-name{font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px}
.fd-creative-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}
.fd-tag{font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,.06);color:var(--text-3);text-transform:uppercase;letter-spacing:.03em}
.fd-tag-vid{background:rgba(139,92,246,.15);color:#a78bfa}
.fd-tag-img{background:rgba(59,130,246,.15);color:#60a5fa}
.fd-tag-active{background:rgba(34,197,94,.12);color:#22c55e}
.fd-creative-date{font-size:11px;color:var(--text-3)}
.fd-creative-broken{display:none!important}
.fd-creative-type-badge{
  position:absolute;bottom:8px;left:8px;width:28px;height:28px;
  background:rgba(0,0,0,.7);backdrop-filter:blur(4px);border-radius:50%;
  display:flex;align-items:center;justify-content:center;color:#fff;
}

/* Pages grid */
.fd-pages-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
@media(max-width:700px){.fd-pages-grid{grid-template-columns:1fr}}
.fd-page-card{
  background:var(--bg-card);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;transition:all .2s;
}
.fd-page-card:hover{border-color:rgba(255,140,0,.25)}
.fd-page-screenshot{width:100%;aspect-ratio:16/10;background:var(--bg-elev);overflow:hidden;position:relative}
.fd-page-screenshot img{width:100%;height:100%;object-fit:cover;display:block}
.fd-page-placeholder{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--text-3)}
.fd-page-fb{color:rgba(59,130,246,.5)}
.fd-page-badge{
  font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;
  background:rgba(255,140,0,.12);color:var(--accent);
}
.fd-page-info{padding:14px 16px}
.fd-page-label{font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px}
.fd-page-url{font-size:10px;color:var(--accent);word-break:break-all;background:rgba(0,0,0,.3);padding:8px 10px;border-radius:6px;font-family:'JetBrains Mono',monospace;margin-bottom:8px;display:block;max-height:36px;overflow:hidden}
.fd-page-actions{display:flex;gap:8px}

/* SECTION LABEL */
.tool-sec-label{display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.tool-sec-label::before,.tool-sec-label::after{display:none}
.tool-sec-label span{color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}

/* STATUS BAR (landing style) */
.status-bar-wrap{width:100%;display:flex;flex-direction:column;gap:14px;max-width:420px;margin:0 auto;padding:0 20px 28px;animation:fadein .4s var(--ease-out)}
.status-track{height:6px;background:rgba(255,255,255,.05);border-radius:100px;overflow:hidden;border:1px solid rgba(255,140,0,.14);position:relative}
.status-fill{height:100%;background:linear-gradient(90deg,#FF8C00,#FFB347);border-radius:100px;transition:width .9s cubic-bezier(.16,1,.3,1);box-shadow:0 0 18px rgba(255,140,0,.55);position:relative;overflow:hidden}
.status-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:shimmer 1.6s linear infinite;background-size:200px 100%}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.status-text{display:flex;align-items:center;justify-content:center;gap:12px;font-size:14px;color:#bbb;font-weight:500;min-height:36px;text-align:center}
.st-pulse{width:9px;height:9px;border-radius:50%;background:#FF8C00;animation:st-pulse-anim 1.2s ease-in-out infinite;flex-shrink:0;box-shadow:0 0 10px rgba(255,140,0,.6)}
@keyframes st-pulse-anim{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}

/* HISTORY BUTTON */
.hc-btn{padding:7px 14px;border-radius:999px;border:1px solid var(--border-2);background:rgba(255,255,255,.02);color:var(--text-2);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s var(--ease-out);flex-shrink:0;white-space:nowrap}
.hc-btn:hover{border-color:var(--accent);color:var(--accent);background:rgba(255,107,0,.06)}
.hc-del{background:transparent;border:none;color:var(--text-3);cursor:pointer;padding:7px;border-radius:8px;transition:all .2s;flex-shrink:0;display:flex;align-items:center}
.hc-del:hover{color:#EF4444;background:rgba(239,68,68,.1)}

/* ERROR */
.err{
  background:linear-gradient(135deg,rgba(239,68,68,.08),rgba(239,68,68,.02));
  border:1px solid rgba(239,68,68,.2);color:#fb7185;
  padding:14px 18px;border-radius:12px;font-size:13px;line-height:1.5;font-weight:500;
  backdrop-filter:blur(8px);animation:fadein .35s var(--ease-out);
}

/* SECTION HEADERS */
.sec-hd{display:flex;align-items:baseline;gap:12px;margin:32px 0 18px}
.sec-hd h2{font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--text)}
.sec-count{font-size:12px;color:var(--text-3);font-weight:600}

/* HISTORY CARDS */
.history-grid{display:flex;flex-direction:column;gap:8px}
.history-card{
  display:flex;align-items:center;gap:14px;padding:14px 16px;
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);cursor:pointer;
  transition:all .15s ease;
  position:relative;overflow:hidden;
}
.history-card::before{display:none}
.history-card:hover{
  border-color:var(--border-2);
  background:var(--bg-elev);
}
.hc-score{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;flex-shrink:0;letter-spacing:-.02em}
.hc-score.green{background:linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.06));color:#22c55e;border:1px solid rgba(34,197,94,.2);box-shadow:0 0 16px rgba(34,197,94,.1)}
.hc-score.yellow{background:linear-gradient(135deg,rgba(234,179,8,.18),rgba(234,179,8,.06));color:#eab308;border:1px solid rgba(234,179,8,.2);box-shadow:0 0 16px rgba(234,179,8,.1)}
.hc-score.red{background:linear-gradient(135deg,rgba(239,68,68,.18),rgba(239,68,68,.06));color:#ef4444;border:1px solid rgba(239,68,68,.2);box-shadow:0 0 16px rgba(239,68,68,.1)}
.hc-info{flex:1;min-width:0}
.hc-name{font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em}
.hc-meta{font-size:12px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}

/* ═══ RADAR — full width ═══ */
.rdr-full{max-width:100%;padding:24px 32px 80px}
@media(max-width:768px){.rdr-full{padding:16px 16px 60px}}
.rdr-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap;animation:contentFade .45s var(--ease-out)}
.rdr-search-wrap{
  display:flex;align-items:center;gap:12px;
  background:rgba(15,15,20,.6);
  border:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(20px);
  border-radius:14px;padding:0 18px;flex:1;max-width:520px;
  transition:all .35s var(--ease-out);
}
.rdr-search-wrap:focus-within{border-color:rgba(255,107,0,.5);box-shadow:0 0 0 4px rgba(255,107,0,.1)}
.rdr-search{flex:1;background:transparent;border:none;padding:14px 0;font-family:inherit;font-size:13px;color:var(--text);outline:none;font-weight:500}
.rdr-search::placeholder{color:var(--text-3)}
.rdr-actions{display:flex;gap:10px;flex-shrink:0}
.rdr-btn-outline{display:flex;align-items:center;gap:8px;padding:12px 22px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(15,15,20,.6);backdrop-filter:blur(20px);color:var(--text-2);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .3s var(--ease-out)}
.rdr-btn-outline:hover{border-color:rgba(255,255,255,.18);color:var(--text);background:rgba(20,20,28,.8)}
.rdr-btn-solid{
  display:flex;align-items:center;gap:8px;padding:12px 22px;border:none;border-radius:14px;
  background:linear-gradient(135deg,#FF6B00,#FF8C42);color:#fff;font-family:inherit;font-size:13px;
  font-weight:800;cursor:pointer;transition:all .3s var(--ease-out);
  box-shadow:0 8px 24px rgba(255,107,0,.35),inset 0 1px 0 rgba(255,255,255,.2);
  letter-spacing:-.01em;
}
.rdr-btn-solid:hover{transform:translateY(-1px);box-shadow:0 12px 32px rgba(255,107,0,.45),inset 0 1px 0 rgba(255,255,255,.25)}

/* Banner */
.rdr-banner{
  background:linear-gradient(135deg,rgba(59,130,246,.08),rgba(59,130,246,.02));
  border:1px solid rgba(59,130,246,.18);
  backdrop-filter:blur(20px);
  border-radius:16px;padding:20px 24px;display:flex;align-items:flex-start;gap:14px;margin-bottom:32px;
  box-shadow:0 8px 24px rgba(0,0,0,.2);animation:fadein .4s var(--ease-out);
}
.rdr-banner-icon{background:rgba(59,130,246,.18);border-radius:10px;padding:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.rdr-banner-tag{background:rgba(59,130,246,.18);color:#60A5FA;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600}

/* Metric cards */
.rdr-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
@media(max-width:768px){.rdr-metrics{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.rdr-metrics{grid-template-columns:1fr}}
.rdr-mc{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);padding:20px;
  transition:all .2s ease;
}
.rdr-mc::before{display:none}
.rdr-mc:hover{border-color:var(--border-2)}
.rdr-mc-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.rdr-mc-label{font-size:12px;color:var(--text-3);font-weight:500}
.rdr-mc-ic{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rdr-mc-val{font-size:40px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.03em}

/* Card grid */
.rdr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:1100px){.rdr-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.rdr-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.rdr-grid{grid-template-columns:1fr}}

/* Offer card */
.rc{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);padding:16px;
  transition:all .2s ease;position:relative;overflow:hidden;
  animation:fadein .3s ease;
}
.rc::before{display:none}
.rc:hover{
  border-color:var(--border-2);
  box-shadow:0 4px 12px rgba(0,0,0,.2);
}
.rc-hd{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px}
.rc-fb{
  width:30px;height:30px;border-radius:8px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.rc-fb svg{fill:#71717a !important;width:14px;height:14px}
.rc-del{position:absolute;top:12px;right:12px;background:transparent;border:none;color:var(--text-3);cursor:pointer;padding:6px;border-radius:6px;transition:all .2s;display:flex;align-items:center;z-index:2}
.rc-del:hover{color:#EF4444;background:rgba(239,68,68,.1)}
.rc-hd-info{flex:1;min-width:0}
.rc-name{font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em}
.rc-url{font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none;display:block;transition:color .2s;font-weight:500}
.rc-url:hover{color:var(--accent)}
.rc-st{font-size:9px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0;letter-spacing:.05em;text-transform:uppercase}
.rc-st-estavel{background:rgba(16,185,129,.12);color:#10B981;border:1px solid rgba(16,185,129,.2)}
.rc-st-esc{background:rgba(245,158,11,.12);color:#F59E0B;border:1px solid rgba(245,158,11,.2)}
.rc-st-caindo{background:rgba(239,68,68,.12);color:#EF4444;border:1px solid rgba(239,68,68,.2)}
.rc-st-morta{background:rgba(107,114,128,.1);color:var(--text-3);border:1px solid rgba(107,114,128,.2)}

/* Metrics pair */
.rc-mets{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.rc-met{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.04);border-radius:12px;padding:12px 10px;text-align:center}
.rc-met-lbl{font-size:10px;color:var(--text-3);margin-bottom:6px;font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.rc-met-num{font-size:26px;font-weight:900;color:#fff;margin-bottom:6px;line-height:1.1;letter-spacing:-.03em}
.rc-met-badge{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px}
.rc-met-badge.up{background:rgba(16,185,129,.15);color:#10B981}
.rc-met-badge.dn{background:rgba(239,68,68,.15);color:#EF4444}
.rc-met-badge.flat{background:rgba(107,114,128,.12);color:var(--text-3)}
.rc-met-date{font-size:11px;color:var(--accent);font-weight:600}

/* Variation rows */
.rc-vars{margin-bottom:14px;border-top:1px solid rgba(255,255,255,.06);padding-top:12px}
.rc-var{display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:12px;font-weight:500}
.rc-var-l{color:var(--text-3)}
.rc-var-v{color:var(--accent);display:flex;align-items:center;gap:4px;font-weight:700}
.rc-var-v.up{color:#10B981}
.rc-var-v.dn{color:#EF4444}

/* Actions */
.rc-acts{display:flex;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:14px}
.rc-hist-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 0;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;color:var(--text-2);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .3s var(--ease-out)}
.rc-hist-btn:hover{border-color:rgba(255,107,0,.3);color:var(--text);background:rgba(255,107,0,.05)}
.rc-ref-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;color:var(--accent);cursor:pointer;transition:all .3s var(--ease-out);flex-shrink:0}
.rc-ref-btn:hover{border-color:var(--accent);background:rgba(255,107,0,.08);transform:rotate(90deg)}

/* ═══ HISTORY PAGE ═══ */
.hist-page{background:#0A0A0A;width:100%;max-width:900px;margin:0 auto;min-height:100vh;padding:24px 32px 60px;overflow-y:auto}
.hist-bread{display:flex;align-items:center;gap:8px;margin-bottom:24px}
.hist-back{background:transparent;border:none;color:#6B7280;cursor:pointer;padding:6px;border-radius:6px;display:flex;transition:all .12s}
.hist-back:hover{color:#fff;background:#1F2937}
.hist-bread-txt{font-size:13px;color:#6B7280}
.hist-title{font-size:24px;font-weight:800;color:#fff;margin-bottom:4px}
.hist-sub{font-size:14px;color:#6B7280;margin-bottom:24px}
.hist-mets{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
.hist-met{background:#111;border:1px solid #1F2937;border-radius:12px;padding:18px 20px;text-align:center}
.hist-met-lbl{font-size:12px;color:#6B7280;margin-bottom:6px}
.hist-met-num{font-size:28px;font-weight:800;color:#fff}
.hist-chart-wrap{background:#111;border:1px solid #1F2937;border-radius:12px;padding:20px 24px;margin-bottom:24px}
.hist-chart-title{font-size:16px;font-weight:700;color:#e4e4e7;margin-bottom:16px}
.hist-chart{height:200px;position:relative}
.hist-chart-svg{width:100%;height:100%}
.hist-chart-labels{display:flex;justify-content:space-between;padding-top:8px;font-size:10px;color:#4B5563}
.hist-table-wrap{background:#111;border:1px solid #1F2937;border-radius:12px;padding:20px 24px}
.hist-table-title{font-size:16px;font-weight:700;color:#e4e4e7;margin-bottom:16px}
.hist-table{width:100%;border-collapse:collapse}
.hist-table th{text-align:left;font-size:12px;color:#6B7280;font-weight:500;padding:10px 12px;border-bottom:1px solid #1F2937}
.hist-table td{font-size:13px;color:#e4e4e7;padding:10px 12px;border-bottom:1px solid #111}
.hist-table tr:hover td{background:#1A1A1A}

/* BUTTONS */
.btn-sm{padding:7px 14px;border-radius:8px;border:1px solid var(--border-2);background:rgba(255,255,255,.02);color:var(--text-2);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:all .25s var(--ease-out);text-decoration:none;white-space:nowrap}
.btn-sm:hover{border-color:rgba(255,255,255,.18);color:var(--text);background:rgba(255,255,255,.06)}
.btn-sm.btn-orange{background:linear-gradient(135deg,#FF6B00,#FF8C42);border-color:transparent;color:#fff;box-shadow:0 4px 12px rgba(255,107,0,.3)}
.btn-sm.btn-orange:hover{box-shadow:0 6px 16px rgba(255,107,0,.4);transform:translateY(-1px)}
.btn-sm.btn-ghost{border-color:transparent;color:var(--text-3);background:transparent}
.btn-sm.btn-ghost:hover{color:#ef4444;background:rgba(239,68,68,.08)}
.btn-outline{padding:10px 18px;border-radius:10px;border:1px solid var(--border-2);background:rgba(255,255,255,.02);color:var(--text-2);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .25s var(--ease-out)}
.btn-outline:hover{border-color:rgba(255,255,255,.18);color:var(--text)}

/* MINE */
.mine-filters{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);padding:24px;
}
.mine-nichos{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
.nicho-btn{padding:10px 18px;border-radius:999px;border:1px solid var(--border-2);background:rgba(255,255,255,.02);color:var(--text-2);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .3s var(--ease-out)}
.nicho-btn:hover{border-color:rgba(255,255,255,.18);color:var(--text);transform:translateY(-1px)}
.nicho-btn.active{border-color:rgba(255,107,0,.4);background:linear-gradient(135deg,rgba(255,107,0,.18),rgba(255,107,0,.06));color:var(--accent);box-shadow:0 4px 16px rgba(255,107,0,.15)}
.mine-advanced{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
@media(max-width:500px){.mine-advanced{grid-template-columns:1fr}}
.filter-row{display:flex;gap:7px}
.filter-btn{padding:7px 14px;border-radius:8px;border:1px solid var(--border-2);background:rgba(255,255,255,.02);color:var(--text-3);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .25s}
.filter-btn.active{border-color:rgba(255,107,0,.4);background:rgba(255,107,0,.08);color:var(--accent)}
.mine-btn{
  padding:14px 32px;background:var(--accent);
  border:none;border-radius:var(--radius);color:#fff;font-family:inherit;font-size:14px;
  font-weight:700;cursor:pointer;transition:all .15s ease;
  display:inline-flex;align-items:center;gap:10px;
}
.mine-btn:hover:not(:disabled){background:#e05e00}
.mine-btn:disabled{opacity:.4;cursor:not-allowed}

/* Minerador hero */
.mine-hero{text-align:center;margin-bottom:32px;animation:contentFade .5s var(--ease-out)}
.mine-title{font-size:clamp(28px,4vw,40px);font-weight:800;letter-spacing:-.03em;margin-bottom:10px;color:#fff;line-height:1.1}
.mine-sub{font-size:15px;color:var(--text-2);font-weight:500}
.mine-status{text-align:center;font-size:14px;color:var(--text-2);margin-top:-12px;margin-bottom:18px;animation:fadein .35s var(--ease-out);font-weight:500}
.mine-hint{text-align:center;font-size:13px;color:var(--text-3);margin-top:-12px;margin-bottom:18px;font-weight:500}
.mine-results-wrap{margin-top:12px}
.mine-results{display:flex;flex-direction:column;gap:14px}
.mrc{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius);padding:20px;
  transition:all .2s ease;position:relative;overflow:hidden;
  animation:fadein .3s ease;
}
.mrc::after{display:none}
.mrc::before{display:none}
.mrc:hover{
  border-color:var(--border-2);
  box-shadow:0 4px 16px rgba(0,0,0,.3);
}
.mrc>*{position:relative;z-index:2}
.mrc-top{display:flex;align-items:center;gap:16px;margin-bottom:10px}
.mrc-score{
  width:54px;height:54px;border-radius:14px;
  display:flex;align-items:center;justify-content:center;
  font-size:20px;font-weight:900;flex-shrink:0;letter-spacing:-.03em;
}
.mrc-score.green{background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(16,185,129,.06));color:#10B981;border:1px solid rgba(16,185,129,.2);box-shadow:0 0 24px rgba(16,185,129,.12)}
.mrc-score.yellow{background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.06));color:#F59E0B;border:1px solid rgba(245,158,11,.2);box-shadow:0 0 24px rgba(245,158,11,.12)}
.mrc-score.red{background:linear-gradient(135deg,rgba(107,114,128,.15),rgba(107,114,128,.04));color:var(--text-3);border:1px solid rgba(107,114,128,.2)}
.mrc-info{flex:1;min-width:0}
.mrc-name{font-size:17px;font-weight:800;color:var(--text);margin-bottom:3px;letter-spacing:-.02em}
.mrc-meta{font-size:13px;color:var(--text-2);font-weight:500}
.mrc-nicho{
  font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;
  background:linear-gradient(135deg,rgba(255,107,0,.15),rgba(255,107,0,.05));
  color:var(--accent);border:1px solid rgba(255,107,0,.25);
  flex-shrink:0;white-space:nowrap;
}
.mrc-angle{font-size:14px;color:var(--text-2);line-height:1.55;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mrc-acts{display:flex;gap:10px;flex-wrap:wrap}
.mrc-btn-orange{
  padding:11px 22px;background:linear-gradient(135deg,#FF6B00,#FF8C42);
  border:none;border-radius:11px;color:#fff;font-family:inherit;font-size:13px;
  font-weight:800;cursor:pointer;transition:all .3s var(--ease-out);
  box-shadow:0 6px 20px rgba(255,107,0,.3),inset 0 1px 0 rgba(255,255,255,.2);
}
.mrc-btn-orange:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(255,107,0,.4)}
.mrc-btn-outline{
  padding:11px 22px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);
  border-radius:11px;color:var(--text-2);font-family:inherit;font-size:13px;
  font-weight:700;cursor:pointer;transition:all .3s var(--ease-out);
}
.mrc-btn-outline:hover{border-color:rgba(255,107,0,.4);color:var(--accent);background:rgba(255,107,0,.06)}

/* MINE PREVIEW — FB page avatar */
.mrc-preview{width:48px;height:48px;border-radius:12px;overflow:hidden;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
.mrc-preview img{width:100%;height:100%;object-fit:cover;display:block}

/* ═══ CRIATIVOS GRID ═══ */
.criativos-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:24px}
@media(max-width:600px){.criativos-grid{grid-template-columns:1fr}}
.criativo-card{
  background:linear-gradient(180deg,rgba(20,20,28,.6),rgba(15,15,20,.4));
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:16px;padding:18px;
  transition:all .3s var(--ease-out);position:relative;overflow:hidden;
}
.criativo-card:hover{border-color:rgba(255,107,0,.2);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.criativo-media{width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;margin-bottom:14px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.04)}
.criativo-media img,.criativo-media video{width:100%;height:100%;object-fit:cover;display:block}
.criativo-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.criativo-score{
  width:36px;height:36px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:900;flex-shrink:0;
}
.criativo-score.green{background:linear-gradient(135deg,rgba(16,185,129,.2),rgba(16,185,129,.06));color:#10B981;border:1px solid rgba(16,185,129,.2)}
.criativo-score.yellow{background:linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.06));color:#F59E0B;border:1px solid rgba(245,158,11,.2)}
.criativo-score.red{background:linear-gradient(135deg,rgba(107,114,128,.15),rgba(107,114,128,.04));color:var(--text-3);border:1px solid rgba(107,114,128,.2)}
.criativo-meta{display:flex;align-items:center;gap:8px}
.criativo-formato{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:var(--text-2);text-transform:uppercase;letter-spacing:.04em}
.criativo-dias{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:rgba(255,107,0,.1);border:1px solid rgba(255,107,0,.2);color:var(--accent)}
.criativo-hook{font-size:13px;color:var(--text);line-height:1.6;margin-bottom:8px;font-style:italic;font-weight:500;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.criativo-angulo{font-size:12px;color:var(--text-3);margin-bottom:14px;font-weight:500}
.criativo-actions{display:flex;gap:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:12px}
.criativo-btn{
  display:flex;align-items:center;gap:6px;
  padding:8px 14px;background:rgba(255,255,255,.02);
  border:1px solid rgba(255,255,255,.08);border-radius:8px;
  color:var(--text-2);font-family:inherit;font-size:11px;font-weight:700;
  cursor:pointer;transition:all .2s var(--ease-out);
}
.criativo-btn:hover{border-color:rgba(255,107,0,.4);color:var(--accent);background:rgba(255,107,0,.06)}

/* MODALS */
.modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.65);
  display:flex;align-items:center;justify-content:center;z-index:200;
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  animation:overlayIn .3s var(--ease-out);
}
@keyframes overlayIn{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(12px)}}
.modal{
  background:linear-gradient(180deg,rgba(20,20,28,.95),rgba(15,15,20,.95));
  border:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(40px);
  border-radius:20px;padding:28px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;
  box-shadow:0 32px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);
  animation:modalIn .35s var(--ease-spring);
}
@keyframes modalIn{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.modal-hd h3{font-size:18px;font-weight:800;letter-spacing:-.02em}
.modal-close{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:var(--text-2);font-size:18px;cursor:pointer;padding:6px 10px;border-radius:8px;transition:all .2s}
.modal-close:hover{background:rgba(255,255,255,.08);color:var(--text)}
.modal-body{display:flex;flex-direction:column;gap:14px}
.modal-label{font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.08em}
.modal-input{background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 16px;font-family:inherit;font-size:13px;color:var(--text);outline:none;transition:all .25s}
.modal-input:focus{border-color:rgba(255,107,0,.5);box-shadow:0 0 0 4px rgba(255,107,0,.1)}
.modal-input::placeholder{color:var(--text-3)}

/* ALERTS */
.alert-item{padding:12px 14px;border-radius:8px;border-left:3px solid #27272a;background:#09090b}
.alert-item.alert-escalou{border-left-color:#22c55e}
.alert-item.alert-caiu,.alert-item.alert-morreu{border-left-color:#ef4444}
.alert-item.alert-pagina_mudou{border-left-color:#eab308}
.alert-time{font-size:11px;color:#52525b;margin-bottom:4px}
.alert-msg{font-size:13px;color:#a1a1aa;line-height:1.5}

/* CONFIRM DELETE */
.confirm-modal{background:#111;border:1px solid #1F2937;border-radius:16px;padding:32px;max-width:380px;width:90%;text-align:center;animation:confirmIn .2s ease}
@keyframes confirmIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.confirm-icon{width:48px;height:48px;border-radius:12px;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.confirm-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:8px}
.confirm-desc{font-size:13px;color:#6B7280;margin-bottom:24px;line-height:1.5}
.confirm-btns{display:flex;gap:10px}
.confirm-cancel{flex:1;padding:10px 0;background:transparent;border:1px solid #2D2D2D;border-radius:8px;color:#a1a1aa;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.confirm-cancel:hover{border-color:#555;color:#fff}
.confirm-delete{flex:1;padding:10px 0;background:#EF4444;border:none;border-radius:8px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.confirm-delete:hover{background:#DC2626}

/* SAVED MODAL */
.saved-modal{background:#111;border:1px solid #1F2937;border-radius:16px;padding:36px 32px;max-width:380px;width:90%;text-align:center;animation:confirmIn .25s ease}
.saved-check{width:56px;height:56px;border-radius:50%;background:rgba(16,185,129,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;border:2px solid rgba(16,185,129,.2)}
.saved-title{font-size:18px;font-weight:800;color:#fff;margin-bottom:6px}
.saved-desc{font-size:13px;color:#6B7280;margin-bottom:24px;line-height:1.5}
.saved-btns{display:flex;flex-direction:column;gap:8px}
.saved-btn-outline{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 0;background:transparent;border:1px solid #2D2D2D;border-radius:10px;color:#a1a1aa;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
.saved-btn-outline:hover{border-color:#FF6B00;color:#FF6B00;background:rgba(255,107,0,.04)}
.saved-btn-solid{padding:12px 0;background:#FF6B00;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s}
.saved-btn-solid:hover{background:#e05e00}

/* ADD OFFER MODAL */
.add-offer-modal{background:#0d0d0d;border:1px solid #1F2937;border-radius:16px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.6);animation:aom-in .2s ease}
@keyframes aom-in{from{opacity:0;transform:scale(.96) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.aom-hd{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 20px;border-bottom:1px solid #1F2937}
.aom-hd-icon{width:40px;height:40px;border-radius:10px;background:rgba(255,107,0,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.aom-title{font-size:17px;font-weight:700;color:#fff;margin:0 0 4px}
.aom-sub{font-size:13px;color:#6B7280;margin:0;line-height:1.4}
.aom-close{width:32px;height:32px;background:transparent;border:1px solid #1F2937;border-radius:8px;color:#6B7280;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.aom-close:hover{border-color:#374151;color:#fff;background:#111}
.aom-body{padding:20px 24px;display:flex;flex-direction:column;gap:18px}
.aom-field{display:flex;flex-direction:column;gap:8px}
.aom-label{font-size:12px;font-weight:600;color:#9CA3AF;letter-spacing:.02em}
.aom-input{background:#111;border:1px solid #1F2937;border-radius:10px;padding:12px 14px;font-family:inherit;font-size:14px;color:#fff;outline:none;transition:all .15s}
.aom-input::placeholder{color:#3F3F46}
.aom-input:focus{border-color:#FF6B00;background:#0a0a0a;box-shadow:0 0 0 3px rgba(255,107,0,.08)}
.aom-hint{display:flex;align-items:center;gap:6px;font-size:12px;color:#52525b;margin:0}
.aom-hint svg{flex-shrink:0;color:#6B7280}
.aom-footer{display:flex;gap:10px;padding:16px 24px 24px;border-top:1px solid #1F2937}
.aom-btn-cancel{flex:1;padding:11px 16px;background:transparent;border:1px solid #1F2937;border-radius:10px;color:#9CA3AF;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.aom-btn-cancel:hover{border-color:#374151;color:#fff;background:#111}
.aom-btn-save{flex:2;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;background:#FF6B00;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.aom-btn-save:hover:not(:disabled){background:#e05e00;box-shadow:0 4px 14px rgba(255,107,0,.25)}
.aom-btn-save:disabled{opacity:.4;cursor:not-allowed}

/* TOAST */
.toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%);
  padding:14px 28px;border-radius:14px;font-size:14px;font-weight:700;z-index:300;
  animation:toastIn .35s var(--ease-spring),toastOut .35s var(--ease-out) 2.7s forwards;
  pointer-events:none;backdrop-filter:blur(20px);letter-spacing:-.01em;
}
.toast-ok{background:linear-gradient(135deg,#10B981,#059669);color:#fff;box-shadow:0 16px 40px rgba(16,185,129,.4),inset 0 1px 0 rgba(255,255,255,.2)}
.toast-err{background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff;box-shadow:0 16px 40px rgba(239,68,68,.4),inset 0 1px 0 rgba(255,255,255,.2)}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(30px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes toastOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(20px)}}

/* EMPTY */
.empty-state{padding:64px 24px;text-align:center;color:var(--text-3);font-size:14px;font-weight:500}

/* ─── ANALYSIS EXPLAINER (landing style) ─── */
.analysis-explainer{max-width:760px;margin:0 auto;padding:0 8px;animation:fadein .5s var(--ease-out)}
.explainer-title{font-size:clamp(20px,3.5vw,28px);font-weight:800;color:var(--text);text-align:center;margin-bottom:6px;letter-spacing:-.03em}
.explainer-subtitle{font-size:14px;color:var(--text-2);text-align:center;margin-bottom:28px;font-weight:300}
.explainer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:rgba(255,255,255,.05);overflow:visible;margin-bottom:24px}
.explainer-card{background:#06080f;padding:28px 22px;text-align:left;position:relative;overflow:hidden;transition:transform .45s cubic-bezier(.16,1,.3,1),box-shadow .45s ease,background .35s ease;cursor:default;z-index:1}
.explainer-card::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.035) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;z-index:0}
.explainer-card::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:1;background:linear-gradient(rgba(255,140,0,.55) 0 0) top left/2px 18px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) top left/18px 2px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) top right/2px 18px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) top right/18px 2px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom left/2px 18px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom left/18px 2px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom right/2px 18px no-repeat,linear-gradient(rgba(255,140,0,.55) 0 0) bottom right/18px 2px no-repeat;transition:opacity .35s ease;opacity:.5}
.explainer-card:hover{transform:scale(1.03);z-index:10;background:#09101f;box-shadow:0 28px 80px rgba(0,0,0,.85),0 0 0 1px rgba(255,140,0,.25)}
.explainer-card:hover::before{opacity:1}
.explainer-icon{margin-bottom:14px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
.explainer-icon::before{content:'';position:absolute;inset:-2px;border-radius:50%;border:2px solid transparent;border-top-color:rgba(255,140,0,.75);border-right-color:rgba(255,140,0,.2);animation:exp-arc-spin 3s linear infinite}
@keyframes exp-arc-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.explainer-card-title{font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px;letter-spacing:-.02em;position:relative;z-index:2}
.explainer-card-desc{font-size:13px;color:#888;line-height:1.75;font-weight:300;position:relative;z-index:2}
.explainer-tip{display:flex;align-items:center;gap:10px;background:rgba(255,140,0,.06);border:1px solid rgba(255,140,0,.18);border-radius:12px;padding:14px 18px;font-size:13px;color:var(--text-2);font-weight:400}
.explainer-tip strong{color:#FF8C00}
@media(max-width:540px){.explainer-grid{grid-template-columns:1fr}}

/* ─── REPORT ─── */
.report-wrap{min-height:100vh;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;overflow-x:hidden}
.report-topbar{display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid #1a1a1e;flex-shrink:0}
.report-back{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid #27272a;border-radius:8px;color:#71717a;padding:6px 12px;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
.report-back:hover{border-color:#3f3f46;color:#e4e4e7}
.report-subtitle{font-size:11px;color:#3f3f46;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}
.report-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:28px 24px;max-width:940px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:32px}
.report-body>*{max-width:100%}
.report-cta-sticky{position:sticky;bottom:0;background:linear-gradient(transparent,#09090b 40%);padding:24px;display:flex;justify-content:center;gap:12px;z-index:10;flex-wrap:wrap}
.cta-pdf-btn{padding:14px 32px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#fff;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;justify-content:center}
.cta-pdf-btn:hover{background:rgba(255,255,255,.12);transform:translateY(-1px)}
.cta-radar-btn{padding:16px 48px;background:#FF6B00;border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;width:100%;max-width:400px;justify-content:center}
.cta-radar-btn:hover{background:#e05e00;transform:translateY(-1px)}
@media print{body *{visibility:hidden}.report-wrap,.report-wrap *{visibility:visible}.report-wrap{position:absolute;left:0;top:0;width:100%;background:#fff;color:#111;padding:20px}.report-cta-sticky,.report-topbar{display:none!important}.rpt-card{border-color:#ddd!important;background:#fafafa!important}.nota-card{background:#f5f5f5!important;color:#111!important}pre{background:#f0f0f0!important;color:#333!important;border-color:#ddd!important}}

/* Nota card */
.nota-card{border-radius:16px;padding:28px 32px;border:1px solid rgba(255,255,255,.06)}
.nota-card.vrd-green{background:linear-gradient(135deg,rgba(34,197,94,.06),rgba(22,163,74,.02));border-color:rgba(34,197,94,.15);color:#22c55e}
.nota-card.vrd-yellow{background:linear-gradient(135deg,rgba(234,179,8,.06),rgba(202,138,4,.02));border-color:rgba(234,179,8,.15);color:#eab308}
.nota-card.vrd-red{background:linear-gradient(135deg,rgba(239,68,68,.06),rgba(185,28,28,.02));border-color:rgba(239,68,68,.15);color:#ef4444}
.nota-badge{display:inline-block;font-size:14px;font-weight:800;padding:6px 18px;border-radius:24px;border:1px solid currentColor;opacity:.9;margin-bottom:20px}
.nota-score-row{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.nota-breakdown{flex:1;display:flex;flex-direction:column;gap:12px;min-width:260px}
.nota-crit{display:flex;flex-direction:column;gap:4px}
.nota-crit-top{display:flex;justify-content:space-between;font-size:12px;color:#a1a1aa}
.nota-crit-pts{font-weight:700;color:currentColor}
.nota-bar{height:6px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}
.nota-bar-fill{height:100%;border-radius:4px;background:currentColor;transition:width .8s cubic-bezier(.16,1,.3,1);opacity:.7}
.nota-bar-na{height:100%;width:100%;border-radius:4px;background:repeating-linear-gradient(90deg,#27272a 0,#27272a 4px,transparent 4px,transparent 8px);opacity:.4}
.nota-crit-desc{font-size:11px;color:#52525b}
.nota-just{font-size:12px;color:#71717a;line-height:1.6;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);white-space:normal;word-wrap:break-word}
@media(max-width:640px){.nota-card{padding:20px}.nota-score-row{gap:16px}}

/* Report section dividers & titles */
.rpt-divider{height:1px;background:#1F2937;margin:8px 0}
.rpt-sec-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.rpt-sec-count{font-size:10px;font-weight:500;color:#4B5563;text-transform:none;letter-spacing:0}
.rpt-sub-lbl{font-size:11px;font-weight:700;color:#a1a1aa;margin-bottom:6px}

/* Script cards */
.scripts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:768px){.scripts-grid{grid-template-columns:1fr}}
.script-card{background:#111;border:1px solid #1F2937;border-radius:12px;overflow:hidden}
.script-hd{padding:12px 16px;background:#18181b;border-bottom:1px solid #1F2937;font-size:13px;font-weight:700;color:#e4e4e7}
.script-section{padding:10px 16px}
.script-section+.script-section{border-top:1px solid #111}
.script-label{font-size:10px;font-weight:700;letter-spacing:.5px;color:#6B7280;margin-bottom:4px}
.script-text{font-size:13px;color:#a1a1aa;line-height:1.5;font-style:italic;white-space:normal;word-wrap:break-word}

/* Orange left border card */
.rpt-card-orange{border-left:3px solid #FF6B00!important}

/* Report sections */
.rpt-section{background:#111113;border:1px solid #1a1a1e;border-radius:12px;overflow:hidden}
.rpt-section-hd{display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid #1a1a1e;cursor:pointer;user-select:none;transition:background .15s}
.rpt-section-hd:hover{background:#18181b}
.rpt-sec-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#52525b}
.rpt-sec-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;margin-left:auto}
.rpt-sec-badge.p1{background:rgba(249,115,22,.1);color:#FF6B00;border:1px solid rgba(249,115,22,.2)}
.rpt-sec-badge.p2{background:rgba(99,102,241,.1);color:#818cf8;border:1px solid rgba(99,102,241,.2)}
.rpt-chevron{color:#3f3f46;font-size:10px;transition:transform .2s;margin-left:8px}
.rpt-chevron.open{transform:rotate(180deg)}
.rpt-section-body{padding:18px}
.rpt-two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rpt-col-card{height:fit-content}
@media(max-width:640px){.rpt-two-col{grid-template-columns:1fr}}
.rpt-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.rpt-grid{grid-template-columns:1fr}}
.rpt-card{background:#09090b;border:1px solid #1a1a1e;border-radius:8px;padding:14px}
.rpt-highlight-card{background:rgba(249,115,22,.04);border:1px solid rgba(249,115,22,.12);border-radius:10px;padding:16px}
.rpt-card-lbl{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#52525b;margin-bottom:6px}
.rpt-card-val{font-size:13px;color:#a1a1aa;line-height:1.6;white-space:normal;word-wrap:break-word}
.rpt-highlight-val{font-size:15px;font-weight:600;color:#e4e4e7;line-height:1.5;white-space:normal;word-wrap:break-word}
.chips-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.rpt-chip{font-size:11px;padding:3px 10px;border-radius:20px;background:#18181b;border:1px solid #27272a;color:#71717a}
.rpt-chip.orange{background:rgba(249,115,22,.08);border-color:rgba(249,115,22,.2);color:#FF6B00}
.rpt-list{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.rpt-list-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#71717a;line-height:1.5}
.rpt-list-item .ic{flex-shrink:0;margin-top:2px;font-size:10px}
.rpt-list-item.weak .ic{color:#ef4444}
.rpt-list-item.strong .ic{color:#22c55e}
.rpt-list-item.info .ic{color:#FF6B00}
.rpt-struct-list{display:flex;flex-direction:column;gap:5px;margin-top:4px}
.rpt-struct-item{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:#09090b;border:1px solid #1a1a1e;border-radius:8px;font-size:12px}
.rpt-struct-pos{width:20px;height:20px;border-radius:5px;background:#18181b;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#52525b;flex-shrink:0}
.rpt-struct-name{font-weight:600;color:#a1a1aa;margin-bottom:2px}
.rpt-struct-copy{font-size:11px;color:#3f3f46;line-height:1.4;font-style:italic;white-space:normal;word-wrap:break-word}
.rpt-struct-qual{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;flex-shrink:0;margin-left:auto}
.rpt-struct-qual.forte{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.rpt-struct-qual.medio{background:rgba(234,179,8,.1);color:#eab308;border:1px solid rgba(234,179,8,.2)}
.rpt-struct-qual.fraco{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.rpt-palette{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px}
.rpt-swatch{width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.06);flex-shrink:0}
.rpt-assets-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-top:8px;scrollbar-width:thin;scrollbar-color:#27272a transparent;max-width:100%}
.rpt-asset-card{flex-shrink:0;width:130px;border-radius:8px;overflow:hidden;border:1px solid #1a1a1e;background:#111113}
.rpt-asset-img-wrap{width:130px;height:100px;overflow:hidden;background:#18181b;display:flex;align-items:center;justify-content:center}
.rpt-asset-img-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.rpt-asset-video-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#18181b}
.rpt-asset-info{padding:5px 7px;display:flex;align-items:center;gap:4px}
.rpt-asset-tipo{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#52525b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rpt-asset-tipo-mockup{color:#FF6B00}
.rpt-asset-tipo-video{color:#818cf8}
.rpt-asset-tipo-foto{color:#22c55e}
.rpt-asset-prio{font-size:9px;font-weight:700;color:#FF6B00;flex-shrink:0}
.rpt-shots-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px}
@media(max-width:600px){.rpt-shots-grid{grid-template-columns:1fr}}
.rpt-shot{border-radius:8px;overflow:hidden;border:1px solid #1F2937}
.rpt-shot img{width:100%;height:160px;object-fit:cover;object-position:top;display:block}
.rpt-shot-lbl{font-size:10px;color:#3f3f46;padding:5px 8px;background:#111113}
.rpt-pontos-fracos{display:flex;flex-direction:column;gap:8px}
.rpt-pf-item{padding:10px 14px;background:#09090b;border:1px solid #1a1a1e;border-radius:8px;display:flex;flex-direction:column;gap:4px}
.rpt-pf-header{display:flex;align-items:center;gap:8px}
.rpt-pf-rank{width:18px;height:18px;border-radius:50%;background:#18181b;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#52525b;flex-shrink:0}
.rpt-pf-prob{font-size:12px;font-weight:600;color:#a1a1aa;flex:1}
.rpt-pf-impact{font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px}
.rpt-pf-impact.alto{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.rpt-pf-impact.medio{background:rgba(234,179,8,.1);color:#eab308;border:1px solid rgba(234,179,8,.2)}
.rpt-pf-impact.baixo{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.rpt-pf-fix{font-size:11px;color:#52525b;line-height:1.5;padding-left:26px}
`
