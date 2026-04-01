'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Senha incorreta')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0a0a0a',
    }}>
      <div style={{
        background: '#111', border: '1px solid #1e1e1e', borderRadius: 16,
        padding: '40px 36px', width: '100%', maxWidth: 380,
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#E8692A', letterSpacing: 1 }}>RATOADS</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 8 }}>Painel Admin</h1>
          <p style={{ color: '#555', fontSize: 13, marginTop: 4 }}>Acesso restrito</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoFocus
            required
            style={{
              width: '100%', padding: '11px 14px', background: '#1a1a1a',
              border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff',
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />

          {error && (
            <p style={{ color: '#e55', fontSize: 13, marginTop: 8 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', marginTop: 18, padding: '12px', background: '#E8692A',
              border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>
      </div>
    </div>
  )
}
