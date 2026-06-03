import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { videoUrl } = await req.json()
  if (!videoUrl) return NextResponse.json({ error: 'videoUrl required' }, { status: 400 })

  const tmpDir = path.join(os.tmpdir(), 'ratoads-transcribe')
  await mkdir(tmpDir, { recursive: true })
  const tmpFile = path.join(tmpDir, `vid_${Date.now()}.mp4`)
  const txtFile = tmpFile.replace('.mp4', '.txt')

  try {
    // Download video
    const res = await fetch(videoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return NextResponse.json({ error: 'Failed to download video' }, { status: 502 })
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(tmpFile, buf)

    // Transcribe with Whisper
    const { stdout } = await execFileAsync('whisper', [
      tmpFile,
      '--model', 'base',
      '--language', 'pt',
      '--output_format', 'txt',
      '--output_dir', tmpDir,
    ], { timeout: 90000, windowsHide: true, maxBuffer: 5 * 1024 * 1024 })

    // Read transcript
    let transcript = ''
    try {
      const { readFile } = await import('fs/promises')
      transcript = (await readFile(txtFile, 'utf-8')).trim()
    } catch {
      // Fallback: parse stdout
      transcript = stdout.trim()
    }

    return NextResponse.json({ transcript: transcript || 'Sem áudio detectado' })
  } catch (e) {
    console.error('[transcribe]', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    // Cleanup
    await unlink(tmpFile).catch(() => {})
    await unlink(txtFile).catch(() => {})
  }
}
