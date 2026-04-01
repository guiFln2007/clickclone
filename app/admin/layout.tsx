'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '▦' },
  { href: '/admin/users', label: 'Usuários', icon: '◉' },
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
      width: 220, flexShrink: 0, background: '#111', borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
    }}>
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#E8692A', letterSpacing: 1 }}>RATOADS</div>
        <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>Painel Admin</div>
      </div>

      <nav style={{ padding: '10px 8px', flex: 1 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <a
              key={href}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 7, fontSize: 13, color: active ? '#fff' : '#666',
                background: active ? '#1e1e1e' : 'transparent',
                textDecoration: 'none', marginBottom: 2, transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </a>
          )
        })}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '1px solid #1a1a1a' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '8px 10px', background: 'transparent',
            border: '1px solid #222', borderRadius: 7, color: '#555',
            fontSize: 13, cursor: 'pointer', textAlign: 'left',
          }}
        >
          ↩ Sair
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'Roboto, sans-serif' }}>
        {children}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#0a0a0a',
      color: '#fff', fontFamily: 'Roboto, Helvetica, sans-serif',
    }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
