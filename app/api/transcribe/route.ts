import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

const SCRAPER_URL = process.env.SCRAPER_URL || ''
const SCRAPER_SECRET = process.env.SCRAPER_SECRET || ''

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''

  let videoUrl: string | null = null
  let buf: Buffer | null = null

  if (contentType.includes('application/json')) {
    const { url } = await req.json() as { url?: string }
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })
    videoUrl = url
  } else {
    const formData = await req.formData()
    const file = formData.get('video') as File | null
    if (!file) return NextResponse.json({ error: 'video file required' }, { status: 400 })
    buf = Buffer.from(await file.arrayBuffer())
  }

  // 1ª tentativa: scraper local (tem Whisper instalado)
  if (SCRAPER_URL && videoUrl) {
    try {
      const res = await fetch(`${SCRAPER_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SCRAPER_SECRET}` },
        body: JSON.stringify({ url: videoUrl }),
        signal: AbortSignal.timeout(120000),
      })
      if (res.ok) {
        const data = await res.json() as { transcript?: string }
        if (data.transcript) return NextResponse.json({ transcript: data.transcript })
      }
      console.warn('[transcribe] Scraper local falhou, tentando local whisper...')
    } catch (e) {
      console.warn('[transcribe] Scraper local erro:', (e as Error).message)
    }
  }

  // 2ª tentativa: Whisper local no servidor (Hostinger não tem, mas dev sim)
  const tmpDir = path.join(os.tmpdir(), 'ratoads-transcribe')
  await mkdir(tmpDir, { recursive: true })
  const id = Date.now()
  const tmpFile = path.join(tmpDir, `vid_${id}.mp4`)

  try {
    if (!buf && videoUrl) {
      const vidRes = await fetch(videoUrl, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
      })
      if (!vidRes.ok) return NextResponse.json({ error: `Download falhou (HTTP ${vidRes.status})` }, { status: 502 })
      buf = Buffer.from(await vidRes.arrayBuffer())
    }

    if (!buf || buf.byteLength < 1000) return NextResponse.json({ error: 'Arquivo de video invalido' }, { status: 400 })
    await writeFile(tmpFile, buf)

    const { stdout, stderr } = await execFileAsync('whisper', [
      tmpFile, '--model', 'base', '--language', 'pt',
      '--output_format', 'txt', '--output_dir', tmpDir,
    ], { timeout: 120000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 })

    let transcript = ''
    const txtFile = path.join(tmpDir, `vid_${id}.txt`)
    try {
      transcript = (await readFile(txtFile, 'utf-8')).trim()
      await unlink(txtFile).catch(() => {})
    } catch {
      const lines = (stdout + stderr).split('\n').filter(l => l.includes(']') && !l.startsWith('['))
      transcript = lines.map(l => l.replace(/^\[.*?\]\s*/, '')).join(' ').trim()
    }

    for (const ext of ['.vtt', '.srt', '.tsv', '.json']) {
      await unlink(path.join(tmpDir, `vid_${id}${ext}`)).catch(() => {})
    }

    return NextResponse.json({ transcript: transcript || 'Sem audio detectado neste video' })
  } catch (e) {
    console.error('[transcribe]', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}
