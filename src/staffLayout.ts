import { writtenPitch } from './arrangement'
import { KEY_FIFTHS, noteOnsets, type KeySignature, type NoteEvent, type Track } from './workspace'

export type Clef = 'treble' | 'bass'

export function pianoStaff(note: NoteEvent, key: KeySignature): Clef {
  if (note.staff === 'treble' || note.staff === 'bass') return note.staff
  return writtenPitch(note, key).octave < 4 ? 'bass' : 'treble'
}

export function trackForStaff(track: Track, clef: Clef, key: KeySignature): Track {
  if (track.instrument !== 'piano') return track
  // Materialize absolute onsets before filtering, including legacy sequential notes.
  const onsets = noteOnsets(track.notes)
  return { ...track, notes: track.notes.map((note, index) => ({ ...note, onsetBeats: onsets[index] })).filter((note) => pianoStaff(note, key) === clef) }
}

export function keySignatureMarks(key: KeySignature, clef: Clef) {
  const fifths = KEY_FIFTHS[key]
  const positions = fifths > 0 ? [68, 86, 62, 80, 98, 74, 92] : [92, 74, 98, 80, 104, 86, 110]
  return positions.slice(0, Math.abs(fifths)).map((y) => ({ symbol: fifths > 0 ? '♯' : '♭', y: y + (clef === 'bass' ? 12 : 0) }))
}

export function keySignatureLabel(key: KeySignature) {
  const fifths = KEY_FIFTHS[key]
  return fifths === 0 ? '无升降号' : `${Math.abs(fifths)} 个${fifths > 0 ? '升号 ♯' : '降号 ♭'}`
}
