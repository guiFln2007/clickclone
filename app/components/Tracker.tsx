'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = localStorage.getItem('rato_sid')
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('rato_sid', sid)
  }
  return sid
}

function getUtms(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const utms: Record<string, string> = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const val = params.get(key)
    if (val) utms[key] = val
  }
  return utms
}

export default function Tracker() {
  const pathname = usePathname()
  const prevPage = useRef<string>('')

  useEffect(() => {
    // Don't track admin pages
    if (pathname.startsWith('/admin')) return

    const sid = getSessionId()
    if (!sid) return

    const utms = getUtms()

    const send = () => {
      const payload: Record<string, string | null> = {
        session_id: sid,
        page: pathname,
        referrer: document.referrer || null,
        _prevPage: prevPage.current || null,
        ...utms,
      }

      // Try to get logged in user info from cookie/localStorage
      try {
        const userRaw = localStorage.getItem('rato_user')
        if (userRaw) {
          const user = JSON.parse(userRaw)
          if (user.id) payload.user_id = user.id
          if (user.email) payload.email = user.email
        }
      } catch { /* ignore */ }

      fetch('/api/tracking/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {})

      prevPage.current = pathname
    }

    // Send immediately on page change
    send()

    // Then heartbeat every 30s
    const interval = setInterval(send, 30000)
    return () => clearInterval(interval)
  }, [pathname])

  return null
}
