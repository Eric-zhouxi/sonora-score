import { useEffect, useMemo, useRef, useState } from 'react'
import TranscriptionLab from './TranscriptionLab'
import {
  createProject,
  midiToJianpu,
  midiToName,
  midiToStaffY,
  newNote,
  noteOnsets,
  parseProject,
  pitches,
  starterTracks,
  type Duration,
  type InstrumentId,
  type Track,
} from './music'

const durations: { value: Duration; label: string; symbol: string }[] = [
  { value: 1, label: '全音符', symbol: '𝅝' },
  { value: 0.5, label: '二分音符', symbol: '𝅗𝅥' },
  { value: 0.25, label: '四分音符', symbol: '♩' },
]

function Staff({ track, activeStep }: { track: Track; activeStep: number }) {
  const onsets = noteOnsets(track.notes)
  const timelineBeats = track.notes.reduce((end, note, index) => Math.max(end, onsets[index] + note.duration * 4), 0)
  const width = Math.max(760, timelineBeats * 58 + 180)
  return (
    <div className="staff-scroll" aria-label={`${track.name}五线谱`}>
      <svg className="staff" viewBox={`0 0 ${width} 160`} role="img">
        {[68, 80, 92, 104, 116].map((y) => (
          <line key={y} x1="32" x2={width - 24} y1={y} y2={y} className="staff-line" />
        ))}
        <text x="44" y="112" className="clef">𝄞</text>
        <line x1="96" x2="96" y1="68" y2="116" className="bar-line" />
        <text x="105" y="86" className="meter">4</text>
        <text x="105" y="108" className="meter">4</text>
        {track.notes.map((note, index) => {
          const x = 146 + onsets[index] * 58
          const y = midiToStaffY(note.midi)
          return (
            <g key={note.id} className={index === activeStep ? 'note active' : 'note'}>
              {y >= 110 && <line x1={x - 13} x2={x + 14} y1="116" y2="116" className="ledger" />}
              <ellipse cx={x} cy={y} rx="9" ry="6.5" transform={`rotate(-18 ${x} ${y})`} />
              {note.duration !== 1 && <line x1={x + 8} x2={x + 8} y1={y} y2={y - 39} />}
              <text x={x} y="145" textAnchor="middle" className="pitch-label">{midiToName(note.midi)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Jianpu({ track, activeStep }: { track: Track; activeStep: number }) {
  return (
    <div className="jianpu" aria-label={`${track.name}简谱`}>
      {track.notes.map((note, index) => {
        const { degree, octave } = midiToJianpu(note.midi)
        return (
          <button key={note.id} className={index === activeStep ? 'jianpu-note active' : 'jianpu-note'}>
            {octave > 0 && <i className="octave-dot top" />}
            <span>{degree}</span>
            {note.duration === 0.5 && <em>—</em>}
            {note.duration === 1 && <em>———</em>}
            {octave < 0 && <i className="octave-dot bottom" />}
          </button>
        )
      })}
    </div>
  )
}

export default function App() {
  const savedProject = useMemo(() => parseProject(localStorage.getItem('sonora.project')), [])
  const [tracks, setTracks] = useState<Track[]>(savedProject?.tracks ?? starterTracks)
  const [activeTrack, setActiveTrack] = useState<InstrumentId>('piano')
  const [duration, setDuration] = useState<Duration>(0.25)
  const [bpm, setBpm] = useState(savedProject?.bpm ?? 96)
  const [playing, setPlaying] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [view, setView] = useState<'compose' | 'transcribe'>('compose')
  const [saveState, setSaveState] = useState('本地草稿已保存')
  const playbackTimer = useRef<number | undefined>(undefined)
  const midiInput = useRef<HTMLInputElement>(null)
  const currentTrack = useMemo(() => tracks.find((track) => track.id === activeTrack)!, [tracks, activeTrack])

  useEffect(() => {
    setSaveState('正在保存…')
    const timer = window.setTimeout(() => {
      localStorage.setItem('sonora.project', JSON.stringify(createProject(bpm, tracks)))
      setSaveState('本地草稿已保存')
    }, 250)
    return () => window.clearTimeout(timer)
  }, [bpm, tracks])

  function updateTrack(id: InstrumentId, update: (track: Track) => Track) {
    setTracks((current) => current.map((track) => (track.id === id ? update(track) : track)))
  }

  function addNote(midi: number) {
    updateTrack(activeTrack, (track) => ({ ...track, notes: [...track.notes, newNote(midi, duration)] }))
    void import('./audio').then(({ previewNote }) => previewNote(activeTrack, midi))
  }

  function removeLastNote() {
    updateTrack(activeTrack, (track) => ({ ...track, notes: track.notes.slice(0, -1) }))
  }

  async function exportMidi() {
    const { projectToMidi } = await import('./midi')
    const bytes = projectToMidi(tracks, bpm)
    const blob = new Blob([Uint8Array.from(bytes).buffer], { type: 'audio/midi' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sonora-score.mid'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importMidi(file?: File) {
    if (!file) return
    try {
      const { midiToProject } = await import('./midi')
      const imported = midiToProject(await file.arrayBuffer())
      setTracks(imported.tracks)
      setBpm(imported.bpm)
      setActiveTrack('piano')
      setSaveState('MIDI 已导入')
    } catch {
      setSaveState('MIDI 导入失败')
    }
  }

  function importTranscription(notes: ReturnType<typeof newNote>[]) {
    updateTrack('piano', (track) => ({ ...track, notes }))
    setActiveTrack('piano')
    setView('compose')
    setSaveState('转录结果已导入')
  }

  async function togglePlayback() {
    if (playing) {
      const { stopPlayback } = await import('./audio')
      stopPlayback()
      if (playbackTimer.current) window.clearTimeout(playbackTimer.current)
      setPlaying(false)
      setActiveStep(-1)
      return
    }
    setPlaying(true)
    const { playTracks } = await import('./audio')
    const playbackLength = await playTracks(tracks, bpm, setActiveStep)
    playbackTimer.current = window.setTimeout(() => {
      setPlaying(false)
      setActiveStep(-1)
    }, playbackLength)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div className="brand-copy">
          <strong>Sonora</strong>
          <span>SCORE LAB</span>
        </div>
        <nav>
          <button className={view === 'compose' ? 'nav-item active' : 'nav-item'} onClick={() => setView('compose')}>创作台</button>
          <button className={view === 'transcribe' ? 'nav-item active' : 'nav-item'} onClick={() => setView('transcribe')}>智能扒谱 <small>ALPHA</small></button>
        </nav>
        <div className="status-pill"><i /> {saveState}</div>
      </header>

      {view === 'compose' ? <>
      <section className="workspace-header">
        <div>
          <p className="eyebrow">PROJECT 01 / UNTITLED</p>
          <h1>把脑海里的旋律，<br /><span>变成看得见的音乐。</span></h1>
        </div>
        <div className="transport">
          <div className="tempo">
            <span>速度</span>
            <strong>{bpm}</strong>
            <small>BPM</small>
            <input aria-label="速度" type="range" min="60" max="160" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
          </div>
          <button className="play-button" onClick={() => void togglePlayback()}>{playing ? '■' : '▶'}</button>
        </div>
      </section>

      <section className="studio-grid">
        <aside className="track-panel">
          <div className="panel-title"><span>音轨</span><small>{tracks.length} TRACKS</small></div>
          {tracks.map((track) => (
            <button key={track.id} className={track.id === activeTrack ? 'track-card selected' : 'track-card'} onClick={() => setActiveTrack(track.id)}>
              <span className="instrument-icon" style={{ background: track.color }}>{track.id === 'piano' ? '♬' : '𝄢'}</span>
              <span className="track-name"><strong>{track.name}</strong><small>{track.notes.length} 个音符</small></span>
              <i className="track-color" style={{ background: track.color }} />
            </button>
          ))}
          <button className="add-track" disabled>＋ 添加音轨</button>
          <div className="phase-card">
            <span>当前能力</span>
            <strong>复音转录，保留和弦起音</strong>
            <div><i style={{ width: '62%' }} /></div>
            <small>下一步：真实歌曲分轨</small>
          </div>
        </aside>

        <section className="score-panel">
          <div className="score-toolbar">
            <div className="view-switch"><button className="active">五线谱</button><button>简谱同步</button></div>
            <div className="duration-picker">
              <input ref={midiInput} type="file" accept="audio/midi,.mid,.midi" hidden onChange={(event) => void importMidi(event.target.files?.[0])} />
              <button className="text-tool" title="导入 MIDI" onClick={() => midiInput.current?.click()}>导入</button>
              <button className="text-tool" title="导出 MIDI" onClick={() => void exportMidi()}>导出</button>
              {durations.map((item) => <button key={item.value} title={item.label} className={duration === item.value ? 'active' : ''} onClick={() => setDuration(item.value)}>{item.symbol}</button>)}
              <button title="删除末尾音符" onClick={removeLastNote}>⌫</button>
            </div>
          </div>
          <div className="score-heading">
            <div><span style={{ background: currentTrack.color }} /> <strong>{currentTrack.name}</strong></div>
            <p>C 大调 · 4/4</p>
          </div>
          <Staff track={currentTrack} activeStep={activeStep} />
          <div className="notation-divider"><span>同步简谱</span></div>
          <Jianpu track={currentTrack} activeStep={activeStep} />
          <div className="keyboard-section">
            <div className="keyboard-copy"><strong>输入音符</strong><span>选择时值后点击琴键</span></div>
            <div className="keyboard">
              {pitches.map((midi) => <button key={midi} onClick={() => addNote(midi)}><span>{midiToName(midi)}</span><kbd>{midiToJianpu(midi).degree}</kbd></button>)}
            </div>
          </div>
        </section>
      </section>
      </> : <TranscriptionLab bpm={bpm} onImport={importTranscription} />}

      <footer>
        <span>SONORA SCORE · MVP 0.1</span>
        <span>谱面 ⇄ MIDI ⇄ 音频</span>
      </footer>
    </main>
  )
}
