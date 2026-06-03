import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export const maxDuration = 120

async function downloadVideo(videoUrl: string, dest: string): Promise<boolean> {
  // Try 1: direct fetch (works if URL hasn't expired)
  try {
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://www.facebook.com/',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > 1000) { // valid video, not error page
        await writeFile(dest, buf)
        return true
      }
    }
  } catch { /* try next */ }

  // Try 2: curl with Facebook headers (handles redirects better)
  try {
    await execFileAsync('curl', [
      '-s', '-L', '--compressed', '--max-time', '30',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      '-H', 'Referer: https://www.facebook.com/',
      '-o', dest,
      videoUrl,
    ], { timeout: 35000, windowsHide: true })
    const { statSync } = await import('fs')
    if (statSync(dest).size > 1000) return true
  } catch { /* failed */ }

  return false
}

export async function POST(req: NextRequest) {
  const { videoUrl } = await req.json()
  if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

  const tmpDir = path.join(os.tmpdir(), 'ratoads-transcribe')
  await mkdir(tmpDir, { recursive: true })
  const id = Date.now()
  const tmpFile = path.join(tmpDir, `vid_${id}.mp4`)

  try {
    // Download
    const ok = await downloadVideo(videoUrl, tmpFile)
    if (!ok) return NextResponse.json({ error: 'Video expirado ou inacessível' }, { status: 502 })

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
      // Fallback: parse stdout (whisper prints transcript to stdout too)
      const lines = (stdout + stderr).split('\n').filter(l => l.includes(']') && !l.startsWith('['))
      transcript = lines.map(l => l.replace(/^\[.*?\]\s*/, '')).join(' ').trim()
    }

    // Also clean up any other whisper output files
    for (const ext of ['.vtt', '.srt', '.tsv', '.json']) {
      await unlink(path.join(tmpDir, `vid_${id}${ext}`)).catch(() => {})
    }

    return NextResponse.json({ transcript: transcript || 'Sem áudio detectado neste vídeo' })
  } catch (e) {
    console.error('[transcribe]', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}
