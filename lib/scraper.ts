const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

export async function callScraper(endpoint: string, body: Record<string, unknown>, timeoutMs = 180000) {
  if (!SCRAPER_URL) throw new Error('SCRAPER_URL não configurado')
  const res = await fetch(`${SCRAPER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SCRAPER_SECRET}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>
    throw new Error(err.error || `Scraper error: ${res.status}`)
  }
  return res.json()
}

export async function scraperHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SCRAPER_URL}/health`, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}
