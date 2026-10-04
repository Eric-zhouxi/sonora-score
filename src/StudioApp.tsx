import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatProjectDate, loadProjects, saveProjects } from './projectStore'
import Timeline from './Timeline'
import { GeneratedScore, Jianpu, ScoreSVG } from './Notation'
import { clipRegions, keyInterval, moveClip, splitClip, transposeTrack } from './arrangement'
import {
  beatsPerMeasure, beatsToSeconds, createBlankProject, defaultSpellingForKey, durationToBeats,
  isAccidental, KEY_SIGNATURES, makeId, midiToJianpu, midiToName, newNote, newTrack, noteOnsets,
  pitches, secondsToBeats, TIME_SIGNATURES, trackDurationBeats, trackKey, trackMeter,
  type AccidentalSpelling, type Duration, type InstrumentId, type KeySignature, type NoteEvent,
  type ProjectData, type TimeSignature, type Track,
} from './workspace'

const durations: { value: Duration; label: string; symbol: string }[] = [
  { value: 1, label: '全音符', symbol: '𝅝' }, { value: 0.5, label: '二分音符', symbol: '𝅗𝅥' },
  { value: 0.25, label: '四分音符', symbol: '♩' }, { value: 0.125, label: '八分音符', symbol: '♪' },
  { value: 0.0625, label: '十六分音符', symbol: '♬' },
]
const instruments: Record<InstrumentId, { name: string; icon: string }> = {
  piano: { name: '钢琴', icon: '♬' }, violin: { name: '小提琴', icon: '𝄞' },
  cello: { name: '大提琴', icon: '𝄢' }, flute: { name: '长笛', icon: '♩' },
}
function Home({ projects, onCreate, onOpen }: { projects: ProjectData[]; onCreate: () => void; onOpen: (id: string) => void }) {
  return <main className="home-shell">
    <header className="home-topbar"><div className="brand-mark">S</div><div className="brand-copy"><strong>Sonora</strong><span>SCORE STUDIO</span></div><button className="primary-action" onClick={onCreate}>＋ 新建作品</button></header>
    <section className="home-hero"><p className="eyebrow">YOUR MUSIC, YOUR TIME / 本地作品库</p><h1>让每一个声部，<br /><span>在自己的时间里发光。</span></h1><p>从空白开始，编排片段、书写声部，再把它们汇成一份总谱。</p></section>
    <section className="project-library"><div className="library-heading"><h2>我的作品</h2><span>{projects.length} FILES</span></div><div className="project-grid">
      <button className="new-project-card" onClick={onCreate}><strong>＋</strong><span>创建空白作品</span><small>从一条空钢琴音轨开始</small></button>
      {projects.map((project) => <article className="project-card" key={project.id} onDoubleClick={() => onOpen(project.id)}>
        <div className="score-preview" aria-hidden="true">{[0, 1, 2, 3, 4].map((line) => <i key={line} style={{ top: 34 + line * 12 }} />)}{project.tracks.slice(0, 4).flatMap((track, t) => track.notes.slice(0, 4).map((note, n) => <b key={`${track.id}-${note.id}`} style={{ left: 28 + n * 42 + t * 8, top: 48 - (note.midi - 60) * 2, background: track.color }} />))}</div>
        <div className="project-card-copy"><div>{project.example && <em>样例</em>}<strong>{project.title}</strong></div><p>{project.tracks.length} 个声部 · {project.bpm} BPM</p><small>更新于 {formatProjectDate(project.updatedAt)}</small></div><button onClick={() => onOpen(project.id)}>打开作品 ↗</button>
      </article>)}
    </div></section>
  </main>
}

export default function StudioApp() {
  const [projects, setProjects] = useState<ProjectData[]>(loadProjects)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [mode, setMode] = useState<'timeline' | 'part' | 'score'>('timeline')
  const [inputDuration, setInputDuration] = useState<Duration>(0.25)
  const [inputOctave, setInputOctave] = useState(4)
  const [inputSpelling, setInputSpelling] = useState<AccidentalSpelling>('sharp')
  const [inputMode, setInputMode] = useState<'append' | 'cursor'>('append')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([])
  const [targetKey, setTargetKey] = useState<KeySignature>('C')
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [saveState, setSaveState] = useState('已保存到本机')
  const raf = useRef<number | undefined>(undefined), generation = useRef(0), midiInput = useRef<HTMLInputElement>(null)
  const project = projects.find((item) => item.id === activeProjectId) ?? null
  const currentTrack = project?.tracks.find((track) => track.id === activeTrackId) ?? project?.tracks[0] ?? null
  const selectedClip = currentTrack ? clipRegions(currentTrack).find((clip) => clip.id === selectedClipId) ?? clipRegions(currentTrack)[0] : null
  const key = currentTrack && project ? trackKey(currentTrack, project) : 'C'
  const meter = currentTrack && project ? trackMeter(currentTrack, project) : '4/4'

  useEffect(() => { try { saveProjects(projects) } catch { setSaveState('保存失败：本地空间不足，请导出 MIDI') } }, [projects])
  useEffect(() => { setInputSpelling(defaultSpellingForKey(key)); setTargetKey(key) }, [activeTrackId, key])
  useEffect(() => () => { generation.current++; if (raf.current) cancelAnimationFrame(raf.current); void import('./audio').then(({ stopPlayback }) => stopPlayback()) }, [])
  function updateProject(update: (project: ProjectData) => ProjectData) {
    if (!activeProjectId) return
    setProjects((current) => current.map((item) => item.id === activeProjectId ? { ...update(item), updatedAt: new Date().toISOString() } : item))
    setSaveState('已保存到本机')
  }
  function updateTrack(id: string, update: (track: Track) => Track) {
    updateProject((current) => ({ ...current, tracks: current.tracks.map((track) => track.id === id ? update(track) : track) }))
  }
  function stop() {
    generation.current++
    if (raf.current) cancelAnimationFrame(raf.current)
    setPlaying(false); setLoadingAudio(false)
    void import('./audio').then(({ stopPlayback }) => stopPlayback())
  }
  function seek(seconds: number) { stop(); setPosition(Math.max(0, seconds)) }
  function openProject(id: string) {
    stop()
    const target = projects.find((item) => item.id === id)
    if (!target) return
    setActiveProjectId(id); setActiveTrackId(target.tracks[0]?.id ?? null)
    setSelectedClipId(target.tracks[0]?.clips?.[0]?.id ?? null); setSelectedTrackIds(target.tracks.map((track) => track.id))
    setMode('timeline'); setSelectedNoteId(null); setPosition(0)
  }
  function createNewProject() {
    stop()
    const created = createBlankProject(`未命名作品 ${projects.filter((item) => !item.example).length + 1}`)
    setProjects((current) => [created, ...current]); setActiveProjectId(created.id); setActiveTrackId(created.tracks[0].id)
    setSelectedClipId(created.tracks[0].clips![0].id); setSelectedTrackIds([created.tracks[0].id]); setMode('timeline'); setPosition(0); setSelectedNoteId(null)
  }
  function openTrack(id: string, clipId?: string) {
    setActiveTrackId(id)
    setSelectedNoteId(null)
    if (clipId) setSelectedClipId(clipId)
    else setSelectedClipId(project?.tracks.find((track) => track.id === id)?.clips?.[0]?.id ?? null)
    setMode('part')
  }
  function addTrack(instrument: InstrumentId) {
    if (!project) return
    const track = { ...newTrack(instrument, project.tracks), keySignature: project.keySignature, timeSignature: project.timeSignature }
    updateProject((current) => ({ ...current, tracks: [...current.tracks, track] }))
    setActiveTrackId(track.id); setSelectedClipId(track.clips![0].id); setSelectedTrackIds((ids) => [...ids, track.id]); setSelectedNoteId(null)
  }
  function reorderTrack(id: string, direction: -1 | 1) {
    updateProject((current) => {
      const tracks = [...current.tracks], index = tracks.findIndex((track) => track.id === id), destination = index + direction
      if (index < 0 || destination < 0 || destination >= tracks.length) return current
      const [track] = tracks.splice(index, 1); tracks.splice(destination, 0, track)
      return { ...current, tracks }
    })
  }
  function createClip() {
    if (!currentTrack || !project) return
    const clip = { id: makeId('clip'), name: `片段 ${clipRegions(currentTrack).length + 1}`, startBeats: secondsToBeats(position, project.bpm) }
    updateTrack(currentTrack.id, (track) => ({ ...track, clips: [...track.clips ?? [], clip] }))
    setSelectedClipId(clip.id); setSelectedNoteId(null); setMode('part')
  }
  function moveRegion(trackId: string, clipId: string, start: number) { stop(); updateTrack(trackId, (track) => moveClip(track, clipId, start)) }
  function splitSelected() {
    if (!currentTrack || !selectedNoteId) return
    const result = splitClip(currentTrack, selectedNoteId)
    if (result) { updateTrack(currentTrack.id, () => result.track); setSelectedClipId(result.clipId) }
  }
  function addNote(baseMidi: number) {
    if (!currentTrack || !selectedClip || !project) return
    const midi = baseMidi + (inputOctave - 4) * 12
    const start = inputMode === 'cursor' ? secondsToBeats(position, project.bpm) : selectedClip.endBeats
    const note = { ...newNote(midi, inputDuration, isAccidental(midi) ? inputSpelling : undefined), onsetBeats: Math.max(selectedClip.startBeats, start), clipId: selectedClip.id }
    updateTrack(currentTrack.id, (track) => ({ ...track, notes: [...track.notes, note].sort((a, b) => (a.onsetBeats ?? 0) - (b.onsetBeats ?? 0)) }))
    setSelectedNoteId(note.id)
    if (inputMode === 'cursor') setPosition(beatsToSeconds(note.onsetBeats + durationToBeats(note.duration), project.bpm))
    void import('./audio').then(({ previewNote }) => previewNote(currentTrack.instrument, midi)).catch(() => setSaveState('浏览器音频暂不可用'))
  }
  function selectNote(id: string) {
    setSelectedNoteId(id)
    const note = currentTrack?.notes.find((item) => item.id === id)
    if (note?.clipId) setSelectedClipId(note.clipId)
  }
  function updateSelected(update: (note: NoteEvent) => NoteEvent) {
    if (!currentTrack || !selectedNoteId) return
    updateTrack(currentTrack.id, (track) => ({ ...track, notes: track.notes.map((note) => note.id === selectedNoteId ? update(note) : note) }))
  }
  function applyDuration(duration: Duration) { setInputDuration(duration); updateSelected((note) => ({ ...note, duration })) }
  function applyAccidental(kind: 'sharp' | 'flat' | 'natural') {
    setInputSpelling(kind === 'flat' ? 'flat' : 'sharp')
    updateSelected((note) => kind === 'natural'
      ? { ...note, midi: isAccidental(note.midi) ? note.midi + (note.spelling === 'flat' ? 1 : -1) : note.midi, spelling: undefined }
      : { ...note, midi: isAccidental(note.midi) ? note.midi : note.midi + (kind === 'sharp' ? 1 : -1), spelling: kind })
  }
  function tieSelected() {
    if (!currentTrack || !selectedNoteId) return
    updateTrack(currentTrack.id, (track) => {
      const notes = [...track.notes], index = notes.findIndex((note) => note.id === selectedNoteId)
      if (index < 0) return track
      const note = notes[index], enabled = !note.tieToNext, nextStart = (note.onsetBeats ?? 0) + durationToBeats(note.duration)
      notes[index] = { ...note, tieToNext: enabled }
      if (enabled && !notes.some((next) => next.id !== note.id && next.midi === note.midi && Math.abs((next.onsetBeats ?? 0) - nextStart) < 0.0001)) notes.push({ ...newNote(note.midi, note.duration, note.spelling), onsetBeats: nextStart, clipId: note.clipId })
      return { ...track, notes: notes.sort((a, b) => (a.onsetBeats ?? 0) - (b.onsetBeats ?? 0)) }
    })
  }
  async function togglePlayback() {
    if (!project) return
    if (playing || loadingAudio) { stop(); return }
    const token = ++generation.current, from = position
    setLoadingAudio(true)
    try {
      const { playTracks, stopPlayback } = await import('./audio')
      if (token !== generation.current) return
      let anchor = 0
      const length = await playTracks(project.tracks, project.bpm, () => {}, secondsToBeats(from, project.bpm), () => { anchor = performance.now() + 60; setPlaying(true); setLoadingAudio(false) })
      if (token !== generation.current) { stopPlayback(); return }
      if (!length) { setPlaying(false); setLoadingAudio(false); return }
      const loop = () => {
        if (token !== generation.current) return
        const elapsed = Math.max(0, performance.now() - anchor)
        setPosition(from + elapsed / 1000)
        if (elapsed >= length) { stopPlayback(); setPlaying(false); return }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)
    } catch { setPlaying(false); setLoadingAudio(false); setSaveState('播放失败，请检查浏览器音频权限') }
  }
  async function exportMidi() {
    if (!project) return
    const { projectToMidi } = await import('./midi'), tracks = mode === 'score' ? project.tracks.filter((track) => selectedTrackIds.includes(track.id)) : project.tracks
    const bytes = projectToMidi(tracks, project.bpm), url = URL.createObjectURL(new Blob([Uint8Array.from(bytes).buffer], { type: 'audio/midi' })), link = document.createElement('a')
    link.href = url; link.download = `${project.title.replace(/[\\/:*?"<>|]/g, '-')}.mid`; link.click(); URL.revokeObjectURL(url)
  }
  async function importMidi(file?: File) {
    if (!file) return
    stop()
    try {
      const { midiToProject } = await import('./midi'), imported = midiToProject(await file.arrayBuffer())
      updateProject((current) => ({ ...current, bpm: imported.bpm, tracks: imported.tracks }))
      setActiveTrackId(imported.tracks[0].id); setSelectedClipId(imported.tracks[0].clips![0].id); setSelectedTrackIds(imported.tracks.map((track) => track.id)); setMode('timeline'); setPosition(0)
    } catch { setSaveState('MIDI 导入失败') }
    if (midiInput.current) midiInput.current.value = ''
  }

  if (!project) return <Home projects={projects} onCreate={createNewProject} onOpen={openProject} />
  const partEnd = currentTrack ? Math.ceil(Math.max(beatsPerMeasure(meter), trackDurationBeats(currentTrack.notes)) / beatsPerMeasure(meter)) * beatsPerMeasure(meter) : 4
  return <main className="app-shell">
    <header className="topbar"><button className="back-home" onClick={() => { stop(); setActiveProjectId(null) }}>← 作品库</button><div className="brand-mark">S</div><input className="project-title-input" aria-label="作品名称" value={project.title} onChange={(event) => updateProject((current) => ({ ...current, title: event.target.value }))} /><nav>{([['timeline', '时间轴'], ['part', '声部编辑'], ['score', '生成总谱']] as const).map(([value, label]) => <button key={value} className={mode === value ? 'nav-item active' : 'nav-item'} onClick={() => setMode(value)}>{label}</button>)}</nav><div className="status-pill"><i />{saveState}</div></header>
    <section className="workspace-header"><div className="project-settings"><span>新声部默认</span><label>调号<select aria-label="默认调号" value={project.keySignature} onChange={(event) => updateProject((current) => ({ ...current, keySignature: event.target.value as KeySignature }))}>{KEY_SIGNATURES.map((value) => <option key={value}>{value}</option>)}</select></label><label>拍号<select aria-label="默认拍号" value={project.timeSignature} onChange={(event) => updateProject((current) => ({ ...current, timeSignature: event.target.value as TimeSignature }))}>{TIME_SIGNATURES.map((value) => <option key={value}>{value}</option>)}</select></label></div><div className="transport"><button aria-label="回到开头" onClick={() => seek(0)}>↤</button><output className="time-readout">{position.toFixed(2)}<small> SEC</small></output><label className="tempo">♩ <input aria-label="速度 BPM" type="number" min="20" max="300" value={project.bpm} onChange={(event) => { stop(); updateProject((current) => ({ ...current, bpm: Math.max(20, Math.min(300, Number(event.target.value) || 96)) })) }} /><small>BPM</small></label><button className="play-button" aria-label={playing || loadingAudio ? '停止播放' : '从当前位置播放'} onClick={() => void togglePlayback()}>{loadingAudio ? '…' : playing ? '■' : '▶'}</button></div></section>
    <section className="studio-grid"><aside className="track-panel"><div className="panel-title"><span>声部</span><small>{project.tracks.length} TRACKS</small></div>
      {project.tracks.map((track, index) => <div key={track.id} className={`track-card ${track.id === currentTrack?.id ? 'selected' : ''}`} style={{ '--track-color': track.color } as CSSProperties} onClick={() => { setActiveTrackId(track.id); setSelectedClipId(track.clips?.[0]?.id ?? null); setSelectedNoteId(null) }} onDoubleClick={() => openTrack(track.id)}><span className="instrument-icon" style={{ color: track.color }}>{instruments[track.instrument].icon}</span><span className="track-name"><input aria-label={`${track.name}名称`} value={track.name} onClick={(event) => event.stopPropagation()} onChange={(event) => updateTrack(track.id, (current) => ({ ...current, name: event.target.value }))} /><small>{trackKey(track, project)} · {trackMeter(track, project)} · {track.notes.length} 个音</small><label className="score-check" onClick={(event) => event.stopPropagation()}><input aria-label={`${track.name}加入总谱`} type="checkbox" checked={selectedTrackIds.includes(track.id)} onChange={(event) => setSelectedTrackIds((ids) => event.target.checked ? [...ids, track.id] : ids.filter((id) => id !== track.id))} />加入总谱</label></span><span className="track-actions"><button aria-label={`${track.name}上移`} title="上移声部" disabled={index === 0} onClick={(event) => { event.stopPropagation(); reorderTrack(track.id, -1) }}>↑</button><button aria-label={`${track.name}下移`} title="下移声部" disabled={index === project.tracks.length - 1} onClick={(event) => { event.stopPropagation(); reorderTrack(track.id, 1) }}>↓</button><button aria-label={`${track.name}静音`} title="静音" className={track.muted ? 'muted' : ''} onClick={(event) => { event.stopPropagation(); stop(); updateTrack(track.id, (current) => ({ ...current, muted: !current.muted })) }}>M</button></span></div>)}
      <div className="add-track-row" aria-label="添加声部">{(['piano', 'violin', 'cello', 'flute'] as InstrumentId[]).map((instrument) => <button key={instrument} onClick={() => addTrack(instrument)}>＋ {instruments[instrument].name}</button>)}</div>
      <button className="generate-button" onClick={() => setMode('score')} disabled={!selectedTrackIds.length}>生成总谱 <span>{selectedTrackIds.length} 声部 ↗</span></button>
      <p className="track-help">勾选参与合谱的声部。每条音轨可独立设置调号、拍号和颜色。</p>
      <div className="file-tools"><input ref={midiInput} type="file" accept=".mid,.midi" hidden onChange={(event) => void importMidi(event.target.files?.[0])} /><button onClick={() => midiInput.current?.click()}>导入 MIDI</button><button onClick={() => void exportMidi()}>导出 MIDI</button></div>
    </aside><div className="main-workspace">
      {(mode === 'timeline' || mode === 'part') && <Timeline project={project} position={position} selectedClipId={selectedClipId} onSeek={seek} onSelect={(trackId, clipId) => { setActiveTrackId(trackId); setSelectedClipId(clipId); setSelectedNoteId(null) }} onMoveClip={moveRegion} onOpenTrack={(id) => openTrack(id, selectedClipId ?? undefined)} />}
      {currentTrack && mode !== 'score' && <section className="clip-inspector"><label>当前片段<select aria-label="当前片段" value={selectedClip?.id ?? ''} onChange={(event) => { setSelectedClipId(event.target.value); setSelectedNoteId(null) }}>{clipRegions(currentTrack).map((clip) => <option value={clip.id} key={clip.id}>{clip.name}</option>)}</select></label>{selectedClip && <><label>名称<input aria-label="片段名称" value={selectedClip.name} onChange={(event) => updateTrack(currentTrack.id, (track) => ({ ...track, clips: track.clips?.map((clip) => clip.id === selectedClip.id ? { ...clip, name: event.target.value } : clip) }))} /></label><label>起始秒<input aria-label="片段起始秒数" type="number" min="0" step="0.1" value={Number(beatsToSeconds(selectedClip.startBeats, project.bpm).toFixed(3))} onChange={(event) => moveRegion(currentTrack.id, selectedClip.id, secondsToBeats(Math.max(0, Number(event.target.value)), project.bpm))} /></label></>}<button onClick={createClip}>＋ 在当前位置新建片段</button><button onClick={splitSelected} disabled={!selectedNoteId}>在选中音符处分割</button></section>}
      {mode === 'part' && currentTrack && <section className="part-panel"><div className="section-heading"><div><span className="eyebrow">PART / 声部编辑</span><h2 style={{ color: currentTrack.color }}>{currentTrack.name}</h2></div><label className="color-picker">轨道颜色<input type="color" aria-label="轨道颜色" value={currentTrack.color} onChange={(event) => updateTrack(currentTrack.id, (track) => ({ ...track, color: event.target.value }))} /></label></div>
        <div className="part-settings"><label>声部调号<select aria-label="声部调号" value={key} onChange={(event) => updateTrack(currentTrack.id, (track) => ({ ...track, keySignature: event.target.value as KeySignature }))}>{KEY_SIGNATURES.map((value) => <option key={value}>{value}</option>)}</select></label><label>声部拍号<select aria-label="声部拍号" value={meter} onChange={(event) => updateTrack(currentTrack.id, (track) => ({ ...track, timeSignature: event.target.value as TimeSignature }))}>{TIME_SIGNATURES.map((value) => <option key={value}>{value}</option>)}</select></label><span className="settings-divider" /><label>移调到<select aria-label="移调目标调号" value={targetKey} onChange={(event) => setTargetKey(event.target.value as KeySignature)}>{KEY_SIGNATURES.map((value) => <option key={value}>{value}</option>)}</select></label><button onClick={() => { stop(); updateTrack(currentTrack.id, (track) => transposeTrack(track, keyInterval(key, targetKey), targetKey)) }}>移调整个声部</button><button aria-label="声部降半音" onClick={() => { stop(); updateTrack(currentTrack.id, (track) => transposeTrack(track, -1)) }}>− 半音</button><button aria-label="声部升半音" onClick={() => { stop(); updateTrack(currentTrack.id, (track) => transposeTrack(track, 1)) }}>＋ 半音</button></div>
        <p className="helper">设置调号只改变记谱；“移调整个声部”同时改变音高。当前声部拍号不影响其他音轨。</p>
        <div className="notation-tools">{durations.map((item) => <button key={item.value} title={item.label} aria-label={item.label} className={inputDuration === item.value ? 'active' : ''} onClick={() => applyDuration(item.value)}>{item.symbol}</button>)}<span /><button title="降号" onClick={() => applyAccidental('flat')} className={inputSpelling === 'flat' ? 'active' : ''}>♭</button><button title="还原号" onClick={() => applyAccidental('natural')}>♮</button><button title="升号" onClick={() => applyAccidental('sharp')} className={inputSpelling === 'sharp' ? 'active' : ''}>♯</button><button title="延音线" onClick={tieSelected}>⌒</button><button title="延音记号" onClick={() => updateSelected((note) => ({ ...note, fermata: !note.fermata }))}>𝄐</button><button title="音符降低半音" onClick={() => updateSelected((note) => ({ ...note, midi: Math.max(0, note.midi - 1), spelling: 'flat' }))}>−½</button><button title="音符升高半音" onClick={() => updateSelected((note) => ({ ...note, midi: Math.min(127, note.midi + 1), spelling: 'sharp' }))}>＋½</button><button title="删除选中音符，保留时间空档" disabled={!selectedNoteId} onClick={() => { updateTrack(currentTrack.id, (track) => ({ ...track, notes: track.notes.filter((note) => note.id !== selectedNoteId) })); setSelectedNoteId(null) }}>⌫</button><button onClick={() => setSelectedNoteId(null)} className="text-tool">取消选择 / 继续输入</button></div>
        <div className="notation-scroll"><ScoreSVG project={project} tracks={[currentTrack]} selectedId={selectedNoteId} positionBeats={playing ? secondsToBeats(position, project.bpm) : undefined} onSelect={selectNote} endBeats={partEnd} /></div>
        <Jianpu project={project} track={currentTrack} selectedId={selectedNoteId} endBeats={partEnd} onSelect={selectNote} />
        <div className="keyboard-section"><div className="keyboard-copy"><strong>音符输入</strong><span>{selectedClip?.name} · {inputSpelling === 'flat' ? '降号记法' : '升号记法'}</span><label>位置<select aria-label="音符输入位置" value={inputMode} onChange={(event) => setInputMode(event.target.value as 'append' | 'cursor')}><option value="append">当前片段末尾</option><option value="cursor">播放指针位置</option></select></label><label>八度<select aria-label="输入八度" value={inputOctave} onChange={(event) => setInputOctave(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((octave) => <option key={octave}>{octave}</option>)}</select></label></div><div className="keyboard">{pitches.map((baseMidi) => { const midi = baseMidi + (inputOctave - 4) * 12; return <button className={isAccidental(midi) ? 'accidental-key' : ''} key={baseMidi} onClick={() => addNote(baseMidi)}><span>{midiToName(midi, inputSpelling)}</span><kbd>{midiToJianpu(midi, inputSpelling, key).degree}</kbd></button> })}</div></div>
      </section>}
      {mode === 'score' && <GeneratedScore project={project} selectedIds={selectedTrackIds} />}
    </div></section><footer><span>SONORA · SCORE STUDIO</span><span>时间轴 / 独立声部 / 总谱</span></footer>
  </main>
}
