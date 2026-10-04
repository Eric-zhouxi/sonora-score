export type InstrumentId = 'piano' | 'violin' | 'cello' | 'flute'
export type Duration = 0.125 | 0.25 | 0.5 | 1 | 2
export type AccidentalSpelling = 'sharp' | 'flat'
export type KeySignature = 'C' | 'G' | 'D' | 'F' | 'B♭' | 'E♭'
export type TimeSignature = '4/4' | '3/4' | '6/8'

export interface NoteEvent {
  id: string
  midi: number
  duration: Duration
  velocity: number
  onsetBeats?: number
  spelling?: AccidentalSpelling
  tieToNext?: boolean
  fermata?: boolean
}

export interface Track {
  id: string
  instrument: InstrumentId
  name: string
  color: string
  muted: boolean
  notes: NoteEvent[]
}

export interface ProjectData {
  schemaVersion: 3
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

export function makeId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

export function isAccidental(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12)
}

export function defaultSpellingForKey(key: KeySignature): AccidentalSpelling {
  return ['F', 'B♭', 'E♭'].includes(key) ? 'flat' : 'sharp'
}

export function midiToName(midi: number, spelling: AccidentalSpelling = 'sharp'): string {
  const octave = Math.floor(midi / 12) - 1
  return `${(spelling === 'flat' ? flatNames : sharpNames)[midi % 12]}${octave}`
}

export function midiToJianpu(midi: number, spelling: AccidentalSpelling = 'sharp'): { degree: string; octave: number } {
  const pitchClass = midi % 12
  const degree = degrees[pitchClass] ?? (spelling === 'flat'
    ? `${degrees[(pitchClass + 1) % 12] ?? '?'}♭`
    : `${degrees[(pitchClass + 11) % 12] ?? '?'}♯`)
  return { degree, octave: Math.floor(midi / 12) - 5 }
}

export function midiToStaffY(
  midi: number,
  spelling: AccidentalSpelling = 'sharp',
  clef: 'treble' | 'bass' = 'treble',
): number {
  const octave = Math.floor(midi / 12) - 1
  const pitchClass = midi % 12
  const sharpDegrees = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
  const flatDegrees = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]
  const degree = (spelling === 'flat' ? flatDegrees : sharpDegrees)[pitchClass]
  const referenceOctave = clef === 'bass' ? 3 : 4
  return (clef === 'bass' ? 98 : 110) - ((octave - referenceOctave) * 7 + degree) * 6
}

export function durationToBeats(duration: Duration): number {
  return duration * 4
}

export function beatsPerMeasure(signature: TimeSignature): number {
  const [numerator, denominator] = signature.split('/').map(Number)
  return numerator * (4 / denominator)
}

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

export function newNote(midi: number, duration: Duration, spelling?: AccidentalSpelling): NoteEvent {
  return { id: makeId('note'), midi, duration, velocity: 0.78, spelling }
}

export function newTrack(instrument: InstrumentId, existing: Track[] = []): Track {
  const count = existing.filter((track) => track.instrument === instrument).length + 1
  const meta: Record<InstrumentId, { name: string; color: string }> = {
    piano: { name: count === 1 ? '钢琴' : `钢琴 ${count}`, color: '#d8aa59' },
    violin: { name: count === 1 ? '第一小提琴' : count === 2 ? '第二小提琴' : `小提琴 ${count}`, color: '#d47f67' },
    cello: { name: count === 1 ? '大提琴' : `大提琴 ${count}`, color: '#9a6b55' },
    flute: { name: count === 1 ? '长笛' : `长笛 ${count}`, color: '#7b9da6' },
  }
  return { id: makeId(instrument), instrument, name: meta[instrument].name, color: meta[instrument].color, muted: false, notes: [] }
}

export const starterTracks: Track[] = [
  { ...newTrack('piano'), id: 'example-piano', name: '钢琴', notes: [60, 64, 67, 64, 65, 69, 72, 69].map((midi) => newNote(midi, 0.25)) },
  { ...newTrack('violin'), id: 'example-violin-1', name: '第一小提琴', notes: [67, 69, 71, 72].map((midi) => newNote(midi, 0.5)) },
  { ...newTrack('violin', [{ instrument: 'violin' } as Track]), id: 'example-violin-2', name: '第二小提琴', notes: [64, 65, 67, 64].map((midi) => newNote(midi, 0.5)) },
]

export function createProject(bpm = 96, tracks = starterTracks, title = 'Sonora 示例作品'): ProjectData {
  const now = new Date().toISOString()
  return {
    schemaVersion: 3, id: makeId('project'), title, createdAt: now, updatedAt: now,
    bpm, keySignature: 'C', timeSignature: '4/4',
    tracks: tracks.map((track) => ({ ...track, notes: track.notes.map((note) => ({ ...note })) })),
  }
}

export function createBlankProject(title = '未命名作品'): ProjectData {
  return createProject(96, [newTrack('piano')], title)
}

export function createExampleProject(): ProjectData {
  return { ...createProject(96, starterTracks, 'Sonora 示例：晨光'), id: 'sonora-example', example: true }
}

function migrateTracks(rawTracks: unknown[]): Track[] {
  return rawTracks.map((raw, index) => {
    const track = raw as Partial<Track> & { id?: string }
    const instrument: InstrumentId = ['piano', 'violin', 'cello', 'flute'].includes(track.instrument ?? '')
      ? track.instrument as InstrumentId : track.id === 'violin' ? 'violin' : 'piano'
    const fallback = newTrack(instrument)
    return {
      id: track.id && !['piano', 'violin'].includes(track.id) ? track.id : `${instrument}-${index + 1}`,
      instrument, name: track.name ?? fallback.name, color: track.color ?? fallback.color,
      muted: Boolean(track.muted), notes: Array.isArray(track.notes) ? track.notes as NoteEvent[] : [],
    }
  })
}

export function parseProject(value: string | null): ProjectData | null {
  if (!value) return null
  try {
    const raw = JSON.parse(value) as Record<string, unknown>
    if (!Array.isArray(raw.tracks) || typeof raw.bpm !== 'number') return null
    const tracks = migrateTracks(raw.tracks)
    if (raw.schemaVersion !== 3) return createProject(raw.bpm, tracks, '迁移的作品')
    return {
      schemaVersion: 3,
      id: typeof raw.id === 'string' ? raw.id : makeId('project'),
      title: typeof raw.title === 'string' ? raw.title : '未命名作品',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      bpm: raw.bpm,
      keySignature: ['C', 'G', 'D', 'F', 'B♭', 'E♭'].includes(String(raw.keySignature)) ? raw.keySignature as KeySignature : 'C',
      timeSignature: ['4/4', '3/4', '6/8'].includes(String(raw.timeSignature)) ? raw.timeSignature as TimeSignature : '4/4',
      tracks, example: Boolean(raw.example),
    }
  } catch {
    return null
  }
}
