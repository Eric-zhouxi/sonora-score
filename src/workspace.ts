export type InstrumentId = 'piano' | 'violin' | 'cello' | 'flute'
export type Duration = 0.0625 | 0.125 | 0.25 | 0.5 | 1 | 2
export type AccidentalSpelling = 'sharp' | 'flat'
export const KEY_SIGNATURES = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'] as const
export type KeySignature = typeof KEY_SIGNATURES[number]
export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/4', '3/8', '6/8', '7/8', '9/8', '12/8'] as const
export type TimeSignature = typeof TIME_SIGNATURES[number]
export const TRACK_COLORS = ['#93d6ca', '#b6a2e3', '#e1b28f', '#aacd89', '#df9eb8', '#8fbce4', '#d9cf8d', '#b2badb']

export interface NoteEvent {
  id: string
  midi: number
  duration: Duration
  velocity: number
  onsetBeats?: number
  clipId?: string
  spelling?: AccidentalSpelling
  tieToNext?: boolean
  fermata?: boolean
}

export interface Clip {
  id: string
  name: string
  startBeats: number
}

export interface Track {
  id: string
  instrument: InstrumentId
  name: string
  color: string
  muted: boolean
  notes: NoteEvent[]
  keySignature?: KeySignature
  timeSignature?: TimeSignature
  clips?: Clip[]
}

export interface ProjectData {
  schemaVersion: 4
  id: string
  title: string
  createdAt: string
  updatedAt: string
  bpm: number
  keySignature: KeySignature
  timeSignature: TimeSignature
  tracks: Track[]
  example?: boolean
}

const sharpNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const flatNames = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
const degrees: Record<number, string> = { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' }
export const pitches = Array.from({ length: 13 }, (_, index) => 60 + index)
export const KEY_FIFTHS: Record<KeySignature, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F♯': 6, 'C♯': 7, F: -1, 'B♭': -2, 'E♭': -3, 'A♭': -4, 'D♭': -5, 'G♭': -6, 'C♭': -7 }
export const KEY_TONICS: Record<KeySignature, number> = { C: 0, G: 7, D: 2, A: 9, E: 4, B: 11, 'F♯': 6, 'C♯': 1, F: 5, 'B♭': 10, 'E♭': 3, 'A♭': 8, 'D♭': 1, 'G♭': 6, 'C♭': 11 }

export function makeId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}
export function isAccidental(midi: number): boolean { return [1, 3, 6, 8, 10].includes(midi % 12) }
export function defaultSpellingForKey(key: KeySignature): AccidentalSpelling { return KEY_FIFTHS[key] < 0 ? 'flat' : 'sharp' }
export function midiToName(midi: number, spelling: AccidentalSpelling = 'sharp'): string {
  return `${(spelling === 'flat' ? flatNames : sharpNames)[midi % 12]}${Math.floor(midi / 12) - 1}`
}
export function midiToJianpu(midi: number, spelling: AccidentalSpelling = 'sharp', key: KeySignature = 'C'): { degree: string; octave: number } {
  const relative = midi - KEY_TONICS[key]
  const pitchClass = ((relative % 12) + 12) % 12
  const degree = degrees[pitchClass] ?? (spelling === 'flat'
    ? `♭${degrees[(pitchClass + 1) % 12] ?? '?'}`
    : `♯${degrees[(pitchClass + 11) % 12] ?? '?'}`)
  return { degree, octave: Math.floor(relative / 12) - 5 }
}
export function midiToStaffY(midi: number, spelling: AccidentalSpelling = 'sharp', clef: 'treble' | 'bass' = 'treble'): number {
  const octave = Math.floor(midi / 12) - 1
  const sharpDegrees = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
  const flatDegrees = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]
  const degree = (spelling === 'flat' ? flatDegrees : sharpDegrees)[midi % 12]
  return (clef === 'bass' ? 98 : 128) - ((octave - (clef === 'bass' ? 3 : 4)) * 7 + degree) * 6
}
export function durationToBeats(duration: Duration): number { return duration * 4 }
export function beatsPerMeasure(signature: TimeSignature): number {
  const [numerator, denominator] = signature.split('/').map(Number)
  return numerator * (4 / denominator)
}
export function beatsToSeconds(beats: number, bpm: number): number { return beats * 60 / bpm }
export function secondsToBeats(seconds: number, bpm: number): number { return seconds * bpm / 60 }
export function noteOnsets(notes: NoteEvent[]): number[] {
  let cursor = 0
  return notes.map((note) => {
    const onset = note.onsetBeats ?? cursor
    cursor = Math.max(cursor, onset + durationToBeats(note.duration))
    return onset
  })
}
export function trackDurationBeats(notes: NoteEvent[]): number {
  const onsets = noteOnsets(notes)
  return notes.reduce((end, note, index) => Math.max(end, onsets[index] + durationToBeats(note.duration)), 0)
}
export function trackKey(track: Track, project: ProjectData): KeySignature { return track.keySignature ?? project.keySignature }
export function trackMeter(track: Track, project: ProjectData): TimeSignature { return track.timeSignature ?? project.timeSignature }
export function newNote(midi: number, duration: Duration, spelling?: AccidentalSpelling): NoteEvent {
  return { id: makeId('note'), midi, duration, velocity: 0.78, spelling }
}
export function newTrack(instrument: InstrumentId, existing: Track[] = []): Track {
  const count = existing.filter((track) => track.instrument === instrument).length + 1
  const names = { piano: count === 1 ? '钢琴' : `钢琴 ${count}`, violin: count === 1 ? '第一小提琴' : count === 2 ? '第二小提琴' : `小提琴 ${count}`, cello: count === 1 ? '大提琴' : `大提琴 ${count}`, flute: count === 1 ? '长笛' : `长笛 ${count}` }
  return { id: makeId(instrument), instrument, name: names[instrument], color: TRACK_COLORS[existing.length % TRACK_COLORS.length], muted: false, notes: [], keySignature: 'C', timeSignature: '4/4', clips: [{ id: makeId('clip'), name: '片段 1', startBeats: 0 }] }
}
export function normalizeTrack(track: Track, index: number, key: KeySignature = 'C', meter: TimeSignature = '4/4'): Track {
  const onsets = noteOnsets(track.notes)
  const mainId = track.clips?.[0]?.id ?? `${track.id}-main`
  const clips = track.clips?.length ? track.clips.map((clip) => ({ ...clip })) : [{ id: mainId, name: '片段 1', startBeats: Math.min(...onsets, 0) }]
  return {
    ...track, keySignature: track.keySignature ?? key, timeSignature: track.timeSignature ?? meter,
    color: /^#(d8aa59|d47f67|9a6b55|7b9da6|ffffff|fff)$/i.test(track.color) ? TRACK_COLORS[index % TRACK_COLORS.length] : track.color || TRACK_COLORS[index % TRACK_COLORS.length],
    clips, notes: track.notes.map((note, n) => ({ ...note, onsetBeats: Math.max(0, onsets[n]), clipId: note.clipId ?? mainId })),
  }
}
export const starterTracks: Track[] = [
  { ...newTrack('piano'), id: 'example-piano', name: '钢琴', color: TRACK_COLORS[0], notes: [60, 64, 67, 64, 65, 69, 72, 69].map((midi) => newNote(midi, 0.25)) },
  { ...newTrack('violin'), id: 'example-violin-1', name: '第一小提琴', color: TRACK_COLORS[1], notes: [67, 69, 71, 72].map((midi) => newNote(midi, 0.5)) },
  { ...newTrack('violin'), id: 'example-violin-2', name: '第二小提琴', color: TRACK_COLORS[2], notes: [64, 65, 67, 64].map((midi) => newNote(midi, 0.5)) },
]
export function createProject(bpm = 96, tracks = starterTracks, title = 'Sonora 示例作品'): ProjectData {
  const now = new Date().toISOString()
  return { schemaVersion: 4, id: makeId('project'), title, createdAt: now, updatedAt: now, bpm, keySignature: 'C', timeSignature: '4/4', tracks: tracks.map((track, index) => normalizeTrack({ ...track, notes: track.notes.map((note) => ({ ...note })) }, index)) }
}
export function createBlankProject(title = '未命名作品'): ProjectData { return createProject(96, [newTrack('piano')], title) }
export function createExampleProject(): ProjectData {
  return { ...createProject(96, starterTracks, 'Sonora 示例：晨光'), id: 'sonora-example', example: true }
}
export function parseProject(value: string | null): ProjectData | null {
  if (!value) return null
  try {
    const raw = JSON.parse(value) as Record<string, unknown>
    if (!Array.isArray(raw.tracks) || typeof raw.bpm !== 'number' || !Number.isFinite(raw.bpm)) return null
    const key = KEY_SIGNATURES.includes(raw.keySignature as KeySignature) ? raw.keySignature as KeySignature : 'C'
    const meter = TIME_SIGNATURES.includes(raw.timeSignature as TimeSignature) ? raw.timeSignature as TimeSignature : '4/4'
    const tracks = raw.tracks.map((value, index): Track => {
      const track = value as Partial<Track>
      const instrument: InstrumentId = ['piano', 'violin', 'cello', 'flute'].includes(track.instrument ?? '') ? track.instrument! : 'piano'
      const fallback = newTrack(instrument)
      const notes = (Array.isArray(track.notes) ? track.notes : []).filter((note) => Number.isFinite(note.midi) && note.duration > 0)
      return normalizeTrack({ ...fallback, ...track, id: track.id ?? fallback.id, instrument, notes, keySignature: KEY_SIGNATURES.includes(track.keySignature!) ? track.keySignature : key, timeSignature: TIME_SIGNATURES.includes(track.timeSignature!) ? track.timeSignature : meter }, index, key, meter)
    })
    const now = new Date().toISOString()
    return { schemaVersion: 4, id: typeof raw.id === 'string' ? raw.id : makeId('project'), title: typeof raw.title === 'string' ? raw.title : '迁移的作品', createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now, bpm: Math.max(20, Math.min(300, raw.bpm)), keySignature: key, timeSignature: meter, tracks, example: Boolean(raw.example) }
  } catch { return null }
}
