export type InstrumentId = 'piano' | 'violin'
export type Duration = 0.25 | 0.5 | 1 | 2

export interface NoteEvent {
  id: string
  midi: number
  duration: Duration
  velocity: number
  /** Absolute start in quarter-note beats. Omitted notes follow the previous note. */
  onsetBeats?: number
}

export interface Track {
  id: InstrumentId
  name: string
  color: string
  muted: boolean
  notes: NoteEvent[]
}

export interface ProjectData {
  schemaVersion: 1
  bpm: number
  tracks: Track[]
}

const pitchClasses = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const degreeByPitchClass: Record<number, string> = {
  0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7',
}

export const pitches = [60, 62, 64, 65, 67, 69, 71, 72]

export function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  return `${pitchClasses[midi % 12]}${octave}`
}

export function midiToJianpu(midi: number): { degree: string; octave: number } {
  const pitchClass = midi % 12
  return {
    degree: degreeByPitchClass[pitchClass] ?? `${degreeByPitchClass[(pitchClass + 11) % 12] ?? '?'}♯`,
    octave: Math.floor(midi / 12) - 5,
  }
}

export function midiToStaffY(midi: number): number {
  const octave = Math.floor(midi / 12) - 1
  const pitchClass = midi % 12
  const degree = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pitchClass]
  const stepsFromC4 = (octave - 4) * 7 + degree
  return 110 - stepsFromC4 * 6
}

export function durationToBeats(duration: Duration): number {
  return duration * 4
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

export function newNote(midi: number, duration: Duration): NoteEvent {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    midi,
    duration,
    velocity: 0.78,
  }
}

export const starterTracks: Track[] = [
  {
    id: 'piano',
    name: '原声钢琴',
    color: '#d8aa59',
    muted: false,
    notes: [60, 64, 67, 64, 65, 69, 72, 69].map((midi) => newNote(midi, 0.25)),
  },
  {
    id: 'violin',
    name: '独奏小提琴',
    color: '#d47f67',
    muted: false,
    notes: [67, 69, 71, 72].map((midi) => newNote(midi, 0.5)),
  },
]

export function createProject(bpm = 96, tracks = starterTracks): ProjectData {
  return { schemaVersion: 1, bpm, tracks }
}

export function parseProject(value: string | null): ProjectData | null {
  if (!value) return null
  try {
    const project = JSON.parse(value) as Partial<ProjectData>
    if (project.schemaVersion !== 1 || !Array.isArray(project.tracks) || typeof project.bpm !== 'number') return null
    return project as ProjectData
  } catch {
    return null
  }
}
