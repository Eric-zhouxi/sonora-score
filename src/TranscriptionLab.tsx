import { useRef, useState } from 'react'
import type { NoteEvent } from './music'
import { midiToName, newNote, type Duration } from './music'

interface ApiNote {
  midi: number
  onsetSeconds: number
  durationSeconds: number
  confidence: number
}

interface ApiChord {
  label: string
  startSeconds: number
  endSeconds: number
  confidence: number
}

interface AnalysisResult {
  engine: string
  sampleRate: number
  durationSeconds: number
  notes: ApiNote[]
  chords: ApiChord[]
}

function nearestDuration(seconds: number, bpm: number): Duration {
  const beats = seconds / (60 / bpm)
  const candidates: Duration[] = [0.25, 0.5, 1, 2]
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate * 4 - beats) < Math.abs(best * 4 - beats) ? candidate : best,
  )
}

async function waveformFromFile(file: File): Promise<number[]> {
  const context = new AudioContext()
  const decoded = await context.decodeAudioData(await file.arrayBuffer())
  const channel = decoded.getChannelData(0)
  const bars = 72
  const size = Math.max(1, Math.floor(channel.length / bars))
  const peaks = Array.from({ length: bars }, (_, index) => {
    let peak = 0
    const end = Math.min(channel.length, (index + 1) * size)
    for (let cursor = index * size; cursor < end; cursor += 32) peak = Math.max(peak, Math.abs(channel[cursor]))
    return peak
  })
  await context.close()
  const max = Math.max(...peaks, 0.01)
  return peaks.map((peak) => peak / max)
}

export default function TranscriptionLab({ bpm, onImport }: { bpm: number; onImport: (notes: NoteEvent[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [waveform, setWaveform] = useState<number[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'ready' | 'working' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('支持 PCM WAV；首版基线适合钢琴单音、旋律与稳定和弦。')

  async function chooseFile(selected?: File) {
    if (!selected) return
    setFile(selected)
    setResult(null)
    setStatus('working')
    try {
      setWaveform(await waveformFromFile(selected))
      setStatus('ready')
      setMessage('波形已读取，可以开始本地分析。')
    } catch {
      setStatus('error')
      setMessage('浏览器无法解码该音频，请换成 WAV 文件。')
    }
  }

  async function analyze() {
    if (!file) return
    setStatus('working')
    setMessage('正在提取音高、起音与和弦色度…')
    try {
      const response = await fetch('/api/v1/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'audio/wav' },
        body: file,
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as AnalysisResult
      setResult(data)
      setStatus('done')
      setMessage(`完成：识别到 ${data.notes.length} 个音符、${data.chords.length} 个和弦片段。`)
    } catch {
      setStatus('error')
      setMessage('转录服务未启动或文件格式不受支持。请先运行 transcription 本地服务。')
    }
  }

  function importNotes() {
    if (!result) return
    onImport(result.notes.map((note) => ({
      ...newNote(note.midi, nearestDuration(note.durationSeconds, bpm)),
      velocity: Math.max(0.25, Math.min(1, note.confidence)),
    })))
  }

  return (
    <section className="transcription-lab">
      <div className="lab-intro">
        <p className="eyebrow">M1 / AUDIO TO SCORE</p>
        <h2>听见声音，<br /><span>拆出它的音符与和弦。</span></h2>
        <p>先以可解释的 DSP 基线建立评测闭环，之后可无缝替换为 Basic Pitch 或自训练模型。</p>
      </div>
      <div className="upload-card">
        <input ref={inputRef} type="file" accept="audio/wav,.wav" hidden onChange={(event) => void chooseFile(event.target.files?.[0])} />
        <button className="drop-zone" onClick={() => inputRef.current?.click()}>
          <span className="upload-icon">↥</span>
          <strong>{file ? file.name : '选择一段钢琴 WAV 音频'}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '文件只在本机转录服务中处理'}</small>
        </button>
        <div className="waveform" aria-label="音频波形">
          {(waveform.length ? waveform : Array.from({ length: 72 }, () => 0.08)).map((value, index) => (
            <i key={index} style={{ height: `${Math.max(4, value * 74)}px` }} />
          ))}
        </div>
        <div className={`analysis-status ${status}`}><i /><span>{message}</span></div>
        <button className="analyze-button" disabled={!file || status === 'working'} onClick={() => void analyze()}>
          {status === 'working' ? '分析中…' : '开始扒谱'}
        </button>
      </div>

      {result && (
        <div className="analysis-result">
          <div className="result-heading">
            <div><span>转录结果</span><strong>{result.engine}</strong></div>
            <button onClick={importNotes}>导入钢琴音轨</button>
          </div>
          <div className="result-metrics">
            <div><strong>{result.durationSeconds.toFixed(1)}s</strong><span>音频时长</span></div>
            <div><strong>{result.notes.length}</strong><span>音符事件</span></div>
            <div><strong>{result.chords.length}</strong><span>和弦片段</span></div>
          </div>
          <div className="piano-roll">
            {result.notes.slice(0, 32).map((note, index) => (
              <span key={`${note.onsetSeconds}-${index}`} style={{ width: `${Math.max(22, note.durationSeconds * 52)}px` }}>
                {midiToName(note.midi)} <small>{Math.round(note.confidence * 100)}%</small>
              </span>
            ))}
          </div>
          <div className="chord-timeline">
            {result.chords.slice(0, 16).map((chord, index) => (
              <div key={`${chord.startSeconds}-${index}`}><strong>{chord.label}</strong><small>{chord.startSeconds.toFixed(1)}–{chord.endSeconds.toFixed(1)}s</small></div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
