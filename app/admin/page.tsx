'use client'

import { useEffect, useState } from 'react'

type Stats = {
  activeUsers: number
  analysesToday: number
  newUsersThisWeek: number
  totalUsers: number
  revenueEstimated: number
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
      padding: '22px 24px', flex: 1, minWidth: 180,
    }}>
      <div style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [blasting, setBlasting] = useState(false)
  const [blastResult, setBlastResult] = useState<{ sent: number; failed: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const fmtR = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Dashboard</h1>
        <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#444', fontSize: 14 }}>Carregando métricas...</div>
      ) : stats ? (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
            <StatCard label="Usuários Ativos" value={fmt(stats.activeUsers)} sub={`${fmt(stats.totalUsers)} total`} color="#fff" />
            <StatCard label="Análises Hoje" value={fmt(stats.analysesToday)} color="#E8692A" />
            <StatCard label="Receita Estimada" value={fmtR(stats.revenueEstimated)} sub="ativos × R$57,90/mês" color="#4ade80" />
            <StatCard label="Novos (7 dias)" value={fmt(stats.newUsersThisWeek)} color="#60a5fa" />
          </div>

          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px 24px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ccc', margin: '0 0 16px' }}>Acesso rápido</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <a
                href="/admin/users"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', background: '#E8692A', borderRadius: 8,
                  color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
                }}
              >
                ◉ Gerenciar Usuários
              </a>
              <a
                href="/admin/users?create=1"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 8, color: '#ccc', fontWeight: 600, fontSize: 13, textDecoration: 'none',
                }}
              >
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
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 18px', background: blasting ? '#333' : '#7c3aed', border: 'none',
                  borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: blasting ? 'wait' : 'pointer',
                }}
              >
                {blasting ? 'Enviando...' : 'Disparar BOASVINDAS50'}
              </button>
            </div>
            {blastResult && (
              <p style={{ color: blastResult.failed === -1 ? '#e55' : '#4ade80', fontSize: 13, marginTop: 12 }}>
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
