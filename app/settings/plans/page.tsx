'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STARTER_URL = 'https://pay.kirvano.com/5def273b-7070-429d-bdc2-e0ebec1da6e9'
const PREMIUM_URL = 'https://pay.kirvano.com/c60822ee-79dc-4e2c-ab27-031d405ca57c'

interface UserInfo {
  nome: string
  email: string
  plano: string
  analises: number
  mineracoes: number
  max_analises: number
  max_mineracoes: number
  max_slots_radar: number
  renova_em: string | null
  creditos: number
}

export default function PlansPage() {
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user)
    }).catch(() => {})
  }, [])

  const diasRenovacao = user?.renova_em
    ? Math.max(0, Math.ceil((new Date(user.renova_em).getTime() - Date.now()) / 86400000))
    : null

  const isPremium = user?.plano === 'premium'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Sora',sans-serif;background:#000;color:#fff;-webkit-font-smoothing:antialiased}
        .plans-page{min-height:100vh;padding:48px 20px 80px;position:relative}
        .plans-page::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(circle,rgba(255,255,255,.05) 1px,transparent 1px);background-size:24px 24px}
        .plans-wrap{max-width:640px;margin:0 auto;position:relative;z-index:1}
        .plans-back{display:inline-flex;align-items:center;gap:8px;color:#444;text-decoration:none;font-size:13px;font-weight:500;margin-bottom:36px;transition:color .2s}
        .plans-back:hover{color:#FF8C00}
        .plans-title{font-size:clamp(28px,4vw,38px);font-weight:800;letter-spacing:-.04em;margin-bottom:6px;line-height:1.1}
        .plans-title .acc{background:linear-gradient(135deg,#FF8C00,#FFB347);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .plans-sub{font-size:14px;color:#444;margin-bottom:40px;font-weight:400}
        .plan-card{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:32px;margin-bottom:20px;position:relative;overflow:hidden;backdrop-filter:blur(12px);transition:border-color .3s,box-shadow .3s}
        .plan-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,140,0,.3),transparent)}
        .plan-card:hover{border-color:rgba(255,140,0,.2)}
        .plan-card-premium{border-color:rgba(255,140,0,.3);box-shadow:0 0 40px rgba(255,140,0,.08)}
        .plan-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
        .plan-label{font-size:10px;font-weight:700;color:#555;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
        .plan-name{font-size:22px;font-weight:800;color:#fff;text-transform:capitalize}
        .plan-badge{font-size:10px;font-weight:800;padding:5px 12px;border-radius:6px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
        .plan-badge-active{background:rgba(16,185,129,.12);color:#10B981;border:1px solid rgba(16,185,129,.25)}
        .plan-badge-inactive{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
        .quotas-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:560px){.quotas-grid{grid-template-columns:1fr}}
        .quota-item{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:14px;padding:18px 16px;text-align:center}
        .quota-val{font-size:28px;font-weight:800;color:#fff;letter-spacing:-.03em;margin-bottom:4px}
        .quota-label{font-size:11px;color:#555;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
        .quota-bar{height:4px;background:rgba(255,255,255,.04);border-radius:100px;overflow:hidden;margin-top:8px}
        .quota-fill{height:100%;background:linear-gradient(90deg,#FF8C00,#FFB347);border-radius:100px;transition:width .6s cubic-bezier(.16,1,.3,1)}
        .quota-fill-low{background:linear-gradient(90deg,#ef4444,#f87171)}
        .renew-row{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;background:rgba(255,140,0,.04);border:1px solid rgba(255,140,0,.12);border-radius:12px;font-size:13px;color:#FF8C00;font-weight:600}
        .upgrade-card{background:linear-gradient(135deg,rgba(255,140,0,.06),rgba(0,0,0,.4));border:1px solid rgba(255,140,0,.25);border-radius:20px;padding:36px 32px;text-align:center;position:relative;overflow:hidden}
        .upgrade-card::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,140,0,.12),transparent 70%);pointer-events:none}
        .upgrade-title{font-size:20px;font-weight:800;color:#fff;margin-bottom:8px;letter-spacing:-.02em}
        .upgrade-sub{font-size:13px;color:#555;margin-bottom:24px;line-height:1.6}
        .btn-upgrade{display:inline-flex;align-items:center;gap:8px;padding:16px 36px;background:linear-gradient(135deg,#FF8C00,#FF6B00);color:#fff;border:none;border-radius:12px;font-family:'Sora',sans-serif;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;transition:all .25s;box-shadow:0 8px 24px rgba(255,107,0,.35),inset 0 1px 0 rgba(255,255,255,.2)}
        .btn-upgrade:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(255,107,0,.45)}
        .plan-features{display:flex;flex-direction:column;gap:10px;margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,.04)}
        .pf-item{display:flex;align-items:center;gap:10px;font-size:13px;color:#888;font-weight:400}
        .pf-icon{color:#FF8C00;font-size:12px;flex-shrink:0}
      `}</style>

      <div className="plans-page">
        <div className="plans-wrap">
          <Link href="/tool" className="plans-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </Link>

          <h1 className="plans-title">Seu <span className="acc">Plano</span></h1>
          <p className="plans-sub">Gerencie suas quotas e acompanhe seu uso.</p>

          {/* Current Plan */}
          <div className={`plan-card ${isPremium ? 'plan-card-premium' : ''}`}>
            <div className="plan-header">
              <div>
                <div className="plan-label">Plano atual</div>
                <div className="plan-name">{user?.plano || '\u2014'}</div>
              </div>
              <span className={`plan-badge ${user?.plano === 'inativo' ? 'plan-badge-inactive' : 'plan-badge-active'}`}>
                {user?.plano === 'inativo' ? 'Inativo' : 'Ativo'}
              </span>
            </div>

            <div className="quotas-grid">
              <div className="quota-item">
                <div className="quota-val">{user?.analises ?? 0}<span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>/{user?.max_analises ?? 5}</span></div>
                <div className="quota-label">An{'\u00e1'}lises</div>
                <div className="quota-bar">
                  <div className={`quota-fill ${(user?.analises ?? 0) <= 1 ? 'quota-fill-low' : ''}`} style={{ width: `${user ? (user.analises / user.max_analises) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="quota-item">
                <div className="quota-val">{user?.mineracoes ?? 0}<span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>/{user?.max_mineracoes ?? 5}</span></div>
                <div className="quota-label">Minera{'\u00e7\u00f5'}es</div>
                <div className="quota-bar">
                  <div className={`quota-fill ${(user?.mineracoes ?? 0) <= 1 ? 'quota-fill-low' : ''}`} style={{ width: `${user ? (user.mineracoes / user.max_mineracoes) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="quota-item">
                <div className="quota-val">{user?.max_slots_radar ?? 5}</div>
                <div className="quota-label">Slots Radar</div>
              </div>
            </div>

            {diasRenovacao !== null && (
              <div className="renew-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Renova em {diasRenovacao} dias
              </div>
            )}

            <div className="plan-features">
              {(isPremium ? [
                '20 an\u00e1lises por m\u00eas (60 no trimestre)',
                '20 minera\u00e7\u00f5es por m\u00eas (60 no trimestre)',
                'Rastreamento de 10 ofertas',
                'Atualiza\u00e7\u00e3o di\u00e1ria autom\u00e1tica',
                'Suporte VIP via WhatsApp',
                'Hist\u00f3rico completo',
              ] : [
                '10 an\u00e1lises por m\u00eas',
                '10 minera\u00e7\u00f5es autom\u00e1ticas',
                'Rastreamento de 5 ofertas',
                'Atualiza\u00e7\u00e3o di\u00e1ria autom\u00e1tica',
                'Suporte 24h via WhatsApp',
                'Hist\u00f3rico de 30 dias',
              ]).map(f => (
                <div className="pf-item" key={f}><span className="pf-icon">{'\u2726'}</span>{f}</div>
              ))}
            </div>
          </div>

          {/* Upgrade card (only for starter) */}
          {user && user.plano === 'starter' && (
            <div className="upgrade-card">
              <div className="upgrade-title">Quer mais poder?</div>
              <div className="upgrade-sub">
                Fa{'\u00e7'}a upgrade pro <strong style={{ color: '#FF8C00' }}>Premium</strong> e tenha 3x mais an{'\u00e1'}lises, minera{'\u00e7\u00f5'}es e slots de rastreamento.
              </div>
              <a href={PREMIUM_URL} target="_blank" rel="noopener noreferrer" className="btn-upgrade IC - Geral">
                Fazer upgrade {'\u2192'} R$147,90/tri
              </a>
            </div>
          )}

          {/* Reactivate (inactive) */}
          {user && user.plano === 'inativo' && (
            <div className="upgrade-card">
              <div className="upgrade-title">Reativar RatoAds</div>
              <div className="upgrade-sub">Seu plano expirou. Reative pra continuar minerando e analisando ofertas.</div>
              <a href={STARTER_URL} target="_blank" rel="noopener noreferrer" className="btn-upgrade IC - Geral">
                Reativar Starter {'\u2192'} R$57,90/m{'\u00ea'}s
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
