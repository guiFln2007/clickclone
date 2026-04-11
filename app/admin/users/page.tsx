'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type AdminUser = {
  id: number
  email: string
  name: string | null
  plano: string
  analises: number
  mineracoes: number
  max_analises: number
  max_mineracoes: number
  max_slots_radar: number
  creditos: number
  ativo: number
  created_at: string
  last_analysis: string | null
}

type Modal =
  | { type: 'analises' | 'mineracoes' | 'creditos'; user: AdminUser }
  | { type: 'delete'; user: AdminUser }
  | { type: 'reset'; user: AdminUser; tempPassword?: string }
  | { type: 'create' }

const LIMIT = 20

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function AdminUsersContent() {
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal | null>(null)
  const [actionVal, setActionVal] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [createForm, setCreateForm] = useState({ email: '', name: '', analises: '5', mineracoes: '5', plano: 'starter' })

  const load = useCallback(async (s = search, p = page) => {
    setLoading(true)
    const res = await fetch(`/api/admin/users?search=${encodeURIComponent(s)}&page=${p}&limit=${LIMIT}`)
    const data = await res.json()
    setUsers(data.users || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { load() }, [load])

  // Auto-open create modal if ?create=1
  useEffect(() => {
    if (searchParams.get('create') === '1') setModal({ type: 'create' })
  }, [searchParams])

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3500)
  }

  async function doAction() {
    if (!modal) return
    setActionLoading(true)

    if (modal.type === 'analises') {
      await fetch(`/api/admin/users/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAnalises: Number(actionVal) }),
      })
      showMsg(`+${actionVal} an\u00e1lises para ${modal.user.email}`)
    }

    if (modal.type === 'mineracoes') {
      await fetch(`/api/admin/users/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addMineracoes: Number(actionVal) }),
      })
      showMsg(`+${actionVal} minera\u00e7\u00f5es para ${modal.user.email}`)
    }

    if (modal.type === 'creditos') {
      await fetch(`/api/admin/users/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addCreditos: Number(actionVal) }),
      })
      showMsg(`+${actionVal} cr\u00e9ditos para ${modal.user.email}`)
    }

    if (modal.type === 'delete') {
      await fetch(`/api/admin/users/${modal.user.id}`, { method: 'DELETE' })
      showMsg(`Usuário ${modal.user.email} excluído`)
    }

    if (modal.type === 'reset') {
      const res = await fetch(`/api/admin/users/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: true }),
      })
      const data = await res.json()
      setModal({ type: 'reset', user: modal.user, tempPassword: data.tempPassword })
      setActionLoading(false)
      await load()
      return
    }

    if (modal.type === 'create') {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email,
          name: createForm.name || undefined,
          plano: createForm.plano,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showMsg(`Usu\u00e1rio criado! Senha tempor\u00e1ria: ${data.tempPassword}`)
        setCreateForm({ email: '', name: '', analises: '5', mineracoes: '5', plano: 'starter' })
      } else {
        showMsg(data.error || 'Erro ao criar usuário')
        setActionLoading(false)
        return
      }
    }

    setActionLoading(false)
    setModal(null)
    setActionVal('')
    await load()
  }

  async function toggleAtivo(user: AdminUser) {
    const next = user.ativo ? 0 : 1
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: next }),
    })
    showMsg(`Conta ${next ? 'ativada' : 'desativada'}`)
    await load()
  }

  const pages = Math.ceil(total / LIMIT)

  const th: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 11,
    color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '11px 14px', fontSize: 13, color: '#ccc',
    borderBottom: '1px solid #141414', verticalAlign: 'middle',
  }
  const btn = (color = '#2a2a2a', textColor = '#aaa'): React.CSSProperties => ({
    padding: '4px 9px', background: color, border: 'none', borderRadius: 5,
    color: textColor, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', background: '#1a1a1a',
    border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Usuários</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>{total} cadastrados</p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          style={{ padding: '10px 18px', background: '#E8692A', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          + Criar Usuário
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar por email ou nome..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onKeyDown={(e) => e.key === 'Enter' && load(search, 1)}
          style={{ ...inputStyle, maxWidth: 360 }}
        />
      </div>

      {/* Toast */}
      {msg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: '#1e1e1e',
          border: '1px solid #333', borderRadius: 10, padding: '12px 18px',
          color: '#fff', fontSize: 13, zIndex: 9999,
        }}>
          {msg}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Email</th>
                <th style={th}>Nome</th>
                <th style={th}>Plano</th>
                <th style={th}>An{'\u00e1'}lises</th>
                <th style={th}>Minera{'\u00e7\u00f5'}es</th>
                <th style={th}>Slots</th>
                <th style={th}>Status</th>
                <th style={th}>Cadastro</th>
                <th style={th}>A{'\u00e7\u00f5'}es</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#444', padding: 32 }}>Carregando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#444', padding: 32 }}>Nenhum usuário encontrado</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} style={{ transition: 'background .1s' }}>
                  <td style={td}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.email}</span>
                  </td>
                  <td style={td}>{u.name || <span style={{ color: '#444' }}>—</span>}</td>
                  <td style={td}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: u.plano === 'premium' ? '#2a1f0a' : u.plano === 'starter' ? '#1a2e1a' : '#2a1a1a',
                      color: u.plano === 'premium' ? '#FF8C00' : u.plano === 'starter' ? '#4ade80' : '#f87171',
                    }}>
                      {u.plano.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ ...td, color: u.analises === 0 ? '#e55' : '#ccc' }}>{u.analises}/{u.max_analises || 5}</td>
                  <td style={{ ...td, color: (u.mineracoes || 0) === 0 ? '#e55' : '#ccc' }}>{u.mineracoes || 0}/{u.max_mineracoes || 5}</td>
                  <td style={td}>{u.max_slots_radar || 5}</td>
                  <td style={td}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: u.ativo ? '#1a2a1e' : '#2a1a1a',
                      color: u.ativo ? '#4ade80' : '#f87171',
                    }}>
                      {u.ativo ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#555', fontSize: 12 }}>{fmt(u.created_at)}</td>
                  <td style={{ ...td, color: '#555', fontSize: 12 }}>{fmt(u.last_analysis)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button style={btn('#1a2a1e', '#4ade80')} onClick={() => { setActionVal(''); setModal({ type: 'analises', user: u }) }}>+An{'\u00e1'}lises</button>
                      <button style={btn('#1a1e2a', '#60a5fa')} onClick={() => { setActionVal(''); setModal({ type: 'mineracoes', user: u }) }}>+Minera{'\u00e7\u00f5'}es</button>
                      <button style={btn()} onClick={() => toggleAtivo(u)}>{u.ativo ? 'Desativar' : 'Ativar'}</button>
                      <button style={btn('#2a2a1a', '#facc15')} onClick={() => setModal({ type: 'reset', user: u })}>Reset</button>
                      <button style={btn('#2a1a1a', '#f87171')} onClick={() => setModal({ type: 'delete', user: u })}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={btn()}
            >← Anterior</button>
            <span style={{ fontSize: 13, color: '#555' }}>Página {page} de {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              style={btn()}
            >Próxima →</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}
          onClick={() => !actionLoading && setModal(null)}
        >
          <div
            style={{ background: '#111', border: '1px solid #222', borderRadius: 14, padding: '28px 28px', maxWidth: 440, width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Add análises */}
            {(modal.type === 'analises' || modal.type === 'mineracoes' || modal.type === 'creditos') && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
                  {modal.type === 'analises' ? 'Adicionar An\u00e1lises' : modal.type === 'mineracoes' ? 'Adicionar Minera\u00e7\u00f5es' : 'Adicionar Cr\u00e9ditos'}
                </h3>
                <p style={{ color: '#666', fontSize: 13, marginBottom: 18 }}>{modal.user.email}</p>
                <input
                  type="number"
                  min={1}
                  value={actionVal}
                  onChange={(e) => setActionVal(e.target.value)}
                  placeholder="Quantidade"
                  autoFocus
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={doAction} disabled={!actionVal || actionLoading} style={{ flex: 1, padding: '11px', background: '#E8692A', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {actionLoading ? 'Salvando...' : 'Confirmar'}
                  </button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </>
            )}

            {/* Delete */}
            {modal.type === 'delete' && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f87171', margin: '0 0 10px' }}>Excluir Usuário</h3>
                <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
                  Tem certeza que quer excluir <strong style={{ color: '#fff' }}>{modal.user.email}</strong>? Esta ação não pode ser desfeita.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={doAction} disabled={actionLoading} style={{ flex: 1, padding: '11px', background: '#7f1d1d', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {actionLoading ? 'Excluindo...' : 'Excluir'}
                  </button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </>
            )}

            {/* Reset password */}
            {modal.type === 'reset' && !modal.tempPassword && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#facc15', margin: '0 0 10px' }}>Resetar Senha</h3>
                <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>
                  Gera nova senha temporária e envia por email para <strong style={{ color: '#fff' }}>{modal.user.email}</strong>.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={doAction} disabled={actionLoading} style={{ flex: 1, padding: '11px', background: '#E8692A', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {actionLoading ? 'Gerando...' : 'Resetar e Enviar Email'}
                  </button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </>
            )}

            {/* Reset password result */}
            {modal.type === 'reset' && modal.tempPassword && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', margin: '0 0 10px' }}>Senha resetada!</h3>
                <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>Email enviado para {modal.user.email}. Senha temporária:</p>
                <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 18, color: '#fff', letterSpacing: 2, textAlign: 'center' }}>
                  {modal.tempPassword}
                </div>
                <button onClick={() => setModal(null)} style={{ width: '100%', marginTop: 18, padding: '11px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 14, cursor: 'pointer' }}>Fechar</button>
              </>
            )}

            {/* Create user */}
            {modal.type === 'create' && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 18px' }}>Criar Usuário</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 5 }}>Email *</label>
                    <input type="email" value={createForm.email} onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@email.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 5 }}>Nome</label>
                    <input type="text" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do usuário" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 5 }}>Plano</label>
                    <select value={createForm.plano} onChange={(e) => setCreateForm(f => ({ ...f, plano: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="starter">Starter (5/5/5)</option>
                      <option value="premium">Premium (15/15/10)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 5 }}>An{'\u00e1'}lises</label>
                      <input type="number" min={0} value={createForm.analises} onChange={(e) => setCreateForm(f => ({ ...f, analises: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 5 }}>Minera{'\u00e7\u00f5'}es</label>
                      <input type="number" min={0} value={createForm.mineracoes} onChange={(e) => setCreateForm(f => ({ ...f, mineracoes: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                </div>
                <p style={{ color: '#555', fontSize: 12, marginTop: 12 }}>Uma senha temporária será gerada e enviada por email.</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={doAction} disabled={!createForm.email || actionLoading} style={{ flex: 1, padding: '11px', background: '#E8692A', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    {actionLoading ? 'Criando...' : 'Criar e Enviar Email'}
                  </button>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: '11px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div style={{ color: '#444', padding: 32 }}>Carregando...</div>}>
      <AdminUsersContent />
    </Suspense>
  )
}
