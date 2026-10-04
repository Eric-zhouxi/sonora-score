export type InstrumentId = 'piano' | 'violin'
export type Duration = 0.25 | 0.5 | 1 | 2

export interface NoteEvent {
  id: string
  midi: number
  duration: Duration
  velocity: number
}

export interface Track {
  id: InstrumentId
  name: string
  color: string
  muted: boolean
  notes: NoteEvent[]
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
  const diatonicSteps: Record<number, number> = {
    60: 0, 62: 1, 64: 2, 65: 3, 67: 4, 69: 5, 71: 6, 72: 7,
  }
  return 110 - (diatonicSteps[midi] ?? 0) * 6
}

export function durationToBeats(duration: Duration): number {
  return duration * 4
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
