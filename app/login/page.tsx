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
        html,body{background:#060606;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow-x:hidden}

        .login-wrap{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden}

        /* ambient orange glow */
        .glow{position:absolute;inset:0;pointer-events:none;z-index:0}
        .glow::before{content:"";position:absolute;top:-20%;left:50%;transform:translateX(-50%);width:780px;height:780px;background:radial-gradient(circle, rgba(255,106,0,.18) 0%, rgba(255,106,0,.05) 35%, transparent 65%);filter:blur(40px);animation:pulse 6s ease-in-out infinite}
        .glow::after{content:"";position:absolute;bottom:-30%;right:-10%;width:520px;height:520px;background:radial-gradient(circle, rgba(255,106,0,.12) 0%, transparent 60%);filter:blur(50px);animation:pulse 8s ease-in-out infinite reverse}
        @keyframes pulse{0%,100%{opacity:.7;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.08)}}

        /* subtle grid */
        .grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px);background-size:40px 40px;z-index:0;mask-image:radial-gradient(ellipse at center, black 0%, transparent 70%)}

        .login-card{position:relative;z-index:1;background:linear-gradient(180deg,rgba(18,18,18,.9) 0%,rgba(10,10,10,.95) 100%);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:44px 38px 36px;width:100%;max-width:420px;backdrop-filter:blur(20px);box-shadow:0 30px 80px -20px rgba(0,0,0,.7),0 0 40px -10px rgba(255,106,0,.1);animation:slideUp .6s cubic-bezier(.2,.9,.3,1.2)}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

        .login-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}
        .login-brand img{height:44px;width:auto;filter:drop-shadow(0 0 18px rgba(255,106,0,.45))}
        .login-brand-txt{font-size:19px;font-weight:800;letter-spacing:-.5px;color:#fff}
        .login-brand-txt span{color:#FF6A00}

        h1{font-size:23px;font-weight:800;margin-bottom:8px;letter-spacing:-.3px;line-height:1.15}
        .login-sub{font-size:13.5px;color:#707070;margin-bottom:30px;line-height:1.5}

        label{display:block;font-size:11px;font-weight:700;color:#888;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase}
        .field{margin-bottom:18px;position:relative}
        input{width:100%;background:rgba(20,20,20,.8);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;color:#fff;font-size:14.5px;outline:none;transition:all .25s ease;font-family:inherit}
        input::placeholder{color:#444}
        input:focus{border-color:rgba(255,106,0,.5);background:rgba(25,25,25,.9);box-shadow:0 0 0 4px rgba(255,106,0,.08)}

        .login-btn{width:100%;background:linear-gradient(180deg,#FF7A1A 0%,#E8692A 100%);color:#fff;border:none;border-radius:10px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s ease;margin-top:10px;letter-spacing:-.2px;box-shadow:0 8px 24px -6px rgba(255,106,0,.45),inset 0 1px 0 rgba(255,255,255,.15)}
        .login-btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px -6px rgba(255,106,0,.55),inset 0 1px 0 rgba(255,255,255,.2)}
        .login-btn:active{transform:translateY(0)}
        .login-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

        .login-err{background:rgba(255,50,50,.08);border:1px solid rgba(255,80,80,.25);border-radius:10px;padding:11px 14px;font-size:13px;color:#ff8a8a;margin-bottom:18px;display:flex;align-items:center;gap:8px}

        .login-hint{font-size:11.5px;color:#555;text-align:center;margin-top:22px;line-height:1.5}

        .login-foot{position:absolute;bottom:24px;left:0;right:0;text-align:center;z-index:1;font-size:11px;color:#333}
        .login-foot a{color:#555;text-decoration:none}
      `}</style>

      <div className="login-wrap">
        <div className="grid-bg"></div>
        <div className="glow"></div>

        <div className="login-card">
          <div className="login-brand">
            <img src="/logo.png" alt="RatoAds" />
            <div className="login-brand-txt">Rato<span>Ads</span></div>
          </div>

          <h1>Entrar na sua conta</h1>
          <p className="login-sub">Use o email que você cadastrou na compra.</p>

          {error && <div className="login-err"><span>⚠</span>{error}</div>}

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
                placeholder="Sua senha"
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

        <div className="login-foot">
          © {new Date().getFullYear()} RatoAds · <a href="/">ratoads.com.br</a>
        </div>
      </div>
    </>
  )
}
