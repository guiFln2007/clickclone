import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import os from 'os'

const execFileAsync = promisify(execFile)

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('video') as File | null
  if (!file) return NextResponse.json({ error: 'video file required' }, { status: 400 })

  const tmpDir = path.join(os.tmpdir(), 'ratoads-transcribe')
  await mkdir(tmpDir, { recursive: true })
  const id = Date.now()
  const tmpFile = path.join(tmpDir, `vid_${id}.mp4`)

  try {
    // Save uploaded video
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.byteLength < 1000) return NextResponse.json({ error: 'Arquivo de vídeo inválido' }, { status: 400 })
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

    return NextResponse.json({ transcript: transcript || 'Sem áudio detectado neste vídeo' })
  } catch (e) {
    console.error('[transcribe]', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  } finally {
    await unlink(tmpFile).catch(() => {})
  }
}
