'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>) },
  { href: '/admin/users', label: 'Usuários', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },
]

function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'linear-gradient(180deg, #0d0d0d 0%, #111 100%)',
      borderRight: '1px solid rgba(255,140,0,.08)',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #E8692A, #FF8C00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900, color: '#fff',
          }}>R</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>RatoAds</div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' }}>Admin</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, color: '#444', fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', padding: '0 8px 10px' }}>Menu</div>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <a
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                borderRadius: 10, fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#FF8C00' : '#777',
                background: active ? 'rgba(232,105,42,.08)' : 'transparent',
                border: active ? '1px solid rgba(232,105,42,.15)' : '1px solid transparent',
                textDecoration: 'none', marginBottom: 4, transition: 'all .2s',
              }}
            >
              {icon}
              {label}
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '10px 12px', background: 'transparent',
            border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, color: '#555',
            fontSize: 12, fontWeight: 500, cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: "'Sora', sans-serif" }}>
        {children}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#0a0a0a',
      color: '#fff', fontFamily: "'Sora', sans-serif",
    }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '36px 40px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
