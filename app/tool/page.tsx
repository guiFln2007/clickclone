'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
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

  // Phase 2 data
  const promessaCentral: string = phase2.promessa_central || phase2.analise_de_copy?.promessa_central || ''
  const fortesPage: string[] = phase2.pontos_fortes_pagina || phase2.elementos_que_funcionam || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fracosPage: { problema: string; impacto: string }[] = phase2.pontos_fracos_pagina || phase2.pontos_fracos || []
  const melhorarPage: string[] = phase2.o_que_melhorar_pagina || []
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

        {/* ══ BLOCO 2 — AN{'\u00C1'}LISE DOS CRIATIVOS ══ */}
        <div className="rpt-divider" />
        <div className="rpt-sec-title">AN{'\u00C1'}LISE DOS CRIATIVOS <span className="rpt-sec-count">{phase1.total_ads_analyzed || '?'} an{'\u00FA'}ncios analisados</span></div>

        {pontosFortes.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">PONTOS FORTES</div><div className="rpt-list">{pontosFortes.map((p, i) => <div key={i} className="rpt-list-item strong"><span className="ic">{'\u2713'}</span><span>{p}</span></div>)}</div></div>}
        {pontosFracos.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">PONTOS FRACOS</div><div className="rpt-list">{pontosFracos.map((p, i) => <div key={i} className="rpt-list-item weak"><span className="ic">{'\u2715'}</span><span>{p}</span></div>)}</div></div>}

        {(modelar.manter?.length > 0 || modelar.corrigir?.length > 0) && (
          <div className="rpt-card rpt-card-orange">
            <div className="rpt-card-lbl">O QUE MODELAR</div>
            {(modelar.manter as string[])?.length > 0 && <><div className="rpt-sub-lbl">Manter:</div><div className="rpt-list">{(modelar.manter as string[]).map((m, i) => <div key={i} className="rpt-list-item info"><span className="ic">{'\u2713'}</span><span>{m}</span></div>)}</div></>}
            {(modelar.corrigir as string[])?.length > 0 && <><div className="rpt-sub-lbl" style={{ marginTop: 12 }}>Corrigir:</div><div className="rpt-list">{(modelar.corrigir as string[]).map((c, i) => <div key={i} className="rpt-list-item weak"><span className="ic">{'\u2715'}</span><span>{c}</span></div>)}</div></>}
          </div>
        )}

        {scripts.length > 0 && (
          <div>
            <div className="rpt-card-lbl" style={{ marginBottom: 12 }}>3 SCRIPTS DE CTV PRONTOS</div>
            <div className="scripts-grid">
              {scripts.map((s, i) => (
                <div key={i} className="script-card">
                  <div className="script-hd">CTV #{s.numero || i + 1} &mdash; {s.formato}</div>
                  <div className="script-section"><div className="script-label">HOOK (0-3s):</div><div className="script-text">&ldquo;{s.hook}&rdquo;</div></div>
                  <div className="script-section"><div className="script-label">CORPO (3-12s):</div><div className="script-text">&ldquo;{s.corpo}&rdquo;</div></div>
                  <div className="script-section"><div className="script-label">CTA (12-15s):</div><div className="script-text">&ldquo;{s.cta}&rdquo;</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ BLOCO 3 — P{'\u00C1'}GINA DE DESTINO ══ */}
        <div className="rpt-divider" />
        <div className="rpt-sec-title">AN{'\u00C1'}LISE DA P{'\u00C1'}GINA DE DESTINO <span className="rpt-sec-count">{phase2.tipo_de_funil || ''}</span></div>

        {promessaCentral && <div className="rpt-card rpt-card-orange"><div className="rpt-card-lbl">PROMESSA CENTRAL</div><div className="rpt-highlight-val">{promessaCentral}</div></div>}
        {fortesPage.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">PONTOS FORTES DA P{'\u00C1'}GINA</div><div className="rpt-list">{fortesPage.map((p, i) => <div key={i} className="rpt-list-item strong"><span className="ic">{'\u2713'}</span><span>{typeof p === 'string' ? p : ''}</span></div>)}</div></div>}
        {fracosPage.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">PONTOS FRACOS DA P{'\u00C1'}GINA</div><div className="rpt-pontos-fracos">{fracosPage.map((pf, i) => <div key={i} className="rpt-pf-item"><div className="rpt-pf-header"><div className="rpt-pf-rank">#{i + 1}</div><div className="rpt-pf-prob">{typeof pf === 'string' ? pf : pf.problema}</div>{typeof pf !== 'string' && pf.impacto && <span className={`rpt-pf-impact ${pf.impacto.toLowerCase()}`}>{pf.impacto}</span>}</div></div>)}</div></div>}
        {melhorarPage.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">O QUE MELHORAR</div><div className="rpt-list">{melhorarPage.map((m, i) => <div key={i} className="rpt-list-item info"><span className="ic">{'\u2192'}</span><span>{m}</span></div>)}</div></div>}

        {/* ══ BLOCO 4 — AN{'\u00C1'}LISE GERAL ══ */}
        <div className="rpt-divider" />
        <div className="rpt-sec-title">AN{'\u00C1'}LISE GERAL DA OFERTA</div>

        {anguloD && <div className="rpt-card rpt-card-orange"><div className="rpt-card-lbl">{'\u00C2'}NGULO DOMINANTE</div><div className="rpt-card-val">{anguloD}</div></div>}
        {usaPraVender.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">O QUE O CONCORRENTE USA PRA VENDER</div><div className="rpt-list">{usaPraVender.map((u, i) => <div key={i} className="rpt-list-item"><span className="ic" style={{ color: '#FF6B00' }}>{'\u2022'}</span><span>{u}</span></div>)}</div></div>}
        {angulosNaoExplorados.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">{'\u00C2'}NGULOS N{'\u00C3'}O EXPLORADOS</div><div className="rpt-list">{angulosNaoExplorados.map((a, i) => <div key={i} className="rpt-list-item info"><span className="ic">{'\u2192'}</span><span>{a}</span></div>)}</div></div>}
      </div>

      {/* CTA STICKY */}
      <div className="report-cta-sticky">
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
  type Tab = 'analise' | 'rastreamento' | 'minerador'
  const [activeTab, setActiveTab] = useState<Tab>('analise')
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
  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
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
      const res1 = await fetch('/api/phase1', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url }) })
      if (res1.status === 402) { setUpgradeModal(true); return }
      if (!res1.ok) { const e = await res1.json().catch(() => ({})); throw new Error(e.error || 'Erro na fase 1') }

      let p1: Record<string, unknown> | null = null
      await readSSE(res1, ev => {
        if (ev.type === 'error') throw new Error(ev.message as string)
        if (ev.type === 'progress') { setTermLines(prev => [...prev, { text: `> ${ev.text}`, type: 'wait' }]); setDashProgress(30) }
        if (ev.type === 'done') { p1 = ev.report as Record<string, unknown>; setTermLines(prev => [...prev, { text: '\u2713 Fase 1 concluida', type: 'done' }]); setDashProgress(50); return true }
        return false
      })
      if (!p1) throw new Error('Fase 1 nao retornou relatorio')
      setPhase1Report(p1)

      const landingUrl = (p1 as Record<string, unknown>).landing_url as string
      if (!landingUrl) throw new Error('URL da pagina nao encontrada')
      setTermLines(prev => [...prev, { text: '> Analisando pagina de destino...', type: 'wait' }])

      const res2 = await fetch('/api/phase2', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: landingUrl, phase1Report: p1 }) })
      if (res2.status === 402) { setUpgradeModal(true); return }
      if (!res2.ok) { const e = await res2.json().catch(() => ({})); throw new Error(e.error || 'Erro na fase 2') }

      let p2: Record<string, unknown> | null = null; let shots: string[] = []
      await readSSE(res2, ev => {
        if (ev.type === 'error') throw new Error(ev.message as string)
        if (ev.type === 'progress') { setTermLines(prev => [...prev, { text: `> ${ev.text}`, type: 'wait' }]); setDashProgress(75) }
        if (ev.type === 'done') { p2 = ev.report as Record<string, unknown>; shots = (ev.screenshots as string[]) || []; setTermLines(prev => [...prev, { text: '\u2713 Fase 2 concluida', type: 'done' }]); setDashProgress(100); return true }
        return false
      })
      if (!p2) throw new Error('Fase 2 nao retornou relatorio')
      setPhase2Report(p2); setPhase2Screenshots(shots)

      // Save to history
      const promessa = ((p2 as Record<string, unknown>).analise_de_copy as Record<string, string> | undefined)?.promessa_central?.split(' ').slice(0, 5).join(' ') || ''
      const record: SavedAnalysis = { id: Date.now().toString(), name: promessa || ((p1 as Record<string, unknown>).angulo_dominante as string) || 'Oferta', score: Number((p1 as Record<string, unknown>).nota_entrada && ((p1 as Record<string, unknown>).nota_entrada as Record<string, number>).score) || 0, url, phase1: p1 as Record<string, unknown>, phase2: p2 as Record<string, unknown>, screenshots: shots.slice(0, 2), createdAt: Date.now() }
      const updated = [record, ...savedAnalyses.filter(a => a.url !== url)].slice(0, 20)
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
    setMining(true); setMineError(''); setMineResults([]); setMineStatus('Conectando ao Meta Ad Library...')
    try {
      // 1. Start the Apify run
      const startRes = await fetch('/api/mine', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ keyword: mineKeyword.trim() }) })
      if (!startRes.ok) { const e = await startRes.json().catch(() => ({})); throw new Error(e.error || 'Erro ao iniciar') }
      const { runId } = await startRes.json()
      if (!runId) throw new Error('Falha ao iniciar busca')

      setMineStatus('Minerando an\u00FAncios no Meta Ad Library...')

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
            <img src="/logo.png" alt="RatoAds" className="header-logo" />
            <span className="header-brand">RatoAds</span>
          </div>
          <nav className="header-tabs">
            {[
              {
                id: 'minerador' as Tab,
                label: 'Minera\u00e7\u00e3o Autom\u00e1tica',
                svg: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 5.5l4 4"/>
                    <path d="M10.5 9.5l-7 7v3h3l7-7"/>
                    <path d="M17.5 8.5l3-3a2.121 2.121 0 0 0-3-3l-3 3"/>
                    <path d="M9.5 8.5L8 7l1.5-1.5L11 7"/>
                  </svg>
                ),
              },
              {
                id: 'analise' as Tab,
                label: 'An\u00e1lise de Biblioteca',
                svg: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                    <path d="M8 11h2"/>
                    <path d="M11 8v6"/>
                    <path d="M13 11h1"/>
                  </svg>
                ),
              },
              {
                id: 'rastreamento' as Tab,
                label: 'Rastreamento de Ofertas',
                svg: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                    <line x1="12" y1="2" x2="12" y2="4"/>
                    <line x1="12" y1="20" x2="12" y2="22"/>
                    <line x1="2" y1="12" x2="4" y2="12"/>
                    <line x1="20" y1="12" x2="22" y2="12"/>
                  </svg>
                ),
                badge: totalAlerts,
              },
            ].map(t => (
              <button key={t.id} className={`header-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
                <span className="tab-icon">{t.svg}</span>
                <span className="tab-label">{t.label}</span>
                {t.badge ? <span className="tab-badge">{t.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="header-right" ref={profileRef}>
            <div className="header-saldo">{analises ?? '\u2014'} analises</div>
            <button className="header-avatar" onClick={() => setProfileOpen(o => !o)}>
              {userName ? userName[0].toUpperCase() : '?'}
            </button>
            {profileOpen && (
              <div className="profile-drop">
                <div className="profile-name">{userName}</div>
                <a href="/settings/plans" className="profile-link">Planos</a>
                <button className="profile-link" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }}>Sair</button>
              </div>
            )}
          </div>
        </header>

        {/* CONTENT */}
        <main className="content">

          {/* ── ABA ANALISE ── */}
          {activeTab === 'analise' && (
            <div className="tab-content">
              <div className="analyze-hero">
                <h1 className="analyze-title">Analise de <span className="acc">Biblioteca</span></h1>
                <p className="analyze-sub">Inteligencia competitiva em segundos</p>
                <form onSubmit={handleAnalyze} className="analyze-form">
                  <div className="analyze-input-wrap">
                    <svg className="analyze-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input className="analyze-input" type="url" placeholder="Cole o link da Ad Library do concorrente..." value={url} onChange={e => setUrl(e.target.value)} />
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <div className="stat-num">{savedAnalyses.length}</div>
                  <div className="stat-label">analises realizadas</div>
                </div>
                <div className="stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <div className="stat-num">{trackedOffers.length}</div>
                  <div className="stat-label">ofertas rastreadas</div>
                </div>
                <div className="stat-card">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <div className="stat-num">{analises ?? '\u2014'}</div>
                  <div className="stat-label">analises restantes</div>
                </div>
              </div>

              {/* Rat Mascot */}
              <RatMascot isAnalyzing={analyzing} />

              {/* Loading status text */}
              {analyzing && (
                <div className="rat-loading-info">
                  <div className="rat-status">{termLines.length > 0 ? termLines[termLines.length - 1].text.replace(/^> /, '').replace(/^\u2713 /, '') : 'Iniciando analise...'}</div>
                  <div className="rat-progress-bar"><div className="rat-progress-fill" style={{ width: `${dashProgress}%` }} /></div>
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
                <div className="empty-state" style={{ marginTop: 0 }}>Nenhuma analise ainda. Cole um link acima para comecar.</div>
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

              {/* Dica Importante banner */}
              <div className="rdr-banner">
                <div className="rdr-banner-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></div>
                <div>
                  <p style={{ color: '#fff', fontWeight: 500, marginBottom: 4 }}>{'\uD83D\uDD52'} Atualiza&ccedil;&atilde;o autom&aacute;tica di&aacute;ria</p>
                  <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 4 }}>Todas as ofertas s&atilde;o atualizadas automaticamente todos os dias &agrave;s <strong style={{ color: '#fff' }}>07:00</strong> (hor&aacute;rio de Bras&iacute;lia).</p>
                  <p style={{ color: '#F59E0B', fontSize: 13 }}>Pr&oacute;xima atualiza&ccedil;&atilde;o: {nextUpdateLabel()}</p>
                </div>
              </div>

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
                <p style={{ color: '#888', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>Filtros usados pelos maiores players do mercado para encontrar ofertas escaladas: <span style={{ color: '#e8a040' }}>10+ an{'\u00FA'}ncios ativos</span>, <span style={{ color: '#e8a040' }}>10+ dias rodando</span> e <span style={{ color: '#e8a040' }}>apenas sites de venda reais</span>.</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                  <button className="mine-btn" onClick={handleMine} disabled={!mineKeyword.trim() || mining}>
                    {mining ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Minerando...</> : <>{'\u26CF\uFE0F'} Minerar Agora</>}
                  </button>
                </div>
                {mineError && <div className="err" style={{ marginTop: 12 }}>{mineError}</div>}
              </div>

              {/* Rat mascot */}
              <RatMascot isAnalyzing={mining} />
              {mining && mineStatus && <div className="mine-status">{mineStatus}</div>}
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
                            <div className="mrc-info">
                              <div className="mrc-name">{o.pagina_nome}</div>
                              <div className="mrc-meta">{o.dias_rodando !== null ? `${o.dias_rodando} dias` : '?'} &middot; {o.total_anuncios} an{'\u00FA'}ncios</div>
                            </div>
                            {o.nicho && <span className="mrc-nicho">{o.nicho}</span>}
                          </div>
                          {o.resumo_angulo && <div className="mrc-angle">{o.resumo_angulo}</div>}
                          <div className="mrc-acts">
                            <a className="mrc-btn-orange" href={o.ad_library_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', textAlign: 'center' }}>Ver Biblioteca</a>
                            <button className="mrc-btn-outline" onClick={() => { setUrl(o.ad_library_url); setActiveTab('analise') }}>Analisar</button>
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
              <h3 className="hist-chart-title">Evolu&ccedil;&atilde;o dos Criativos</h3>
              <div className="hist-chart">
                {(() => {
                  const points = historyView.snapshots.slice().reverse()
                  if (points.length < 1) return <div className="empty-state" style={{ padding: 40 }}>Nenhum dado ainda</div>
                  const max = Math.max(...points.map(p => p.ads_count), 1)
                  const min = Math.min(...points.map(p => p.ads_count))
                  const range = max - min || 1
                  const w = points.length > 1 ? 100 / (points.length - 1) : 50
                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${points.length > 1 ? i * w : 50},${100 - ((p.ads_count - min) / range) * 75 - 12}`).join(' ')
                  const areaD = pathD + ` L${points.length > 1 ? (points.length - 1) * w : 50},100 L0,100 Z`
                  return (
                    <>
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hist-chart-svg">
                        <defs><linearGradient id="hcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B00" stopOpacity=".15"/><stop offset="100%" stopColor="#FF6B00" stopOpacity="0"/></linearGradient></defs>
                        <path d={areaD} fill="url(#hcg)" />
                        <path d={pathD} fill="none" stroke="#FF6B00" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        {points.map((p, i) => <circle key={i} cx={points.length > 1 ? i * w : 50} cy={100 - ((p.ads_count - min) / range) * 75 - 12} r="1.5" fill="#FF6B00" />)}
                      </svg>
                      <div className="hist-chart-labels">{points.map((p, i) => <span key={i}>{new Date(p.registrado_em).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}</span>)}</div>
                    </>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Limite atingido</h2>
            <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>Assine o Pro para continuar analisando.</p>
            <a href="https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9" target="_blank" rel="noreferrer" className="mine-btn" style={{ width: '100%', textAlign: 'center', textDecoration: 'none', display: 'block' }}>Assinar &rarr;</a>
            <button className="btn-outline" style={{ width: '100%', marginTop: 8 }} onClick={() => setUpgradeModal(false)}>Fechar</button>
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:'Inter',system-ui,sans-serif;background:#050507;color:#fafafa;-webkit-font-smoothing:antialiased}

/* GLOBAL ANIM TOKENS */
:root{
  --bg:#050507;
  --bg-elev:#0c0c10;
  --bg-elev-2:#15151b;
  --border:#1c1c24;
  --border-2:#26262f;
  --text:#f5f5f7;
  --text-2:#a1a1aa;
  --text-3:#52525b;
  --accent:#FF6B00;
  --accent-2:#FF8C42;
  --accent-glow:rgba(255,107,0,.18);
  --ease-out:cubic-bezier(.16,1,.3,1);
  --ease-spring:cubic-bezier(.34,1.56,.64,1);
}

/* AMBIENT GRADIENT BG */
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(1200px 600px at 50% -200px,rgba(255,107,0,.08),transparent 60%),
    radial-gradient(800px 400px at 90% 10%,rgba(255,107,0,.04),transparent 70%);
}

/* LAYOUT */
.app{min-height:100vh;display:flex;flex-direction:column;position:relative;z-index:1}

/* HEADER — pill style estilo Motion */
.header{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:18px 32px 0;height:auto;background:transparent;
  position:sticky;top:0;z-index:50;
  backdrop-filter:blur(8px);
}
.header-left{display:flex;align-items:center;gap:10px;flex-shrink:0}
.header-logo{height:36px;width:auto;filter:drop-shadow(0 2px 8px rgba(255,107,0,.2))}
.header-brand{font-size:18px;font-weight:900;color:var(--accent);letter-spacing:-.03em;text-shadow:0 0 24px rgba(255,107,0,.3)}

/* PILL NAV */
.header-tabs{
  display:flex;align-items:center;gap:4px;
  background:rgba(15,15,20,.7);
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);
  padding:6px;border-radius:999px;
  box-shadow:
    0 8px 32px rgba(0,0,0,.4),
    inset 0 1px 0 rgba(255,255,255,.05);
}
.header-tab{
  display:flex;align-items:center;gap:8px;padding:10px 18px;
  border:none;background:transparent;color:var(--text-2);
  font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;
  border-radius:999px;transition:all .35s var(--ease-out);
  white-space:nowrap;position:relative;letter-spacing:-.01em;
}
.header-tab::before{
  content:'';position:absolute;inset:0;border-radius:999px;
  background:linear-gradient(135deg,rgba(255,107,0,.22),rgba(255,107,0,.08));
  opacity:0;transition:opacity .35s var(--ease-out);z-index:-1;
}
.header-tab:hover{color:var(--text)}
.header-tab:hover .tab-icon{transform:scale(1.08);color:var(--text)}
.header-tab.active{
  color:#fff;
  background:linear-gradient(135deg,#FF6B00,#FF8C42);
  box-shadow:
    0 8px 24px rgba(255,107,0,.35),
    0 0 0 1px rgba(255,255,255,.1) inset,
    0 1px 0 rgba(255,255,255,.2) inset;
}
.header-tab.active .tab-icon{color:#fff;transform:scale(1.05)}
.tab-icon{display:flex;align-items:center;color:var(--text-3);transition:all .35s var(--ease-out)}
.tab-label{font-weight:600}
.tab-badge{
  background:#ef4444;color:#fff;font-size:10px;font-weight:800;
  padding:2px 7px;border-radius:999px;min-width:18px;text-align:center;
  box-shadow:0 0 12px rgba(239,68,68,.5);
}
.header-tab.active .tab-badge{background:rgba(0,0,0,.25);box-shadow:none}

/* HEADER RIGHT */
.header-right{display:flex;align-items:center;gap:14px;flex-shrink:0;position:relative}
.header-saldo{
  font-size:12px;color:var(--text-2);font-weight:600;white-space:nowrap;
  padding:8px 14px;background:rgba(15,15,20,.7);border:1px solid rgba(255,255,255,.06);
  border-radius:999px;backdrop-filter:blur(20px);
}
.header-avatar{
  width:38px;height:38px;border-radius:50%;
  background:linear-gradient(135deg,#FF6B00,#FF8C42);
  border:2px solid rgba(255,255,255,.1);color:#fff;font-weight:800;font-size:14px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 16px rgba(255,107,0,.3);transition:transform .3s var(--ease-spring);
}
.header-avatar:hover{transform:scale(1.06)}
.profile-drop{
  position:absolute;top:calc(100% + 12px);right:0;
  background:rgba(15,15,20,.95);border:1px solid var(--border-2);
  border-radius:14px;padding:10px;min-width:180px;z-index:100;
  backdrop-filter:blur(20px);box-shadow:0 16px 40px rgba(0,0,0,.6);
  animation:dropIn .25s var(--ease-out);
}
@keyframes dropIn{from{opacity:0;transform:translateY(-6px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.profile-name{padding:10px 12px;font-size:13px;font-weight:700;color:var(--text);border-bottom:1px solid var(--border);margin-bottom:6px}
.profile-link{display:block;width:100%;text-align:left;padding:9px 12px;border:none;background:transparent;color:var(--text-2);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;border-radius:8px;transition:all .15s;text-decoration:none}
.profile-link:hover{background:var(--bg-elev-2);color:var(--text)}
@media(max-width:900px){
  .header{padding:14px 16px 0;flex-wrap:wrap}
  .header-tabs{order:3;width:100%;justify-content:center;margin-top:12px}
  .tab-label{display:none}
  .header-tab{padding:10px 14px}
}

/* CONTENT */
.content{flex:1;overflow-y:auto;animation:contentFade .45s var(--ease-out)}
@keyframes contentFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.tab-content{max-width:1000px;margin:0 auto;padding:48px 32px 100px}
@media(max-width:768px){.tab-content{padding:32px 16px 80px}}

/* ANALYZE */
.analyze-hero{text-align:center;margin-bottom:32px;animation:contentFade .5s var(--ease-out)}
.analyze-title{font-size:clamp(32px,4vw,48px);font-weight:900;letter-spacing:-.04em;margin-bottom:10px;background:linear-gradient(180deg,#fff 0%,#a1a1aa 100%);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.1}
.acc{background:linear-gradient(135deg,#FF6B00,#FFA94D);-webkit-background-clip:text;background-clip:text;color:transparent}
.analyze-sub{font-size:15px;color:var(--text-2);margin-bottom:32px;font-weight:500}

.analyze-form{display:flex;gap:10px;max-width:720px;margin:0 auto}
.analyze-input-wrap{
  flex:1;display:flex;align-items:center;gap:12px;
  background:rgba(15,15,20,.6);border:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(20px);border-radius:14px;padding:0 18px;
  transition:all .35s var(--ease-out);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
}
.analyze-input-wrap:focus-within{
  border-color:rgba(255,107,0,.5);
  box-shadow:0 0 0 4px rgba(255,107,0,.1),0 8px 32px rgba(255,107,0,.15),inset 0 1px 0 rgba(255,255,255,.04);
  background:rgba(20,20,28,.8);
}
.analyze-input-icon{flex-shrink:0;color:var(--text-3);transition:color .3s}
.analyze-input-wrap:focus-within .analyze-input-icon{color:var(--accent)}
.analyze-input{flex:1;background:transparent;border:none;padding:16px 0;font-family:inherit;font-size:14px;color:var(--text);outline:none;font-weight:500}
.analyze-input::placeholder{color:var(--text-3)}
.analyze-btn{
  padding:0 28px;background:linear-gradient(135deg,#FF6B00,#FF8C42);
  border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:14px;
  font-weight:800;cursor:pointer;transition:all .3s var(--ease-out);
  white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:8px;
  box-shadow:
    0 8px 24px rgba(255,107,0,.35),
    0 0 0 1px rgba(255,255,255,.1) inset,
    0 1px 0 rgba(255,255,255,.2) inset;
  letter-spacing:-.01em;
}
.analyze-btn:hover:not(:disabled){
  transform:translateY(-1px);
  box-shadow:0 12px 32px rgba(255,107,0,.45),0 0 0 1px rgba(255,255,255,.15) inset,0 1px 0 rgba(255,255,255,.25) inset;
}
.analyze-btn:active:not(:disabled){transform:translateY(0)}
.analyze-btn:disabled{opacity:.4;cursor:not-allowed}

/* STATS */
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:720px;margin:24px auto 8px}
@media(max-width:500px){.stats-row{grid-template-columns:1fr}}
.stat-card{
  background:linear-gradient(180deg,rgba(20,20,28,.6),rgba(15,15,20,.4));
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:16px;padding:18px 22px;display:flex;align-items:center;gap:14px;
  transition:all .35s var(--ease-out);position:relative;overflow:hidden;
}
.stat-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,107,0,.04),transparent);
  opacity:0;transition:opacity .35s;
}
.stat-card:hover{transform:translateY(-2px);border-color:rgba(255,107,0,.18)}
.stat-card:hover::before{opacity:1}
.stat-card svg{flex-shrink:0;position:relative;z-index:1}
.stat-num{font-size:24px;font-weight:900;color:#fff;position:relative;z-index:1;letter-spacing:-.02em}
.stat-label{font-size:11px;color:var(--text-3);line-height:1.3;font-weight:500;position:relative;z-index:1}

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

/* RAT LOADING */
.rat-loading-info{display:flex;flex-direction:column;align-items:center;gap:14px;padding:0 20px 28px;max-width:420px;margin:0 auto}
.rat-status{font-size:14px;color:var(--text-2);text-align:center;min-height:22px;animation:fadein .35s var(--ease-out);font-weight:500}
.rat-progress-bar{width:300px;height:6px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden}
.rat-progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:999px;transition:width .6s var(--ease-out);box-shadow:0 0 16px rgba(255,107,0,.4)}

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
  display:flex;align-items:center;gap:14px;padding:14px 18px;
  background:linear-gradient(180deg,rgba(20,20,28,.5),rgba(15,15,20,.3));
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:14px;cursor:pointer;
  transition:all .35s var(--ease-out);
  position:relative;overflow:hidden;
}
.history-card::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(180deg,var(--accent),transparent);
  opacity:0;transition:opacity .35s;
}
.history-card:hover{
  border-color:rgba(255,107,0,.25);
  background:linear-gradient(180deg,rgba(25,25,35,.7),rgba(20,20,28,.5));
  transform:translateX(4px);
}
.history-card:hover::before{opacity:1}
.hc-score{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;flex-shrink:0;letter-spacing:-.02em}
.hc-score.green{background:linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.06));color:#22c55e;border:1px solid rgba(34,197,94,.2);box-shadow:0 0 16px rgba(34,197,94,.1)}
.hc-score.yellow{background:linear-gradient(135deg,rgba(234,179,8,.18),rgba(234,179,8,.06));color:#eab308;border:1px solid rgba(234,179,8,.2);box-shadow:0 0 16px rgba(234,179,8,.1)}
.hc-score.red{background:linear-gradient(135deg,rgba(239,68,68,.18),rgba(239,68,68,.06));color:#ef4444;border:1px solid rgba(239,68,68,.2);box-shadow:0 0 16px rgba(239,68,68,.1)}
.hc-info{flex:1;min-width:0}
.hc-name{font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em}
.hc-meta{font-size:12px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}

/* ═══ RADAR — full width ═══ */
.rdr-full{max-width:1280px!important;padding:48px 32px 100px!important;margin:0 auto}
@media(max-width:768px){.rdr-full{padding:32px 16px 80px!important}}
.rdr-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:28px;flex-wrap:wrap;animation:contentFade .45s var(--ease-out)}
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
.rdr-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
@media(max-width:768px){.rdr-metrics{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.rdr-metrics{grid-template-columns:1fr}}
.rdr-mc{
  background:linear-gradient(180deg,rgba(20,20,28,.6),rgba(15,15,20,.4));
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:18px;padding:22px 26px;
  transition:all .35s var(--ease-out);position:relative;overflow:hidden;
}
.rdr-mc::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,107,0,.3),transparent);
  opacity:0;transition:opacity .35s;
}
.rdr-mc:hover{transform:translateY(-3px);border-color:rgba(255,107,0,.18);box-shadow:0 16px 40px rgba(0,0,0,.3)}
.rdr-mc:hover::before{opacity:1}
.rdr-mc-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.rdr-mc-label{font-size:12px;color:var(--text-3);font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.rdr-mc-ic{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rdr-mc-val{font-size:44px;font-weight:900;color:#fff;line-height:1;letter-spacing:-.04em}

/* Card grid */
.rdr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
@media(max-width:1100px){.rdr-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.rdr-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.rdr-grid{grid-template-columns:1fr}}

/* Offer card */
.rc{
  background:linear-gradient(180deg,rgba(20,20,28,.6),rgba(15,15,20,.4));
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:18px;padding:18px;
  transition:all .4s var(--ease-out);position:relative;overflow:hidden;
  animation:fadein .4s var(--ease-out);
}
.rc::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,107,0,.4),transparent);
  opacity:0;transition:opacity .4s;
}
.rc:hover{
  transform:translateY(-4px);
  border-color:rgba(255,107,0,.25);
  box-shadow:0 24px 48px rgba(0,0,0,.4),0 0 0 1px rgba(255,107,0,.05);
}
.rc:hover::before{opacity:1}
.rc-hd{display:flex;align-items:flex-start;gap:11px;margin-bottom:16px}
.rc-fb{
  width:34px;height:34px;border-radius:10px;
  background:linear-gradient(135deg,#1877F2,#0c5fc4);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  box-shadow:0 4px 12px rgba(24,119,242,.3);
}
.rc-del{position:absolute;top:14px;right:14px;background:transparent;border:none;color:var(--text-3);cursor:pointer;padding:7px;border-radius:8px;transition:all .2s;display:flex;align-items:center;z-index:2}
.rc-del:hover{color:#EF4444;background:rgba(239,68,68,.1)}
.rc-hd-info{flex:1;min-width:0}
.rc-name{font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em}
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
  background:rgba(15,15,20,.6);
  border:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(20px);
  border-radius:20px;padding:28px;
  box-shadow:0 16px 40px rgba(0,0,0,.3);
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
  padding:14px 32px;background:linear-gradient(135deg,#FF6B00,#FF8C42);
  border:none;border-radius:14px;color:#fff;font-family:inherit;font-size:14px;
  font-weight:800;cursor:pointer;transition:all .3s var(--ease-out);
  display:inline-flex;align-items:center;gap:10px;letter-spacing:-.01em;
  box-shadow:0 8px 24px rgba(255,107,0,.35),inset 0 1px 0 rgba(255,255,255,.2);
}
.mine-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 12px 32px rgba(255,107,0,.45),inset 0 1px 0 rgba(255,255,255,.25)}
.mine-btn:disabled{opacity:.4;cursor:not-allowed}

/* Minerador hero */
.mine-hero{text-align:center;margin-bottom:32px;animation:contentFade .5s var(--ease-out)}
.mine-title{font-size:clamp(32px,4vw,48px);font-weight:900;letter-spacing:-.04em;margin-bottom:10px;background:linear-gradient(180deg,#fff 0%,#a1a1aa 100%);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.1}
.mine-sub{font-size:15px;color:var(--text-2);font-weight:500}
.mine-status{text-align:center;font-size:14px;color:var(--text-2);margin-top:-12px;margin-bottom:18px;animation:fadein .35s var(--ease-out);font-weight:500}
.mine-hint{text-align:center;font-size:13px;color:var(--text-3);margin-top:-12px;margin-bottom:18px;font-weight:500}
.mine-results-wrap{margin-top:12px}
.mine-results{display:flex;flex-direction:column;gap:14px}
.mrc{
  background:linear-gradient(180deg,rgba(20,20,28,.6),rgba(15,15,20,.4));
  border:1px solid rgba(255,255,255,.06);
  backdrop-filter:blur(20px);
  border-radius:18px;padding:22px;
  transition:all .4s var(--ease-out);position:relative;overflow:hidden;
  animation:fadein .4s var(--ease-out);
}
.mrc::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(180deg,var(--accent),transparent);
  opacity:0;transition:opacity .4s;
}
.mrc:hover{
  transform:translateY(-3px);
  border-color:rgba(255,107,0,.25);
  box-shadow:0 16px 40px rgba(0,0,0,.3);
}
.mrc:hover::before{opacity:1}
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

/* ─── REPORT ─── */
.report-wrap{min-height:100vh;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column;overflow-x:hidden}
.report-topbar{display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid #1a1a1e;flex-shrink:0}
.report-back{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid #27272a;border-radius:8px;color:#71717a;padding:6px 12px;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
.report-back:hover{border-color:#3f3f46;color:#e4e4e7}
.report-subtitle{font-size:11px;color:#3f3f46;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}
.report-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:28px 24px;max-width:940px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:32px}
.report-body>*{max-width:100%}
.report-cta-sticky{position:sticky;bottom:0;background:linear-gradient(transparent,#09090b 40%);padding:24px;display:flex;justify-content:center;z-index:10}
.cta-radar-btn{padding:16px 48px;background:#FF6B00;border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:8px;width:100%;max-width:400px;justify-content:center}
.cta-radar-btn:hover{background:#e05e00;transform:translateY(-1px)}

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
