import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''
  const tmpDir = path.join(os.tmpdir(), 'ratoads-transcribe')
  await mkdir(tmpDir, { recursive: true })
  const id = Date.now()
  const tmpFile = path.join(tmpDir, `vid_${id}.mp4`)

  try {
    let buf: Buffer

    if (contentType.includes('application/json')) {
      // Mode 1: URL — server downloads the video (avoids CORS)
      const { url } = await req.json() as { url?: string }
      if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

      const vidRes = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      })
      if (!vidRes.ok) return NextResponse.json({ error: `Download falhou (HTTP ${vidRes.status})` }, { status: 502 })
      buf = Buffer.from(await vidRes.arrayBuffer())
    } else {
      // Mode 2: File upload (legacy)
      const formData = await req.formData()
      const file = formData.get('video') as File | null
      if (!file) return NextResponse.json({ error: 'video file required' }, { status: 400 })
      buf = Buffer.from(await file.arrayBuffer())
    }

    if (buf.byteLength < 1000) return NextResponse.json({ error: 'Arquivo de video invalido' }, { status: 400 })
    await writeFile(tmpFile, buf)

    // Transcribe with Whisper
    const { stdout, stderr } = await execFileAsync('whisper', [
      tmpFile,
      '--model', 'base',
      '--language', 'pt',
      '--output_format', 'txt',
      '--output_dir', tmpDir,
    ], { timeout: 120000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 })

    // Read transcript file
    let transcript = ''
    const txtFile = path.join(tmpDir, `vid_${id}.txt`)
    try {
      transcript = (await readFile(txtFile, 'utf-8')).trim()
      await unlink(txtFile).catch(() => {})
    } catch {
      // Fallback: parse stdout
      const lines = (stdout + stderr).split('\n').filter(l => l.includes(']') && !l.startsWith('['))
      transcript = lines.map(l => l.replace(/^\[.*?\]\s*/, '')).join(' ').trim()
    }

    // Clean up whisper output files
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
