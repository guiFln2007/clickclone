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

function ReportView({ phase1, phase2, screenshots, onBack, onSaveToRadar }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  phase1: Record<string, any>; phase2: Record<string, any>; screenshots: string[]
  onBack: () => void; onSaveToRadar: () => void
}) {
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
  const r = 40, circ = 2 * Math.PI * r, dash = (score / 10) * circ
  const verdict = score >= 7 ? { label: 'Vale Entrar', icon: '\u2713', cls: 'vrd-green', desc: 'Mercado validado com bom potencial' }
    : score >= 5 ? { label: 'Com Cuidado', icon: '\u26A0', cls: 'vrd-yellow', desc: 'Mercado funciona mas tem barreiras' }
    : { label: 'Evitar', icon: '\u2715', cls: 'vrd-red', desc: 'Risco elevado - mercado dificil' }

  return (
    <div className="report-wrap">
      <div className="report-topbar">
        <button className="report-back" onClick={onBack}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <span className="report-subtitle">{phase2.url_analisada || ''}</span>
      </div>
      <div className="report-body">
        {/* VEREDICTO */}
        <div className={`vrd-hero ${verdict.cls}`}>
          <div className="vrd-left">
            <div className="vrd-icon">{verdict.icon}</div>
            <div>
              <div className="vrd-label">{verdict.label}</div>
              <div className="vrd-desc">{verdict.desc}</div>
            </div>
          </div>
          <div className="vrd-right">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
              <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.16,1,.3,1)' }} />
              <text x="50" y="54" textAnchor="middle" fill="currentColor" fontSize="24" fontWeight="900">{score}</text>
              <text x="50" y="66" textAnchor="middle" fill="currentColor" fontSize="11" opacity=".5">/10</text>
            </svg>
            <div className="vrd-bars">
              <div className="vrd-bar-row"><span className="vrd-bar-lbl">Facilidade</span><div className="vrd-bar-track"><div className="vrd-bar-fill" style={{ width: `${(facilidade / 5) * 100}%` }} /></div><span className="vrd-bar-num">{facilidade}<span style={{ opacity: .4 }}>/5</span></span></div>
              <div className="vrd-bar-row"><span className="vrd-bar-lbl">Escalabilidade</span><div className="vrd-bar-track"><div className="vrd-bar-fill" style={{ width: `${(escalabilidade / 5) * 100}%` }} /></div><span className="vrd-bar-num">{escalabilidade}<span style={{ opacity: .4 }}>/5</span></span></div>
              {nota.justificativa && <div className="vrd-just">{nota.justificativa}</div>}
            </div>
          </div>
        </div>

        {/* FASE 1 */}
        <ReportSection label="Anuncios" badge="Meta Ad Library" badgeCls="p1">
          {phase1.angulo_dominante && <div className="rpt-highlight-card"><div className="rpt-card-lbl">Angulo dominante</div><div className="rpt-highlight-val">{phase1.angulo_dominante}</div></div>}
          <div className="rpt-grid" style={{ marginTop: 12 }}>
            {formatos.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">Formatos validados</div><div className="chips-row">{formatos.map((f, i) => <span key={i} className="rpt-chip orange">{f}</span>)}</div></div>}
            {copyPatterns.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">Copy patterns</div><div className="chips-row">{copyPatterns.map((p, i) => <span key={i} className="rpt-chip">{p}</span>)}</div></div>}
            {pontosFragosCriativos.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">Fraquezas criativas</div><div className="rpt-list" style={{ marginTop: 0 }}>{pontosFragosCriativos.map((w, i) => <div key={i} className="rpt-list-item weak"><span className="ic">&times;</span><span>{w}</span></div>)}</div></div>}
            {(phase1.sugestoes_criativos || []).length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">Sugestoes de criativos</div><div className="rpt-list" style={{ marginTop: 0 }}>{(phase1.sugestoes_criativos as string[]).map((s, i) => <div key={i} className="rpt-list-item info"><span className="ic">&rarr;</span><span>{s}</span></div>)}</div></div>}
          </div>
        </ReportSection>

        {/* FASE 2 */}
        <ReportSection label="Pagina de destino" badge={phase2.tipo_de_funil || 'pagina'} badgeCls="p2">
          {analise.promessa_central && <div className="rpt-highlight-card" style={{ marginBottom: 12 }}><div className="rpt-card-lbl">Promessa central</div><div className="rpt-highlight-val">{analise.promessa_central}</div></div>}
          <div className="rpt-grid" style={{ marginBottom: 14 }}>
            {analise.mecanismo_de_dor && <div className="rpt-card"><div className="rpt-card-lbl">Mecanismo de dor</div><div className="rpt-card-val">{analise.mecanismo_de_dor}</div></div>}
            {analise.gap_anuncio_pagina && <div className="rpt-card"><div className="rpt-card-lbl">Gap anuncio &rarr; pagina</div><div className="rpt-card-val">{analise.gap_anuncio_pagina}</div></div>}
            <div className="rpt-card"><div className="rpt-card-lbl">Linguagem / Tom</div><div className="chips-row" style={{ marginTop: 4 }}>{analise.linguagem && <span className="rpt-chip">{analise.linguagem}</span>}{design.tom_visual && <span className="rpt-chip orange">{design.tom_visual}</span>}</div></div>
            {paleta.length > 0 && <div className="rpt-card"><div className="rpt-card-lbl">Paleta</div><div className="rpt-palette" style={{ marginTop: 6 }}>{paleta.map((c, i) => <div key={i} className="rpt-swatch" style={{ background: c }} title={c} />)}</div></div>}
          </div>
          {(analise.palavras_gatilho || []).length > 0 && <div style={{ marginBottom: 14 }}><div className="rpt-card-lbl" style={{ marginBottom: 6 }}>Palavras-gatilho</div><div className="chips-row">{(analise.palavras_gatilho as string[]).map((w, i) => <span key={i} className="rpt-chip orange">{w}</span>)}</div></div>}
          {estrutura.length > 0 && <div><div className="rpt-card-lbl" style={{ marginBottom: 8 }}>Estrutura - {estrutura.length} secoes</div><div className="rpt-struct-list">{estrutura.map((sec, i) => <div key={i} className="rpt-struct-item"><div className="rpt-struct-pos">{sec.posicao as number}</div><div style={{ flex: 1, minWidth: 0 }}><div className="rpt-struct-name">{sec.nome as string}</div>{sec.copy_principal && <div className="rpt-struct-copy">&ldquo;{sec.copy_principal as string}&rdquo;</div>}</div><span className={`rpt-struct-qual ${(sec.qualidade as string) || ''}`}>{sec.qualidade as string}</span></div>)}</div></div>}
        </ReportSection>

        {/* PONTOS FORTES / FRACOS */}
        {(pontosFracos.length > 0 || elementosFuncionam.length > 0) && (
          <div className="rpt-two-col">
            {elementosFuncionam.length > 0 && <div className="rpt-section rpt-col-card"><div className="rpt-section-hd" style={{ cursor: 'default' }}><span className="rpt-sec-label">O que funciona</span><span className="rpt-sec-badge" style={{ background: 'rgba(34,197,94,.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,.2)' }}>{elementosFuncionam.length}</span></div><div className="rpt-section-body"><div className="rpt-list" style={{ marginTop: 0 }}>{elementosFuncionam.map((e, i) => <div key={i} className="rpt-list-item strong"><span className="ic">&check;</span><span>{e}</span></div>)}</div></div></div>}
            {pontosFracos.length > 0 && <div className="rpt-section rpt-col-card"><div className="rpt-section-hd" style={{ cursor: 'default' }}><span className="rpt-sec-label">Pontos fracos</span><span className="rpt-sec-badge" style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)' }}>{pontosFracos.length}</span></div><div className="rpt-section-body"><div className="rpt-pontos-fracos">{pontosFracos.map((pf, i) => <div key={i} className="rpt-pf-item"><div className="rpt-pf-header"><div className="rpt-pf-rank">#{(pf.rank as number) || i + 1}</div><div className="rpt-pf-prob">{pf.problema as string}</div><span className={`rpt-pf-impact ${(pf.impacto as string || '').toLowerCase()}`}>{pf.impacto as string}</span></div>{pf.como_corrigir && <div className="rpt-pf-fix">{pf.como_corrigir as string}</div>}</div>)}</div></div></div>}
          </div>
        )}

        {/* ASSETS */}
        {((phase2.assets_classificados as Record<string, unknown>[] | undefined) || []).filter(a => a.url && typeof a.url === 'string' && (a.url as string).startsWith('http')).length > 0 && (
          <ReportSection label="Assets do Funil" badge={`${((phase2.assets_classificados as Record<string, unknown>[]) || []).filter(a => (a.url as string || '').startsWith('http')).length}`} badgeCls="p2">
            <div className="rpt-assets-scroll">
              {((phase2.assets_classificados as Record<string, unknown>[]) || []).filter(a => (a.url as string || '').startsWith('http')).map((a, i) => (
                <div key={i} className="rpt-asset-card">
                  <div className="rpt-asset-img-wrap">{(a.tipo as string || '').startsWith('video') ? <div className="rpt-asset-video-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5"><polygon points="5 3 19 12 5 21"/></svg></div> : <img src={a.url as string} alt="" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />}</div>
                  <div className="rpt-asset-info"><span className={`rpt-asset-tipo rpt-asset-tipo-${(a.tipo as string || '').split('_')[0]}`}>{(a.tipo as string || '').replace(/_/g, ' ')}</span>{(a.prioridade as string) === 'alta' && <span className="rpt-asset-prio">&starf;</span>}</div>
                </div>
              ))}
            </div>
          </ReportSection>
        )}

        {/* SCREENSHOTS */}
        {screenshots.length > 0 && <ReportSection label={`Screenshots - ${screenshots.length}`}><div className="rpt-shots-scroll">{screenshots.map((s, i) => <div key={i} className="rpt-shot"><img src={`data:image/jpeg;base64,${s}`} alt="" /><div className="rpt-shot-lbl">{i === screenshots.length - 1 ? 'Mobile' : `Secao ${i + 1}`}</div></div>)}</div></ReportSection>}
      </div>

      {/* CTA */}
      <div className="report-cta-wrap">
        <button className="cta-radar-btn" onClick={onSaveToRadar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
          Salvar no Radar
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
  const [alertsModal, setAlertsModal] = useState<{ offer: TrackedOffer; alerts: OfferAlert[] } | null>(null)
  const [addOfferModal, setAddOfferModal] = useState(false)
  const [newOfferName, setNewOfferName] = useState('')
  const [newOfferUrl, setNewOfferUrl] = useState('')
  const [newOfferNicho, setNewOfferNicho] = useState('')
  const [totalAlerts, setTotalAlerts] = useState(0)

  // Mine
  const [mineNicho, setMineNicho] = useState('')
  const [mineMinAds, setMineMinAds] = useState(20)
  const [mineMinDays, setMineMinDays] = useState(15)
  const [mining, setMining] = useState(false)
  const [mineResults, setMineResults] = useState<MineResult[]>([])
  const [mineError, setMineError] = useState('')

  // Auth
  const [userId, setUserId] = useState<number | null>(null)
  const [userName, setUserName] = useState('')
  const [analises, setAnalises] = useState<number | null>(null)
  const [upgradeModal, setUpgradeModal] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const nichos = ['Relacionamento', 'Financas', 'Emagrecimento', 'Espiritualidade', 'Maternidade', 'Carreira', 'Saude', 'Beleza']

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
  async function saveToRadar() {
    if (!phase1Report || !phase2Report) return
    if (userId) {
      try {
        await fetch('/api/radar', { method: 'POST', headers: authHeaders(), body: JSON.stringify({
          pagina_nome: phase2Report.analise_de_copy?.promessa_central?.split(' ').slice(0, 5).join(' ') || phase1Report.angulo_dominante || 'Oferta',
          ad_library_url: url, landing_url: phase1Report.landing_url || null,
          nicho: phase1Report.nota_entrada?.nicho || null,
          snapshot_ads: phase1Report.ad_analysis?.total_ads || null,
          snapshot_data: { phase1: phase1Report, phase2: phase2Report },
        }) })
        await loadRadar()
        alert('Salvo no Radar!')
      } catch { alert('Erro ao salvar') }
    }
  }

  // ── RADAR ACTIONS ──
  async function addOfferManual() {
    if (!newOfferName || !newOfferUrl || !userId) return
    await fetch('/api/radar', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ pagina_nome: newOfferName, ad_library_url: newOfferUrl, nicho: newOfferNicho || null }) })
    setAddOfferModal(false); setNewOfferName(''); setNewOfferUrl(''); setNewOfferNicho('')
    await loadRadar()
  }

  async function viewAlerts(offer: TrackedOffer) {
    try {
      const res = await fetch(`/api/radar/${offer.id}/alerts`, { headers: { 'x-user-id': String(userId) } })
      const data = res.ok ? await res.json() : { alerts: [] }
      setAlertsModal({ offer, alerts: data.alerts || [] })
      // Mark as read
      if (offer.alertas_nao_lidos > 0) {
        await fetch(`/api/radar/${offer.id}/read`, { method: 'PATCH', headers: authHeaders() })
        await loadRadar()
      }
    } catch { setAlertsModal({ offer, alerts: [] }) }
  }

  async function removeFromRadar(id: string) {
    await fetch('/api/radar', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ id }) })
    await loadRadar()
  }

  // ── MINE ──
  async function handleMine() {
    if (!mineNicho || mining) return
    setMining(true); setMineError(''); setMineResults([])
    try {
      const res = await fetch('/api/mine', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ nicho: mineNicho, min_ads: mineMinAds, min_days: mineMinDays }) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Erro') }
      const data = await res.json()
      setMineResults(data.ofertas || [])
    } catch (err) { setMineError(err instanceof Error ? err.message : 'Erro') } finally { setMining(false) }
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

  const countByStatus = {
    total: trackedOffers.length,
    escalando: trackedOffers.filter(o => o.status === 'escalando').length,
    caindo: trackedOffers.filter(o => o.status === 'caindo' || o.status === 'morta').length,
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
        <ReportView phase1={phase1Report} phase2={phase2Report} screenshots={phase2Screenshots} onBack={() => setShowReport(false)} onSaveToRadar={saveToRadar} />
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
              { id: 'analise' as Tab, label: 'Analise de Biblioteca', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> },
              { id: 'rastreamento' as Tab, label: 'Rastreamento', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>, badge: totalAlerts },
              { id: 'minerador' as Tab, label: 'Minerador', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> },
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
                        <div key={a.id} className="history-card" onClick={() => openSavedAnalysis(a)}>
                          <div className={`hc-score ${cls}`}>{a.score || '?'}</div>
                          <div className="hc-info">
                            <div className="hc-name">{a.name}</div>
                            <div className="hc-meta">{timeAgo(a.createdAt)} &middot; {(a.phase1.angulo_dominante as string || '').slice(0, 40)}</div>
                          </div>
                          <button className="hc-btn">Ver relatorio</button>
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
            <div className="tab-content">
              {/* Header: search + actions */}
              <div className="rdr-header">
                <div className="rdr-search-wrap">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input className="rdr-search" placeholder="Buscar por nome ou URL..." value={radarSearch} onChange={e => setRadarSearch(e.target.value)} />
                </div>
                <div className="rdr-actions">
                  <button className="rdr-btn-outline" onClick={loadRadar}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    Atualizar Todas
                  </button>
                  <button className="rdr-btn-orange" onClick={() => setAddOfferModal(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Adicionar Oferta
                  </button>
                </div>
              </div>

              {/* 4 Metric cards */}
              <div className="rdr-metrics">
                <div className="rdr-metric-card">
                  <div className="rdr-mc-top"><span className="rdr-mc-label">Total de Ofertas</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
                  <div className="rdr-mc-num">{countByStatus.total}</div>
                </div>
                <div className="rdr-metric-card">
                  <div className="rdr-mc-top"><span className="rdr-mc-label">Ofertas Escalando</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg></div>
                  <div className="rdr-mc-num" style={{ color: '#22c55e' }}>{countByStatus.escalando}</div>
                </div>
                <div className="rdr-metric-card">
                  <div className="rdr-mc-top"><span className="rdr-mc-label">Ofertas em Regressao</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg></div>
                  <div className="rdr-mc-num" style={{ color: '#ef4444' }}>{countByStatus.caindo}</div>
                </div>
                <div className="rdr-metric-card">
                  <div className="rdr-mc-top"><span className="rdr-mc-label">Ultima Atualizacao</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B00" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></div>
                  <div className="rdr-mc-num">{lastUpdate ? new Date(lastUpdate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '--/--'}</div>
                </div>
              </div>

              {/* Offer cards grid */}
              {filteredOffers.length > 0 ? (
                <div className="rdr-grid">
                  {filteredOffers.map(o => {
                    const ads = o.ultimo_snapshot_ads ?? 0
                    const initial = o.primeiro_snapshot_ads ?? ads
                    const diff = ads - initial
                    const pct = initial > 0 ? ((diff / initial) * 100).toFixed(1) : '0.0'
                    const pctNum = parseFloat(pct)
                    const statusCls = o.status === 'escalando' ? 'esc' : o.status === 'caindo' ? 'caindo' : o.status === 'morta' ? 'morta' : 'estavel'
                    const statusTxt = o.status === 'escalando' ? 'Escalando' : o.status === 'caindo' ? 'Caindo' : o.status === 'morta' ? 'Morta' : 'Estavel'
                    return (
                      <div key={o.id} className="rdr-card">
                        <span className={`rdr-card-status rdr-st-${statusCls}`}>{statusTxt}</span>
                        {/* Card header */}
                        <div className="rdr-card-hd">
                          <div className="rdr-fb-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          </div>
                          <div className="rdr-card-info">
                            <div className="rdr-card-name">{o.pagina_nome}</div>
                            <div className="rdr-card-url">{o.ad_library_url.replace(/^https?:\/\//, '').slice(0, 35)}...</div>
                          </div>
                        </div>
                        {/* Metrics row */}
                        <div className="rdr-card-metrics">
                          <div className="rdr-cm">
                            <div className="rdr-cm-label">Total Hoje:</div>
                            <div className="rdr-cm-num">{ads}</div>
                            <span className={`rdr-cm-badge ${pctNum > 0 ? 'up' : pctNum < 0 ? 'down' : 'flat'}`}>{pctNum > 0 ? '+' : ''}{pct}% de variacao</span>
                          </div>
                          <div className="rdr-cm">
                            <div className="rdr-cm-label">Primeiro registro:</div>
                            <div className="rdr-cm-num">{initial}</div>
                            <span className="rdr-cm-date">{new Date(o.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                          </div>
                        </div>
                        {/* Variation rows */}
                        <div className="rdr-card-vars">
                          <div className="rdr-var-row">
                            <span className="rdr-var-label">Variacao diaria:</span>
                            <span className={`rdr-var-val ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>{diff > 0 ? '+' : ''}{diff} anuncios <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={diff >= 0 ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'}/></svg></span>
                          </div>
                          <div className="rdr-var-row">
                            <span className="rdr-var-label">Variacao semanal:</span>
                            <span className={`rdr-var-val ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>{diff > 0 ? '+' : ''}{diff} anuncios <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={diff >= 0 ? 'M7 17l5-5 5 5' : 'M7 7l5 5 5-5'}/></svg></span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="rdr-card-actions">
                          <button className="rdr-history-btn" onClick={() => viewAlerts(o)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            Ver Historico
                          </button>
                          <button className="rdr-refresh-btn" onClick={loadRadar} title="Atualizar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  {radarSearch ? 'Nenhuma oferta encontrada.' : 'Nenhuma oferta no radar. Analise uma oferta e clique em "Salvar no Radar".'}
                </div>
              )}
            </div>
          )}

          {/* ── ABA MINERADOR ── */}
          {activeTab === 'minerador' && (
            <div className="tab-content">
              <h1 style={{ marginBottom: 24 }}>Minerador Automatico</h1>
              <div className="mine-filters">
                <div className="rpt-card-lbl" style={{ marginBottom: 10 }}>Nicho</div>
                <div className="mine-nichos">
                  {nichos.map(n => (
                    <button key={n} className={`nicho-btn${mineNicho === n.toLowerCase() ? ' active' : ''}`} onClick={() => setMineNicho(n.toLowerCase())}>{n}</button>
                  ))}
                </div>
                <div className="mine-advanced">
                  <div>
                    <div className="rpt-card-lbl" style={{ marginBottom: 6 }}>Min. anuncios</div>
                    <div className="filter-row">{[10, 20, 50, 100].map(v => <button key={v} className={`filter-btn${mineMinAds === v ? ' active' : ''}`} onClick={() => setMineMinAds(v)}>{v}+</button>)}</div>
                  </div>
                  <div>
                    <div className="rpt-card-lbl" style={{ marginBottom: 6 }}>Min. dias rodando</div>
                    <div className="filter-row">{[7, 15, 30, 60].map(v => <button key={v} className={`filter-btn${mineMinDays === v ? ' active' : ''}`} onClick={() => setMineMinDays(v)}>{v}d+</button>)}</div>
                  </div>
                </div>
                <button className="mine-btn" onClick={handleMine} disabled={!mineNicho || mining}>
                  {mining ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Minerando...</> : '\u26CF\uFE0F Minerar Agora'}
                </button>
                {mineError && <div className="err" style={{ marginTop: 12 }}>{mineError}</div>}
              </div>

              {mineResults.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div className="sec-hd"><h2>Resultados</h2><span className="sec-count">{mineResults.length} ofertas</span></div>
                  <div className="mine-results">
                    {mineResults.map((o, i) => (
                      <div key={i} className="mine-card">
                        <div className="mc-rank">#{i + 1}</div>
                        <div className="mc-info">
                          <div className="mc-name">{o.pagina_nome}</div>
                          <div className="mc-meta">{o.nicho} &middot; {o.dias_rodando !== null ? `${o.dias_rodando}d` : '?'} &middot; {o.total_anuncios} anuncios</div>
                          {o.resumo_angulo && <div className="mc-angle">{o.resumo_angulo}</div>}
                        </div>
                        <div className={`mc-score ${o.score_escalabilidade >= 7 ? 'green' : o.score_escalabilidade >= 4 ? 'yellow' : 'red'}`}>{o.score_escalabilidade}</div>
                        <div className="mc-actions">
                          <button className="btn-sm btn-orange" onClick={() => { setUrl(o.ad_library_url); setActiveTab('analise') }}>Analisar</button>
                          <a href={o.ad_library_url} target="_blank" rel="noopener noreferrer" className="btn-sm">Ver Ads</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── MODALS ── */}

      {/* History/Alerts modal */}
      {alertsModal && (
        <div className="modal-overlay" onClick={() => setAlertsModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Historico - {alertsModal.offer.pagina_nome}</h3>
              <button className="modal-close" onClick={() => setAlertsModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Mini chart */}
              {alertsModal.alerts.length > 1 && (
                <div className="history-chart">
                  {(() => {
                    const points = alertsModal.alerts.slice().reverse().map(a => {
                      let val = 0
                      try { const d = JSON.parse(a.dados_novos || '{}'); val = d.ads ?? 0 } catch { /* ok */ }
                      return { date: new Date(a.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), ads: val }
                    }).filter(p => p.ads > 0)
                    if (points.length < 2) return null
                    const max = Math.max(...points.map(p => p.ads))
                    const min = Math.min(...points.map(p => p.ads))
                    const range = max - min || 1
                    const w = 100 / (points.length - 1)
                    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * w},${100 - ((p.ads - min) / range) * 80 - 10}`).join(' ')
                    return (
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="hc-svg">
                        <path d={pathD} fill="none" stroke="#FF6B00" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        {points.map((p, i) => <circle key={i} cx={i * w} cy={100 - ((p.ads - min) / range) * 80 - 10} r="1.5" fill="#FF6B00" />)}
                      </svg>
                    )
                  })()}
                </div>
              )}
              {/* Timeline */}
              <div className="history-timeline">
                {alertsModal.alerts.length > 0 ? alertsModal.alerts.map(a => (
                  <div key={a.id} className={`ht-item ht-${a.tipo}`}>
                    <div className="ht-dot" />
                    <div className="ht-content">
                      <div className="ht-time">{new Date(a.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="ht-msg">{a.mensagem}</div>
                    </div>
                  </div>
                )) : <div className="empty-state" style={{ padding: 24 }}>Nenhum evento registrado ainda. O radar verifica diariamente.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add offer modal */}
      {addOfferModal && (
        <div className="modal-overlay" onClick={() => setAddOfferModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd"><h3>Adicionar Oferta</h3><button className="modal-close" onClick={() => setAddOfferModal(false)}>&times;</button></div>
            <div className="modal-body">
              <label className="modal-label">Nome da pagina</label>
              <input className="modal-input" value={newOfferName} onChange={e => setNewOfferName(e.target.value)} placeholder="Ex: Velas Lucrativas" />
              <label className="modal-label">URL da Ad Library</label>
              <input className="modal-input" value={newOfferUrl} onChange={e => setNewOfferUrl(e.target.value)} placeholder="https://www.facebook.com/ads/library/?active_status=..." />
              <label className="modal-label">Nicho</label>
              <select className="modal-input" value={newOfferNicho} onChange={e => setNewOfferNicho(e.target.value)}>
                <option value="">Selecione...</option>
                {nichos.map(n => <option key={n} value={n.toLowerCase()}>{n}</option>)}
              </select>
              <button className="rdr-btn-orange" style={{ marginTop: 16, width: '100%', justifyContent: 'center', padding: '12px 0' }} onClick={addOfferManual} disabled={!newOfferName || !newOfferUrl}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Salvar no Radar
              </button>
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
    </>
  )
}

/* ─────────── CSS ─────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:'Inter',system-ui,sans-serif;background:#09090b;color:#fafafa;-webkit-font-smoothing:antialiased}

/* LAYOUT */
.app{min-height:100vh;display:flex;flex-direction:column}

/* HEADER */
.header{display:flex;align-items:center;gap:12px;padding:0 24px;height:56px;border-bottom:1px solid #1a1a1e;background:#09090b;position:sticky;top:0;z-index:50}
.header-left{display:flex;align-items:center;gap:8px;flex-shrink:0}
.header-logo{height:32px;width:auto}
.header-brand{font-size:16px;font-weight:800;color:#FF6B00;letter-spacing:-.02em}
.header-tabs{display:flex;align-items:center;gap:2px;margin-left:32px}
.header-tab{display:flex;align-items:center;gap:6px;padding:8px 14px;border:none;background:transparent;color:#71717a;font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;border-radius:8px;transition:all .15s;white-space:nowrap;position:relative}
.header-tab:hover{color:#a1a1aa;background:#18181b}
.header-tab.active{color:#fafafa;background:#18181b}
.header-tab.active::after{content:'';position:absolute;bottom:-9px;left:12px;right:12px;height:2px;background:#FF6B00;border-radius:1px}
.tab-icon{display:flex;align-items:center;color:#6B7280;transition:color .15s}
.header-tab.active .tab-icon{color:#FF6B00}
.header-tab:hover .tab-icon{color:#9CA3AF}
.tab-label{}
.tab-badge{background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:10px;min-width:16px;text-align:center}
.header-right{display:flex;align-items:center;gap:12px;margin-left:auto;position:relative}
.header-saldo{font-size:12px;color:#52525b;font-weight:500;white-space:nowrap}
.header-avatar{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#FF6B00,#e05e00);border:none;color:#fff;font-weight:700;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.profile-drop{position:absolute;top:calc(100% + 8px);right:0;background:#18181b;border:1px solid #27272a;border-radius:12px;padding:8px;min-width:160px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.profile-name{padding:8px 10px;font-size:13px;font-weight:600;color:#e4e4e7;border-bottom:1px solid #27272a;margin-bottom:4px}
.profile-link{display:block;width:100%;text-align:left;padding:6px 10px;border:none;background:transparent;color:#71717a;font-family:inherit;font-size:13px;cursor:pointer;border-radius:6px;transition:all .12s;text-decoration:none}
.profile-link:hover{background:#27272a;color:#e4e4e7}
@media(max-width:768px){.tab-label{display:none}.header-tabs{gap:0}.header{padding:0 12px}}

/* CONTENT */
.content{flex:1;overflow-y:auto}
.tab-content{max-width:960px;margin:0 auto;padding:32px 24px 80px}
@media(max-width:768px){.tab-content{padding:20px 16px 60px}}

/* ANALYZE */
.analyze-hero{text-align:center;margin-bottom:24px}
.analyze-title{font-size:clamp(24px,3vw,32px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px}
.acc{color:#FF6B00}
.analyze-sub{font-size:14px;color:#6B7280;margin-bottom:24px}
.analyze-form{display:flex;gap:8px;max-width:640px;margin:0 auto}
.analyze-input-wrap{flex:1;display:flex;align-items:center;gap:10px;background:#0D0D0D;border:1px solid #1F2937;border-radius:10px;padding:0 16px;transition:border-color .2s}
.analyze-input-wrap:focus-within{border-color:#FF6B00;box-shadow:0 0 0 3px rgba(255,107,0,.08)}
.analyze-input-icon{flex-shrink:0}
.analyze-input{flex:1;background:transparent;border:none;padding:13px 0;font-family:inherit;font-size:14px;color:#fafafa;outline:none}
.analyze-input::placeholder{color:#4B5563}
.analyze-btn{padding:12px 24px;background:#FF6B00;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:8px}
.analyze-btn:hover:not(:disabled){background:#e05e00;box-shadow:0 0 20px rgba(255,107,0,.2)}
.analyze-btn:disabled{opacity:.4;cursor:not-allowed}

/* STATS */
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:640px;margin:0 auto 8px}
@media(max-width:500px){.stats-row{grid-template-columns:1fr}}
.stat-card{background:#111111;border:1px solid #1F2937;border-radius:12px;padding:16px 18px;display:flex;align-items:center;gap:12px}
.stat-card svg{flex-shrink:0}
.stat-num{font-size:20px;font-weight:800;color:#fff}
.stat-label{font-size:11px;color:#6B7280;line-height:1.3}

/* TERM */
.term{background:#0a0a0a;border:1px solid #1a1a1e;border-radius:10px;overflow:hidden}
.term-bar{background:#111;border-bottom:1px solid #1a1a1e;padding:8px 14px;display:flex;align-items:center;gap:6px}
.tbd{width:9px;height:9px;border-radius:50%}.tbd.r{background:#ff5f57}.tbd.y{background:#febc2e}.tbd.g{background:#28c840}
.term-title{font-size:10px;color:#3f3f46;margin-left:8px;font-family:monospace}
.term-progress{height:2px;background:#111;overflow:hidden}
.term-progress-bar{height:100%;background:#FF6B00;transition:width .4s ease}
.term-body{padding:14px 18px;font-family:monospace;font-size:12px;line-height:2;min-height:60px;color:#52525b}
.tl-wait{color:#52525b;animation:fadein .3s ease}
.tl-done{color:#FF6B00;animation:fadein .3s ease}
.tcur{display:inline-block;width:7px;height:13px;background:#FF6B00;animation:blink .7s step-end infinite;vertical-align:middle;margin-left:3px}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes fadein{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}

/* RAT LOADING */
.rat-loading-info{display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 20px 24px;max-width:400px;margin:0 auto}
.rat-status{font-size:14px;color:#a1a1aa;text-align:center;min-height:20px;animation:fadein .3s ease}
.rat-progress-bar{width:280px;height:4px;background:#1F2937;border-radius:4px;overflow:hidden}
.rat-progress-fill{height:100%;background:#FF6B00;border-radius:4px;transition:width .6s ease}

/* HISTORY BUTTON */
.hc-btn{padding:5px 12px;border-radius:6px;border:1px solid #1F2937;background:transparent;color:#6B7280;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .12s;flex-shrink:0;white-space:nowrap}
.hc-btn:hover{border-color:#FF6B00;color:#FF6B00}

/* ERROR */
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ef4444;padding:12px 16px;border-radius:8px;font-size:13px;line-height:1.5}

/* SECTION HEADERS */
.sec-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.sec-hd h2{font-size:16px;font-weight:700}
.sec-count{font-size:12px;color:#3f3f46}

/* HISTORY CARDS */
.history-grid{display:flex;flex-direction:column;gap:6px}
.history-card{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#18181b;border:1px solid #27272a;border-radius:10px;cursor:pointer;transition:all .15s}
.history-card:hover{border-color:#3f3f46;background:#1c1c1f}
.hc-score{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0}
.hc-score.green{background:rgba(34,197,94,.12);color:#22c55e}
.hc-score.yellow{background:rgba(234,179,8,.12);color:#eab308}
.hc-score.red{background:rgba(239,68,68,.12);color:#ef4444}
.hc-info{flex:1;min-width:0}
.hc-name{font-size:14px;font-weight:600;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-meta{font-size:12px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* RADAR — REDESIGN */
.rdr-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.rdr-search-wrap{display:flex;align-items:center;gap:10px;background:#0D0D0D;border:1px solid #1F2937;border-radius:10px;padding:0 14px;flex:1;max-width:360px;transition:border-color .2s}
.rdr-search-wrap:focus-within{border-color:#FF6B00}
.rdr-search{flex:1;background:transparent;border:none;padding:11px 0;font-family:inherit;font-size:13px;color:#fafafa;outline:none}
.rdr-search::placeholder{color:#4B5563}
.rdr-actions{display:flex;gap:8px;flex-shrink:0}
.rdr-btn-outline{display:flex;align-items:center;gap:7px;padding:10px 18px;border:1px solid #1F2937;border-radius:10px;background:transparent;color:#a1a1aa;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.rdr-btn-outline:hover{border-color:#3f3f46;color:#e4e4e7}
.rdr-btn-orange{display:flex;align-items:center;gap:7px;padding:10px 18px;border:none;border-radius:10px;background:#FF6B00;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.rdr-btn-orange:hover{background:#e05e00}

/* Metric cards */
.rdr-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
@media(max-width:768px){.rdr-metrics{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.rdr-metrics{grid-template-columns:1fr}}
.rdr-metric-card{background:#111111;border:1px solid #1F2937;border-radius:12px;padding:18px 20px}
.rdr-mc-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.rdr-mc-label{font-size:12px;color:#6B7280;font-weight:500}
.rdr-mc-num{font-size:28px;font-weight:800;color:#fff}

/* Offer cards grid */
.rdr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media(max-width:1100px){.rdr-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.rdr-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.rdr-grid{grid-template-columns:1fr}}
.rdr-card{background:#111111;border:1px solid #1F2937;border-radius:14px;padding:18px;position:relative;transition:all .15s}
.rdr-card:hover{border-color:#374151;box-shadow:0 4px 24px rgba(0,0,0,.3)}

/* Card status badge */
.rdr-card-status{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.04em}
.rdr-st-esc{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.rdr-st-estavel{background:rgba(113,113,122,.08);color:#71717a;border:1px solid rgba(113,113,122,.15)}
.rdr-st-caindo{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.rdr-st-morta{background:rgba(50,50,50,.5);color:#52525b;border:1px solid rgba(50,50,50,.5)}

/* Card header */
.rdr-card-hd{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-right:70px}
.rdr-fb-icon{width:28px;height:28px;border-radius:7px;background:#1a2744;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rdr-card-info{min-width:0;flex:1}
.rdr-card-name{font-size:14px;font-weight:700;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rdr-card-url{font-size:10px;color:#4B5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Card metrics */
.rdr-card-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.rdr-cm{background:#0D0D0D;border:1px solid #1a2030;border-radius:10px;padding:10px 12px;text-align:center}
.rdr-cm-label{font-size:10px;color:#6B7280;margin-bottom:4px}
.rdr-cm-num{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
.rdr-cm-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:12px}
.rdr-cm-badge.up{background:rgba(34,197,94,.12);color:#22c55e}
.rdr-cm-badge.down{background:rgba(239,68,68,.12);color:#ef4444}
.rdr-cm-badge.flat{background:rgba(113,113,122,.1);color:#71717a}
.rdr-cm-date{font-size:10px;color:#FF6B00}

/* Variation rows */
.rdr-card-vars{margin-bottom:14px}
.rdr-var-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:12px}
.rdr-var-label{color:#6B7280}
.rdr-var-val{color:#71717a;display:flex;align-items:center;gap:3px}
.rdr-var-val.up{color:#22c55e}
.rdr-var-val.down{color:#ef4444}

/* Card actions */
.rdr-card-actions{display:flex;gap:8px;align-items:center}
.rdr-history-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 0;background:transparent;border:1px solid #1F2937;border-radius:8px;color:#a1a1aa;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
.rdr-history-btn:hover{border-color:#374151;color:#fff}
.rdr-refresh-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid #1F2937;border-radius:8px;color:#FF6B00;cursor:pointer;transition:all .15s;flex-shrink:0}
.rdr-refresh-btn:hover{border-color:#FF6B00;background:rgba(255,107,0,.06)}

/* History modal */
.modal-lg{max-width:560px}
.history-chart{height:120px;background:#0D0D0D;border:1px solid #1F2937;border-radius:10px;padding:12px;margin-bottom:16px;overflow:hidden}
.hc-svg{width:100%;height:100%}
.history-timeline{display:flex;flex-direction:column;gap:0;border-left:2px solid #1F2937;margin-left:8px;padding-left:20px}
.ht-item{position:relative;padding:12px 0}
.ht-item+.ht-item{border-top:1px solid #111}
.ht-dot{position:absolute;left:-27px;top:16px;width:10px;height:10px;border-radius:50%;border:2px solid #27272a;background:#18181b}
.ht-escalou .ht-dot{border-color:#22c55e;background:#22c55e}
.ht-caiu .ht-dot,.ht-morreu .ht-dot{border-color:#ef4444;background:#ef4444}
.ht-pagina_mudou .ht-dot{border-color:#eab308;background:#eab308}
.ht-time{font-size:11px;color:#52525b;margin-bottom:3px}
.ht-msg{font-size:13px;color:#a1a1aa;line-height:1.5}

/* BUTTONS */
.btn-sm{padding:6px 12px;border-radius:6px;border:1px solid #27272a;background:transparent;color:#a1a1aa;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .12s;text-decoration:none;white-space:nowrap}
.btn-sm:hover{border-color:#3f3f46;color:#e4e4e7}
.btn-sm.btn-orange{background:#FF6B00;border-color:#FF6B00;color:#fff}
.btn-sm.btn-orange:hover{background:#e05e00}
.btn-sm.btn-ghost{border-color:transparent;color:#52525b}
.btn-sm.btn-ghost:hover{color:#ef4444}
.btn-outline{padding:8px 16px;border-radius:8px;border:1px solid #27272a;background:transparent;color:#a1a1aa;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .12s}
.btn-outline:hover{border-color:#3f3f46;color:#e4e4e7}

/* MINE */
.mine-filters{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:24px}
.mine-nichos{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
.nicho-btn{padding:8px 16px;border-radius:20px;border:1px solid #27272a;background:transparent;color:#71717a;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.nicho-btn:hover{border-color:#3f3f46;color:#a1a1aa}
.nicho-btn.active{border-color:#FF6B00;background:rgba(249,115,22,.1);color:#FF6B00}
.mine-advanced{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
@media(max-width:500px){.mine-advanced{grid-template-columns:1fr}}
.filter-row{display:flex;gap:6px}
.filter-btn{padding:6px 12px;border-radius:6px;border:1px solid #27272a;background:transparent;color:#52525b;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .12s}
.filter-btn.active{border-color:#FF6B00;background:rgba(249,115,22,.1);color:#FF6B00}
.mine-btn{padding:12px 28px;background:#FF6B00;border:none;border-radius:10px;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:8px}
.mine-btn:hover:not(:disabled){background:#e05e00}
.mine-btn:disabled{opacity:.4;cursor:not-allowed}
.mine-results{display:flex;flex-direction:column;gap:8px}
.mine-card{display:flex;align-items:center;gap:14px;padding:16px 18px;background:#18181b;border:1px solid #27272a;border-radius:12px;transition:all .15s}
.mine-card:hover{border-color:#3f3f46}
.mc-rank{font-size:12px;font-weight:800;color:#3f3f46;width:28px;flex-shrink:0;text-align:center}
.mc-info{flex:1;min-width:0}
.mc-name{font-size:14px;font-weight:700;color:#e4e4e7;margin-bottom:2px}
.mc-meta{font-size:12px;color:#52525b}
.mc-angle{font-size:12px;color:#71717a;margin-top:4px;line-height:1.4}
.mc-score{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;flex-shrink:0}
.mc-score.green{background:rgba(34,197,94,.12);color:#22c55e}
.mc-score.yellow{background:rgba(234,179,8,.12);color:#eab308}
.mc-score.red{background:rgba(239,68,68,.12);color:#ef4444}
.mc-actions{display:flex;gap:6px;flex-shrink:0}

/* MODALS */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px)}
.modal{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:24px;max-width:480px;width:90%;max-height:80vh;overflow-y:auto}
.modal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.modal-hd h3{font-size:16px;font-weight:700}
.modal-close{background:transparent;border:none;color:#71717a;font-size:20px;cursor:pointer;padding:4px}
.modal-body{display:flex;flex-direction:column;gap:12px}
.modal-label{font-size:11px;font-weight:600;color:#52525b;text-transform:uppercase;letter-spacing:.06em}
.modal-input{background:#09090b;border:1px solid #27272a;border-radius:8px;padding:10px 14px;font-family:inherit;font-size:13px;color:#fafafa;outline:none;transition:border-color .15s}
.modal-input:focus{border-color:#FF6B00}
.modal-input::placeholder{color:#3f3f46}

/* ALERTS */
.alert-item{padding:12px 14px;border-radius:8px;border-left:3px solid #27272a;background:#09090b}
.alert-item.alert-escalou{border-left-color:#22c55e}
.alert-item.alert-caiu,.alert-item.alert-morreu{border-left-color:#ef4444}
.alert-item.alert-pagina_mudou{border-left-color:#eab308}
.alert-time{font-size:11px;color:#52525b;margin-bottom:4px}
.alert-msg{font-size:13px;color:#a1a1aa;line-height:1.5}

/* EMPTY */
.empty-state{padding:48px 20px;text-align:center;color:#3f3f46;font-size:13px}

/* ─── REPORT ─── */
.report-wrap{min-height:100vh;background:#09090b;color:#e4e4e7;display:flex;flex-direction:column}
.report-topbar{display:flex;align-items:center;gap:12px;padding:12px 24px;border-bottom:1px solid #1a1a1e;flex-shrink:0}
.report-back{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid #27272a;border-radius:8px;color:#71717a;padding:6px 12px;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
.report-back:hover{border-color:#3f3f46;color:#e4e4e7}
.report-subtitle{font-size:11px;color:#3f3f46;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}
.report-body{flex:1;overflow-y:auto;padding:28px 24px;max-width:940px;width:100%;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.report-cta-wrap{padding:24px;max-width:940px;width:100%;margin:0 auto;display:flex;justify-content:center}
.cta-radar-btn{padding:14px 32px;background:#FF6B00;border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:10px}
.cta-radar-btn:hover{background:#e05e00;transform:translateY(-1px)}

/* Verdict */
.vrd-hero{border-radius:16px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap}
.vrd-green{background:linear-gradient(135deg,rgba(34,197,94,.06),rgba(22,163,74,.03));border:1px solid rgba(34,197,94,.15);color:#22c55e}
.vrd-yellow{background:linear-gradient(135deg,rgba(234,179,8,.06),rgba(202,138,4,.03));border:1px solid rgba(234,179,8,.15);color:#eab308}
.vrd-red{background:linear-gradient(135deg,rgba(239,68,68,.06),rgba(185,28,28,.03));border:1px solid rgba(239,68,68,.15);color:#ef4444}
.vrd-left{display:flex;align-items:center;gap:20px;flex:1;min-width:0}
.vrd-icon{font-size:36px;line-height:1;flex-shrink:0;filter:drop-shadow(0 0 12px currentColor)}
.vrd-label{font-size:28px;font-weight:900;letter-spacing:-.02em;margin-bottom:6px}
.vrd-desc{font-size:13px;opacity:.6;color:#a1a1aa;font-weight:400}
.vrd-right{display:flex;align-items:center;gap:24px;flex-shrink:0}
.vrd-bars{display:flex;flex-direction:column;gap:10px;min-width:200px}
.vrd-bar-row{display:flex;align-items:center;gap:10px}
.vrd-bar-lbl{font-size:11px;color:#52525b;width:90px;flex-shrink:0}
.vrd-bar-track{flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}
.vrd-bar-fill{height:100%;border-radius:4px;background:currentColor;transition:width .8s cubic-bezier(.16,1,.3,1);opacity:.8}
.vrd-bar-num{font-size:12px;font-weight:700;width:28px;text-align:right;flex-shrink:0}
.vrd-just{font-size:11px;color:#52525b;line-height:1.55;margin-top:6px}
@media(max-width:640px){.vrd-hero{padding:20px;gap:20px}.vrd-right{flex-direction:column;gap:16px}.vrd-bars{min-width:160px}.vrd-label{font-size:22px}}

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
.rpt-card-val{font-size:13px;color:#a1a1aa;line-height:1.6}
.rpt-highlight-val{font-size:15px;font-weight:600;color:#e4e4e7;line-height:1.5}
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
.rpt-struct-copy{font-size:11px;color:#3f3f46;line-height:1.4;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}
.rpt-struct-qual{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;flex-shrink:0;margin-left:auto}
.rpt-struct-qual.forte{background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.rpt-struct-qual.medio{background:rgba(234,179,8,.1);color:#eab308;border:1px solid rgba(234,179,8,.2)}
.rpt-struct-qual.fraco{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.rpt-palette{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:4px}
.rpt-swatch{width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.06);flex-shrink:0}
.rpt-assets-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-top:8px;scrollbar-width:thin;scrollbar-color:#27272a transparent}
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
.rpt-shots-scroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-top:8px;scrollbar-width:thin;scrollbar-color:#27272a transparent}
.rpt-shot{flex-shrink:0;width:220px;border-radius:8px;overflow:hidden;border:1px solid #1a1a1e}
.rpt-shot img{width:100%;height:auto;display:block}
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
