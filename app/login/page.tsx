'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login')
        return
      }

      router.push('/tool')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#080808;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
        .login-card{background:#0d0d0d;border:1px solid #1e1e1e;border-radius:16px;padding:48px 40px;width:100%;max-width:400px}
        .login-logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:32px;color:#fff}
        .login-logo span{color:#E8692A}
        h1{font-size:22px;font-weight:700;margin-bottom:6px}
        .login-sub{font-size:14px;color:#666;margin-bottom:32px}
        label{display:block;font-size:13px;color:#888;margin-bottom:6px}
        input{width:100%;background:#141414;border:1px solid #222;border-radius:8px;padding:12px 14px;color:#fff;font-size:14px;outline:none;transition:border-color .2s}
        input:focus{border-color:#E8692A}
        .field{margin-bottom:18px}
        .login-btn{width:100%;background:#E8692A;color:#fff;border:none;border-radius:8px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .2s;margin-top:4px}
        .login-btn:hover{opacity:.88}
        .login-btn:disabled{opacity:.5;cursor:not-allowed}
        .login-err{background:#2a0f0f;border:1px solid #5c1a1a;border-radius:8px;padding:10px 14px;font-size:13px;color:#ff6b6b;margin-bottom:18px}
        .login-hint{font-size:12px;color:#555;text-align:center;margin-top:20px}
      `}</style>

      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">Click<span>Clone</span></div>
          <h1>Entrar na sua conta</h1>
          <p className="login-sub">Use o email que você cadastrou na compra</p>

          {error && <div className="login-err">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie sua senha no primeiro acesso"
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>
          </form>

          <p className="login-hint">Primeiro acesso? Use qualquer senha — ela será definida automaticamente.</p>
        </div>
      </div>
    </>
  )
}
