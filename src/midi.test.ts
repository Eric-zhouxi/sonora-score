import { describe, expect, it } from 'vitest'
import { midiToProject, projectToMidi } from './midi'
import { newNote, starterTracks, type Track } from './music'

describe('MIDI round trip', () => {
  it('preserves tempo, tracks, pitches and durations', () => {
    const bytes = projectToMidi(starterTracks, 108)
    const result = midiToProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(result.bpm).toBe(108)
    expect(result.tracks[0].notes.map((note) => note.midi)).toEqual(starterTracks[0].notes.map((note) => note.midi))
    expect(result.tracks[0].notes.map((note) => note.duration)).toEqual(starterTracks[0].notes.map((note) => note.duration))
  })

  it('preserves simultaneous notes instead of turning a chord into an arpeggio', () => {
    const chordTrack: Track = {
      id: 'piano-test', instrument: 'piano', name: 'C major', color: '#fff', muted: false,
      notes: [60, 64, 67].map((midi) => ({ ...newNote(midi, 0.25), onsetBeats: 0 })),
    }
    const bytes = projectToMidi([chordTrack], 96)
    const result = midiToProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(result.tracks[0].notes.map((note) => note.onsetBeats)).toEqual([0, 0, 0])
  })

  it('round-trips cello and flute General MIDI programs', () => {
    const tracks: Track[] = [
      { id: 'cello-test', instrument: 'cello', name: 'Cello', color: '#fff', muted: false, notes: [newNote(60, 0.25)] },
      { id: 'flute-test', instrument: 'flute', name: 'Flute', color: '#fff', muted: false, notes: [newNote(72, 0.25)] },
    ]
    const bytes = projectToMidi(tracks, 88)
    const result = midiToProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(result.tracks.map((track) => track.instrument)).toEqual(['cello', 'flute'])
  })
})
