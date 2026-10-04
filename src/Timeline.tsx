import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { clipRegions } from './arrangement'
import { beatsToSeconds, secondsToBeats, trackDurationBeats, type ProjectData } from './workspace'

interface Props {
  project: ProjectData
  position: number
  selectedClipId: string | null
  onSeek: (seconds: number) => void
  onSelect: (trackId: string, clipId: string) => void
  onMoveClip: (trackId: string, clipId: string, startBeats: number) => void
  onOpenTrack: (trackId: string) => void
}
interface Drag { trackId: string; clipId: string; initialX: number; startBeats: number; nextBeats: number }

export default function Timeline({ project, position, selectedClipId, onSeek, onSelect, onMoveClip, onOpenTrack }: Props) {
  const [zoom, setZoom] = useState(80), [snap, setSnap] = useState(0.25)
  const [preview, setPreview] = useState<{ id: string; start: number } | null>(null)
  const drag = useRef<Drag | null>(null), seeking = useRef(false), ruler = useRef<HTMLDivElement>(null)
  const duration = Math.max(12, Math.ceil(beatsToSeconds(Math.max(...project.tracks.map((track) => Math.max(trackDurationBeats(track.notes), ...clipRegions(track).map((clip) => clip.startBeats))), 0), project.bpm)) + 4)
  const width = duration * zoom
  const tickStep = duration > 90 ? 5 : duration > 35 ? 2 : 1
  function seek(event: PointerEvent) {
    if (!ruler.current) return
    const rect = ruler.current.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(duration, (event.clientX - rect.left) / zoom)))
  }
  function beginClip(event: PointerEvent<HTMLButtonElement>, trackId: string, clipId: string, startBeats: number) {
    event.stopPropagation()
    onSelect(trackId, clipId)
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { trackId, clipId, startBeats, nextBeats: startBeats, initialX: event.clientX }
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (!current) return
    const raw = current.startBeats + secondsToBeats((event.clientX - current.initialX) / zoom, project.bpm)
    current.nextBeats = Math.max(0, snap ? Math.round(raw / snap) * snap : Math.round(raw * 1000) / 1000)
    setPreview({ id: current.clipId, start: current.nextBeats })
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current
    if (current) onMoveClip(current.trackId, current.clipId, current.nextBeats)
    drag.current = null
    setPreview(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <section className="timeline-panel" aria-label="总秒时间轴">
    <div className="section-heading"><div><span className="eyebrow">ARRANGEMENT / 编排</span><h2>总时间轴</h2></div><div className="timeline-controls">
      <label>当前位置 <input aria-label="当前位置秒数" type="number" min="0" step="0.1" value={Number(position.toFixed(2))} onChange={(event) => onSeek(Math.max(0, Number(event.target.value)))} /> 秒</label>
      <label>吸附 <select aria-label="时间轴吸附" value={snap} onChange={(event) => setSnap(Number(event.target.value))}><option value="0.25">十六分音符</option><option value="0.5">八分音符</option><option value="1">一拍</option><option value="0">自由拖动</option></select></label>
      <label>缩放 <input aria-label="时间轴缩放" type="range" min="40" max="150" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
    </div></div>
    <p className="helper">拖动片段改变起始时间；拖动青色指针或点击秒刻度定位，双击片段编辑声部。</p>
    <div className="timeline-scroll"><div className="timeline-canvas" style={{ width: width + 180, '--second-width': `${zoom}px` } as CSSProperties}>
      <div className="timeline-ruler"><span className="timeline-label">声部 / 秒</span><div className="second-ruler" ref={ruler} style={{ width }} onPointerDown={(event) => { seeking.current = true; event.currentTarget.setPointerCapture(event.pointerId); seek(event) }} onPointerMove={(event) => { if (seeking.current) seek(event) }} onPointerUp={() => { seeking.current = false }} onPointerCancel={() => { seeking.current = false }}>
        {Array.from({ length: Math.floor(duration / tickStep) + 1 }, (_, i) => <span key={i} style={{ left: i * tickStep * zoom }}>{i * tickStep}<small>s</small></span>)}
      </div></div>
      {project.tracks.map((track) => <div key={track.id} className={`timeline-track ${track.muted ? 'is-muted' : ''}`}>
        <button className="timeline-label" onDoubleClick={() => onOpenTrack(track.id)}><i style={{ background: track.color }} /><strong>{track.name}</strong><small>{track.keySignature} · {track.timeSignature}</small></button>
        <div className="clip-lane" style={{ width }}>
          {clipRegions(track).map((clip) => {
            const start = preview?.id === clip.id ? preview.start : clip.startBeats
            const clipSeconds = beatsToSeconds(Math.max(1, clip.endBeats - clip.startBeats), project.bpm)
            return <button key={clip.id} className={`music-clip ${clip.id === selectedClipId ? 'selected' : ''}`} style={{ left: beatsToSeconds(start, project.bpm) * zoom, width: clipSeconds * zoom, '--clip-color': track.color } as CSSProperties}
              aria-label={`${track.name} ${clip.name}，起始 ${beatsToSeconds(start, project.bpm).toFixed(2)} 秒`}
              title={`${clip.name} · ${beatsToSeconds(start, project.bpm).toFixed(2)} 秒`}
              onPointerDown={(event) => beginClip(event, track.id, clip.id, clip.startBeats)} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { drag.current = null; setPreview(null) }}
              onDoubleClick={() => onOpenTrack(track.id)} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onSelect(track.id, clip.id); onMoveClip(track.id, clip.id, Math.max(0, clip.startBeats + (event.key === 'ArrowLeft' ? -1 : 1) * (snap || 0.25))) } }}>
              <span>{clip.name}</span><small>{beatsToSeconds(start, project.bpm).toFixed(2)}s</small>
              <div className="clip-notes" aria-hidden="true">{clip.notes.map((note) => <i key={note.id} style={{ left: `${(note.onsetBeats! - clip.startBeats) / Math.max(1, clip.endBeats - clip.startBeats) * 100}%`, width: `${Math.max(2, note.duration * 4 / Math.max(1, clip.endBeats - clip.startBeats) * 100)}%`, top: `${18 - (note.midi % 12) * 1.2}px` }} />)}</div>
            </button>
          })}
        </div>
      </div>)}
      <div className="playhead" role="slider" tabIndex={0} aria-label="播放时间指针" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Number(position.toFixed(2))} style={{ left: 180 + Math.min(position, duration) * zoom }}
        onPointerDown={(event) => { seeking.current = true; event.currentTarget.setPointerCapture(event.pointerId); seek(event) }} onPointerMove={(event) => { if (seeking.current) seek(event) }} onPointerUp={() => { seeking.current = false }} onPointerCancel={() => { seeking.current = false }}
        onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); onSeek(Math.max(0, Math.min(duration, position + (event.key === 'ArrowLeft' ? -0.1 : 0.1)))) } }}><span /></div>
    </div></div>
  </section>
}
