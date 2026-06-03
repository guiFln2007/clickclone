'use client'

import { useEffect, useState, useCallback } from 'react'

type Stats = {
  activeUsers: number
  analysesToday: number
  newUsersThisWeek: number
  totalUsers: number
  revenueEstimated: number
}

type Visitor = {
  session_id: string
  user_id: number | null
  email: string | null
  page: string
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  device: string | null
  started_at: string
  last_seen: string
}

type VisitorStats = {
  online: number
  todayUnique: number
  todayPageViews: number
  byPage: { page: string; count: number }[]
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'Landing Page',
  '/tool': 'Ferramenta',
  '/login': 'Login',
  '/settings/plans': 'Planos',
}

function pageLabel(p: string): string {
  return PAGE_LABELS[p] || p
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #111 0%, #0d0d0d 100%)',
      border: '1px solid #1a1a1a', borderRadius: 14,
      padding: '20px 22px', flex: 1, minWidth: 170,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 16, right: 16, width: 36, height: 36,
        borderRadius: 10, background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, opacity: 0.8,
      }}>{icon}</div>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function LiveDot() {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: '#22c55e', marginRight: 8,
      boxShadow: '0 0 6px #22c55e',
      animation: 'pulse-dot 2s ease-in-out infinite',
    }} />
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [vStats, setVStats] = useState<VisitorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [blasting, setBlasting] = useState(false)
  const [blastResult, setBlastResult] = useState<{ sent: number; failed: number } | null>(null)
  const [mcStats, setMcStats] = useState<{ total: number; today: number; bySlug: { slug: string; clicks: number; last_click: string }[]; sales: { slug: string; vendas: number; vendas_pagas: number }[] } | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch('/api/admin/mc-stats')
      .then(r => r.json())
      .then(d => setMcStats(d))
      .catch(() => {})
  }, [])

  const loadVisitors = useCallback(() => {
    fetch('/api/admin/visitors')
      .then(r => r.json())
      .then(d => {
        setVisitors(d.visitors || [])
        setVStats(d.stats || null)
      })
      .catch(() => {})
  }, [])

  // Load visitors immediately and poll every 15s
  useEffect(() => {
    loadVisitors()
    const interval = setInterval(loadVisitors, 15000)
    return () => clearInterval(interval)
  }, [loadVisitors])

  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const fmtR = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .adm-card { background: #111; border: 1px solid #1a1a1a; border-radius: 14px; padding: 20px 24px; }
        .adm-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 10px; font-weight: 700;
          font-size: 13px; text-decoration: none; border: none; cursor: pointer;
          transition: all .15s ease;
        }
        .adm-btn:hover { filter: brightness(1.15); }
        .adm-btn-primary { background: #E8692A; color: #fff; }
        .adm-btn-ghost { background: #1a1a1a; border: 1px solid #252525; color: #999; }
        .adm-btn-ghost:hover { color: #ccc; border-color: #333; }
        .adm-btn-purple { background: #7c3aed; color: #fff; }
        .v-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #151515; gap: 12px; }
        .v-row:last-child { border-bottom: none; }
        .v-badge {
          display: inline-block; padding: 3px 8px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
        }
        .v-page-bar {
          height: 6px; border-radius: 3px; background: #1a1a1a; overflow: hidden;
          position: relative;
        }
        .v-page-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, #E8692A, #FF8C00);
        }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.5 }}>Dashboard</h1>
        <p style={{ color: '#444', fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#444', fontSize: 14 }}>Carregando...</div>
      ) : stats ? (
        <>
          {/* Stats cards */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard
              label="Online Agora"
              value={fmt(vStats?.online || 0)}
              color="#22c55e"
              icon={<LiveDot />}
            />
            <StatCard
              label="Usuários Ativos"
              value={fmt(stats.activeUsers)}
              sub={`${fmt(stats.totalUsers)} total`}
              color="#fff"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
            />
            <StatCard
              label="Análises Hoje"
              value={fmt(stats.analysesToday)}
              color="#E8692A"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21H3V3"/><path d="M21 7l-8 8-4-4-6 6"/></svg>}
            />
            <StatCard
              label="Receita Estimada"
              value={fmtR(stats.revenueEstimated)}
              sub="ativos x R$57,90"
              color="#4ade80"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            />
            <StatCard
              label="Novos (7 dias)"
              value={fmt(stats.newUsersThisWeek)}
              color="#60a5fa"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>}
            />
          </div>

          {/* Live visitors + Page distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 24 }}>
            {/* Visitor list */}
            <div className="adm-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ccc', margin: 0, display: 'flex', alignItems: 'center' }}>
                  <LiveDot /> Visitantes em Tempo Real
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#555' }}>
                  <span>{fmt(vStats?.todayUnique || 0)} únicos hoje</span>
                  <span>{fmt(vStats?.todayPageViews || 0)} pageviews</span>
                </div>
              </div>

              {visitors.length === 0 ? (
                <div style={{ color: '#333', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                  Nenhum visitante online no momento
                </div>
              ) : (
                <div>
                  {visitors.map(v => (
                    <div className="v-row" key={v.session_id}>
                      {/* Device icon */}
                      <div style={{ color: '#444', flexShrink: 0 }}>
                        {v.device === 'mobile' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        )}
                      </div>

                      {/* User info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: v.email ? '#fff' : '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.email || 'Visitante anônimo'}
                        </div>
                        {v.utm_source && (
                          <span style={{ fontSize: 10, color: '#555' }}>via {v.utm_source}{v.utm_campaign ? ` / ${v.utm_campaign}` : ''}</span>
                        )}
                      </div>

                      {/* Page */}
                      <span className="v-badge" style={{
                        background: v.page === '/tool' ? 'rgba(232,105,42,.12)' : v.page === '/settings/plans' ? 'rgba(124,58,237,.12)' : 'rgba(255,255,255,.05)',
                        color: v.page === '/tool' ? '#E8692A' : v.page === '/settings/plans' ? '#a78bfa' : '#666',
                      }}>
                        {pageLabel(v.page)}
                      </span>

                      {/* Time */}
                      <span style={{ fontSize: 11, color: '#444', flexShrink: 0, width: 40, textAlign: 'right' }}>
                        {timeAgo(v.last_seen)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Page distribution */}
            <div className="adm-card">
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#ccc', margin: '0 0 16px' }}>Por Página</h2>
              {vStats?.byPage && vStats.byPage.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {vStats.byPage.map(p => {
                    const maxCount = Math.max(...vStats.byPage.map(x => x.count), 1)
                    return (
                      <div key={p.page}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{pageLabel(p.page)}</span>
                          <span style={{ fontSize: 12, color: '#E8692A', fontWeight: 700 }}>{p.count}</span>
                        </div>
                        <div className="v-page-bar">
                          <div className="v-page-fill" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ color: '#333', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  Sem dados
                </div>
              )}

              {/* Summary stats */}
              <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 20, paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#555' }}>Visitantes únicos hoje</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(vStats?.todayUnique || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#555' }}>Page views hoje</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmt(vStats?.todayPageViews || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ManyChat tracking */}
          {mcStats && (mcStats.total > 0 || (mcStats.sales && mcStats.sales.length > 0)) && (
            <div className="adm-card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ccc', margin: 0 }}>ManyChat</h2>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555' }}>
                  <span>{mcStats.today} cliques hoje</span>
                  <span>{mcStats.total} cliques total</span>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222' }}>
                    <th style={{ textAlign: 'left', fontSize: 11, color: '#555', padding: '6px 0', fontWeight: 600 }}>KEYWORD</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: '#555', padding: '6px 0', fontWeight: 600 }}>CLIQUES</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: '#555', padding: '6px 0', fontWeight: 600 }}>TRIALS</th>
                    <th style={{ textAlign: 'center', fontSize: 11, color: '#555', padding: '6px 0', fontWeight: 600 }}>VENDAS</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allSlugs = new Set([
                      ...mcStats.bySlug.map(s => s.slug),
                      ...(mcStats.sales || []).map(s => s.slug),
                    ])
                    return Array.from(allSlugs).map(slug => {
                      const click = mcStats.bySlug.find(s => s.slug === slug)
                      const sale = mcStats.sales?.find(s => s.slug === slug)
                      return (
                        <tr key={slug} style={{ borderBottom: '1px solid #151515' }}>
                          <td style={{ padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#fff' }}>/mc/{slug}</td>
                          <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#888' }}>{click?.clicks || 0}</td>
                          <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>{sale ? sale.vendas - sale.vendas_pagas : 0}</td>
                          <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 900, color: '#4ade80' }}>{sale?.vendas_pagas || 0}</td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick actions */}
          <div className="adm-card">
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#ccc', margin: '0 0 16px' }}>Acesso rápido</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/admin/users" className="adm-btn adm-btn-primary">
                Gerenciar Usuários
              </a>
              <a href="/admin/users?create=1" className="adm-btn adm-btn-ghost">
                + Criar Usuário
              </a>
              <button
                disabled={blasting}
                onClick={async () => {
                  if (!confirm('Disparar email de recuperação (BOASVINDAS50) pra todos os trials inativos?')) return
                  setBlasting(true)
                  setBlastResult(null)
                  try {
                    const res = await fetch('/api/admin/blast-recovery', { method: 'POST' })
                    const data = await res.json()
                    setBlastResult({ sent: data.sent, failed: data.failed })
                  } catch {
                    setBlastResult({ sent: 0, failed: -1 })
                  }
                  setBlasting(false)
                }}
                className="adm-btn adm-btn-purple"
                style={{ opacity: blasting ? 0.5 : 1, cursor: blasting ? 'wait' : 'pointer' }}
              >
                {blasting ? 'Enviando...' : 'Disparar BOASVINDAS50'}
              </button>
            </div>
            {blastResult && (
              <p style={{ color: blastResult.failed === -1 ? '#e55' : '#4ade80', fontSize: 13, marginTop: 12, margin: '12px 0 0' }}>
                {blastResult.failed === -1
                  ? 'Erro ao disparar.'
                  : `${blastResult.sent} emails enviados${blastResult.failed > 0 ? `, ${blastResult.failed} falharam` : ''}.`}
              </p>
            )}
          </div>
        </>
      ) : (
        <div style={{ color: '#e55', fontSize: 14 }}>Erro ao carregar métricas.</div>
      )}
    </div>
  )
}
