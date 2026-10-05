import { useRef } from 'react'
import { keyAlterations, scoreEvents, selectedScore, writtenPitch, type ScoreEvent } from './arrangement'
import { beatsPerMeasure, defaultSpellingForKey, midiToJianpu, midiToName, trackKey, trackMeter, type ProjectData, type Track } from './workspace'
import { keySignatureMarks, trackForStaff, type Clef } from './staffLayout'
import { drumInfo, drumName } from './instruments'

function noteShape(beats: number) {
  const dotted = [0.375, 0.75, 1.5, 3, 6].some((value) => Math.abs(beats - value) < 0.0001)
  return { value: dotted ? beats / 1.5 : beats, dotted }
}
function Rest({ event, x }: { event: ScoreEvent; x: number }) {
  const { value, dotted } = noteShape(event.durationBeats)
  return <g className="score-rest" aria-label={`休止符 ${event.durationBeats} 拍`}>
    {event.fullMeasure || value >= 4 ? <rect x={x - 7} y="80" width="14" height="5" /> : value >= 2 ? <rect x={x - 7} y="87" width="14" height="5" /> : value >= 1 ? <path d={`M ${x + 2} 79 l -5 8 l 7 7 l -7 7 q -7 6 0 12 q -10 -1 -8 -9 l 8 -9 l -6 -7 Z`} /> : <text x={x - 7} y="104" className="rest-glyph">{value >= 0.5 ? '𝄾' : '𝄿'}</text>}
    {!event.fullMeasure && dotted && <circle cx={x + 12} cy="93" r="2" />}
    <text x={x} y="169" textAnchor="middle" className="rest-caption">{event.fullMeasure ? '整小节休止' : `${Number(event.durationBeats.toFixed(3))} 拍`}</text>
  </g>
}

function TrackStaff({ project, track, clef, endBeats, selectedId, positionBeats, onSelect, startX, pxPerBeat, width }: { project: ProjectData; track: Track; clef: Clef; endBeats: number; selectedId?: string | null; positionBeats?: number; onSelect?: (id: string) => void; startX: number; pxPerBeat: number; width: number }) {
  const key = trackKey(track, project), meter = trackMeter(track, project), measure = beatsPerMeasure(meter)
  const events = scoreEvents(trackForStaff(track, clef, key), meter, endBeats), [numerator, denominator] = meter.split('/')
  const bass = clef === 'bass'
  const percussion = clef === 'percussion'
  const octaveDown = ['guitar', 'electricGuitar', 'bass'].includes(track.instrument)
  const accidentals = keyAlterations(key)
  let currentMeasure = -1, state: Record<string, number> = {}
  return <g className="staff" data-clef={clef} aria-label={`${track.name}${percussion ? '打击乐' : bass ? '低音' : '高音'}谱表`}>
    {[68, 80, 92, 104, 116].map((y) => <line key={y} x1="28" x2={width - 24} y1={y} y2={y} className="score-line" />)}
    {percussion ? <g className="percussion-clef" aria-label="打击乐谱号" fill="#e3eaf4"><rect x="43" y="80" width="5" height="24" /><rect x="55" y="80" width="5" height="24" /></g> : <text x="37" y={bass ? 107 : 113} className={bass ? 'score-clef bass' : 'score-clef'}>{bass ? '𝄢' : '𝄞'}</text>}
    {octaveDown && <text x="52" y="135" className="measure-caption">8</text>}
    {!percussion && <g className="key-signature" aria-label={`${key} 大调调号`}>{keySignatureMarks(key, clef).map((mark, index) => <text key={index} x={86 + index * 12} y={mark.y + 5} className="score-accidental">{mark.symbol}</text>)}</g>}
    <text x={startX - 26} y="88" className="score-meter">{numerator}</text><text x={startX - 26} y="110" className="score-meter">{denominator}</text>
    {Array.from({ length: Math.floor(endBeats / measure) + 1 }, (_, index) => <g key={index}><line x1={startX + index * measure * pxPerBeat} x2={startX + index * measure * pxPerBeat} y1="68" y2="116" className="score-line" /><text x={startX + index * measure * pxPerBeat + 4} y="60" className="measure-caption">{index + 1}</text></g>)}
    {events.map((event) => {
      const x = startX + 19 + event.onsetBeats * pxPerBeat
      if (event.kind === 'rest') return <Rest key={event.id} event={event} x={event.fullMeasure ? startX + (event.onsetBeats + event.durationBeats / 2) * pxPerBeat : x} />
      const note = event.note!, pitch = writtenPitch(note, key)
      if (event.measure !== currentMeasure) { currentMeasure = event.measure; state = { ...accidentals } }
      const stateKey = `${pitch.letter}${pitch.octave}`
      const previousAlter = state[stateKey] ?? accidentals[pitch.letter]
      const accidental = !percussion && pitch.alter !== previousAlter && !event.tieIn ? pitch.alter > 0 ? '♯' : pitch.alter < 0 ? '♭' : '♮' : null
      state[stateKey] = pitch.alter
      const drum = percussion ? drumInfo(note.midi) : undefined
      const y = percussion ? drum?.y ?? 92 : (bass ? 98 : 128) - ((pitch.octave + (octaveDown ? 1 : 0) - (bass ? 3 : 4)) * 7 + pitch.degree) * 6
      const shape = noteShape(event.durationBeats), down = y < 92
      const active = positionBeats !== undefined && positionBeats >= event.onsetBeats && positionBeats < event.onsetBeats + event.durationBeats
      const ledgerYs = percussion ? [] : y >= 128 ? Array.from({ length: Math.floor((y - 128) / 12) + 1 }, (_, i) => 128 + i * 12) : y <= 56 ? Array.from({ length: Math.floor((56 - y) / 12) + 1 }, (_, i) => 56 - i * 12) : []
      const next = events.find((candidate) => candidate.kind === 'note' && candidate.onsetBeats >= event.onsetBeats + event.durationBeats - 0.0001 && candidate.note?.midi === note.midi)
      const tieEnd = next && Math.abs(next.onsetBeats - event.onsetBeats - event.durationBeats) < 0.0001 ? startX + 19 + next.onsetBeats * pxPerBeat : null
      return <g key={event.id} className={`score-note ${selectedId === note.id ? 'selected' : ''} ${active ? 'playing' : ''}`} tabIndex={onSelect ? 0 : undefined} role={onSelect ? 'button' : undefined} aria-label={`${percussion ? drumName(note.midi) : midiToName(note.midi, note.spelling ?? defaultSpellingForKey(key))}，${event.durationBeats} 拍`} onClick={() => onSelect?.(note.id)} onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(note.id) }}>
        {onSelect && <rect x={x - 16} y={percussion ? y - 12 : Math.min(54, y - 39)} width="32" height={percussion ? 24 : 198 - Math.min(54, y - 39)} fill="transparent" stroke="none" pointerEvents="all" />}
        {percussion && <title>{drumName(note.midi)}</title>}
        {ledgerYs.map((lineY) => <line key={lineY} x1={x - 13} x2={x + 14} y1={lineY} y2={lineY} className="score-line" />)}
        {accidental && <text x={x - 21} y={y + 6} className="score-accidental">{accidental}</text>}
        {drum?.cross ? <path className="drum-cross" d={`M ${x - 5} ${y - 5} l 10 10 M ${x - 5} ${y + 5} l 10 -10`} fill="none" /> : <ellipse cx={x} cy={y} rx="8" ry="5.5" transform={`rotate(-18 ${x} ${y})`} fill={shape.value >= 2 ? 'transparent' : undefined} />}
        {drum?.midi === 46 && <circle cx={x} cy={y - 13} r="4" fill="none" />}
        {shape.value < 4 && <line x1={x + (down ? -7 : 7)} x2={x + (down ? -7 : 7)} y1={y} y2={y + (down ? 34 : -34)} />}
        {shape.value < 1 && Array.from({ length: shape.value < 0.5 ? 2 : 1 }, (_, i) => <path key={i} d={down ? `M ${x - 7} ${y + 34 - i * 7} q -15 -8 -5 -20` : `M ${x + 7} ${y - 34 + i * 7} q 15 8 5 20`} className="score-flag" />)}
        {shape.dotted && <circle cx={x + 14} cy={y - 3} r="2" />}
        {event.tieOut && tieEnd && <path d={`M ${x + 2} ${y + 11} Q ${(x + tieEnd) / 2} ${y + 28} ${tieEnd - 2} ${y + 11}`} className="score-tie" />}
        {note.fermata && !event.tieOut && <text x={x} y={Math.min(54, y - 40)} textAnchor="middle" className="score-fermata">𝄐</text>}
        {!percussion && <text x={x} y="190" textAnchor="middle" className="pitch-caption">{`${pitch.letter}${pitch.alter > 0 ? '♯' : pitch.alter < 0 ? '♭' : ''}${pitch.octave}`}</text>}
      </g>
    })}
    <line x1={startX + endBeats * pxPerBeat} x2={startX + endBeats * pxPerBeat} y1="68" y2="116" className="score-line" />
    {percussion && <text x="28" y="190" className="pitch-caption">● 底鼓 / 军鼓 / 通鼓　 × 踩镲 / 镲片　 ○ 开放踩镲（悬停或选择音符查看鼓件名）</text>}
  </g>
}

export function ScoreSVG({ project, tracks, selectedId, positionBeats, onSelect, endBeats: requestedEnd }: { project: ProjectData; tracks: Track[]; selectedId?: string | null; positionBeats?: number; onSelect?: (id: string) => void; endBeats?: number }) {
  const score = selectedScore(project, tracks.map((track) => track.id))
  const endBeats = requestedEnd ?? score.endBeats
  const startX = 224, pxPerBeat = 72, width = Math.max(850, startX + endBeats * pxPerBeat + 50), header = tracks.length > 1 ? 65 : 0
  let nextY = header
  const parts = tracks.map((track) => {
    const y = nextY
    nextY += track.instrument === 'piano' ? 398 : 218
    return { track, y }
  })
  const height = nextY
  return <svg xmlns="http://www.w3.org/2000/svg" className="notation-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={tracks.length > 1 ? '所选声部总谱' : `${tracks[0]?.name}五线谱`}>
    <style>{`.score-bg{fill:#151d2a}.notation-svg{color:#e3eaf4;font-family:"Segoe UI Symbol","Microsoft YaHei",sans-serif}.score-line{stroke:#56687e;stroke-width:1;fill:none}.score-clef{fill:#e3eaf4;font:60px "Segoe UI Symbol",serif}.score-clef.bass{font-size:45px}.part-label{font-size:16px;font-weight:700}.part-setting,.measure-caption{fill:#8f9fb4;font-size:10px}.score-meter{fill:#e3eaf4;font:bold 21px serif}.score-accidental{fill:#e3eaf4;font:22px "Segoe UI Symbol",serif}.score-rest{fill:#91a3ba;stroke:none}.rest-glyph{font:32px "Segoe UI Symbol",serif}.rest-caption{fill:#7487a0;font-size:9px}.score-note{fill:#e3eaf4;stroke:#e3eaf4;stroke-width:1.5;cursor:pointer}.score-note.selected,.score-note.playing{fill:#93d6ca;stroke:#93d6ca}.score-note .score-accidental{stroke:none}.score-flag{fill:none}.score-tie{fill:none;stroke-width:1.4}.score-fermata{stroke:none;fill:#e3eaf4;font:22px "Segoe UI Symbol",serif}.pitch-caption{stroke:none;fill:#8496af;font-size:9px}.score-title{fill:#e3eaf4;font-size:21px;font-weight:700}.score-subtitle{fill:#8496af;font-size:10px}`}</style>
    <rect className="score-bg" width={width} height={height} rx="12" />
    {tracks.length > 1 && <g><text x="28" y="30" className="score-title">{project.title}</text><text x="28" y="49" className="score-subtitle">♩ = {project.bpm} · {tracks.length} 个声部 · 时间对齐，保留独立调号与拍号</text></g>}
    {parts.map(({ track, y }) => <g key={track.id} className="score-part" data-instrument={track.instrument} transform={`translate(0 ${y})`}>
      <text x="28" y="25" className="part-label" fill={track.color}>{track.name}</text>
      <text x="28" y="44" className="part-setting">{track.instrument === 'drums' ? '打击乐' : `${trackKey(track, project)} 大调`} · {trackMeter(track, project)}</text>
      {(track.instrument === 'piano' ? ['treble', 'bass'] as const : [track.instrument === 'drums' ? 'percussion' : ['cello', 'bass'].includes(track.instrument) ? 'bass' : 'treble'] as const).map((clef, index) => <g key={clef} transform={`translate(0 ${index * 180})`}>
        <TrackStaff project={project} track={track} clef={clef} endBeats={endBeats} selectedId={selectedId} positionBeats={positionBeats} onSelect={onSelect} startX={startX} pxPerBeat={pxPerBeat} width={width} />
      </g>)}
      {track.instrument === 'piano' && <g className="grand-staff-connector" aria-label="钢琴大谱表连接线" pointerEvents="none">
        <path d="M 23 68 C 6 78 24 165 10 182 C 24 199 6 286 23 296" fill="none" stroke={track.color} strokeWidth="2.5" />
        <line x1="28" x2="28" y1="68" y2="296" className="score-line" />
        {Array.from({ length: Math.floor(endBeats / beatsPerMeasure(trackMeter(track, project))) + 1 }, (_, index) => <line key={index} x1={startX + index * beatsPerMeasure(trackMeter(track, project)) * pxPerBeat} x2={startX + index * beatsPerMeasure(trackMeter(track, project)) * pxPerBeat} y1="116" y2="248" className="score-line" />)}
        <line x1={startX + endBeats * pxPerBeat} x2={startX + endBeats * pxPerBeat} y1="116" y2="248" className="score-line" />
      </g>}
    </g>)}
  </svg>
}

export function Jianpu({ project, track, selectedId, endBeats, onSelect }: { project: ProjectData; track: Track; selectedId: string | null; endBeats: number; onSelect: (id: string) => void }) {
  const key = trackKey(track, project), meter = trackMeter(track, project)
  const events = scoreEvents(track, meter, endBeats), measures = [...new Set(events.map((event) => event.measure))]
  return <div className="jianpu-part" aria-label={`${track.name}简谱`}><div className="jianpu-heading">1 = {key} · {meter} · 0 表示休止</div><div className="jianpu-measures">{measures.map((measure) => <div className="jianpu-measure" key={measure}><small>{measure + 1}</small>{events.filter((event) => event.measure === measure).map((event) => {
    if (event.kind === 'rest') return <span className="jianpu-rest" key={event.id} title={`${event.durationBeats} 拍休止`}>0{event.durationBeats > 1 && <em>—</em>}<small>{event.durationBeats}拍</small></span>
    const { degree, octave } = midiToJianpu(event.note!.midi, event.note!.spelling ?? defaultSpellingForKey(key), key)
    return <button key={event.id} className={`jianpu-note ${selectedId === event.note!.id ? 'selected' : ''}`} onClick={() => onSelect(event.note!.id)}>{event.note!.fermata && <b>𝄐</b>}{octave > 0 && <i className="octave-dot top" />}<span>{degree}</span>{event.durationBeats > 1 && <em>{'—'.repeat(Math.max(1, Math.floor(event.durationBeats) - 1))}</em>}{event.durationBeats < 1 && <u />}{event.tieOut && <small>⌒</small>}{octave < 0 && <i className="octave-dot bottom" />}</button>
  })}</div>)}</div></div>
}

export function GeneratedScore({ project, selectedIds }: { project: ProjectData; selectedIds: string[] }) {
  const holder = useRef<HTMLDivElement>(null)
  const { tracks } = selectedScore(project, selectedIds)
  function downloadScore() {
    const svg = holder.current?.querySelector('svg')
    if (!svg) return
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = url; link.download = `${project.title.replace(/[\\/:*?"<>|]/g, '-')}-总谱.svg`; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="generated-score"><div className="section-heading"><div><span className="eyebrow">SCORE / 生成总谱</span><h2>所选声部合谱</h2></div><button onClick={downloadScore} disabled={!tracks.length}>下载总谱 SVG</button></div><p className="helper">按同一实际时间排布，各谱表保留自己的调号和拍号；开始、片段之间及末尾的空档自动显示休止符。</p><div className="notation-scroll" ref={holder}>{tracks.length ? <ScoreSVG project={project} tracks={tracks} /> : <p className="empty-state">在左侧勾选至少一个“加入总谱”的声部。</p>}</div></section>
}
