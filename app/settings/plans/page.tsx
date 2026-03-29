'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CREDITS_CHECKOUT_URL = process.env.NEXT_PUBLIC_CREDITS_CHECKOUT_URL || 'https://pay.kirvano.com/clickclone-creditos'

interface UserInfo {
  nome: string
  email: string
  creditos: number
  plano: string
}

export default function PlansPage() {
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user)
    }).catch(() => {})
  }, [])

  const creditPct = user ? Math.min(100, (user.creditos / 100) * 100) : 0
  const creditColor = !user || user.creditos === 0 ? '#ef4444' : user.creditos <= 20 ? '#eab308' : '#E8692A'

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#ccc',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      padding: '48px 16px',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Back */}
        <Link href="/tool" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#555', textDecoration: 'none', fontSize: 13, marginBottom: 32 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </Link>

        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#fff' }}>Planos & Créditos</h1>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: '#555' }}>Gerencie seu plano e compre mais créditos de edição.</p>

        {/* Current plan card */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#444', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 4 }}>Plano atual</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', textTransform: 'capitalize' }}>{user?.plano || '—'}</div>
            </div>
            <div style={{ padding: '4px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#E8692A' }}>
              Ativo
            </div>
          </div>

          {/* Credits */}
          <div style={{ fontSize: 11, color: '#444', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 10 }}>Créditos restantes</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1, background: '#1a1a1a', borderRadius: 6, height: 8 }}>
              <div style={{ height: 8, borderRadius: 6, width: `${creditPct}%`, background: creditColor, transition: 'width .4s ease' }} />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: creditColor, minWidth: 48, textAlign: 'right' }}>
              {user?.creditos ?? '—'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#444' }}>
            {user?.creditos === 0
              ? '⚠️ Créditos esgotados — compre mais abaixo'
              : `1 crédito por edição simples, 3 por redesign completo`}
          </div>
        </div>

        {/* Buy credits card */}
        <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Pacote de Créditos</div>
              <div style={{ fontSize: 13, color: '#555' }}>50 créditos de edição com IA</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>R$29,90</div>
              <div style={{ fontSize: 11, color: '#444' }}>pagamento único</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {['50 créditos adicionados na hora', 'Não expira', 'Funciona com seu plano atual'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888' }}>
                <span style={{ color: '#E8692A', fontSize: 14 }}>✓</span>
                {item}
              </div>
            ))}
          </div>

          <a
            href={CREDITS_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center', padding: '14px 24px',
              background: '#E8692A', color: '#fff', borderRadius: 10,
              textDecoration: 'none', fontWeight: 700, fontSize: 15,
            }}
          >
            Comprar 50 créditos → R$29,90
          </a>
        </div>

        {/* Subscription card */}
        <div style={{ background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>Seu plano mensal inclui</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {['100 créditos renovados todo mês', '10 análises de concorrentes', 'Geração ilimitada de páginas'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#666' }}>
                <span style={{ color: '#444', fontSize: 14 }}>⚡</span>
                {item}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
