import { describe, expect, it } from 'vitest'
import { midiToProject, projectToMidi } from './midi'
import { starterTracks } from './music'

describe('MIDI round trip', () => {
  it('preserves tempo, tracks, pitches and durations', () => {
    const bytes = projectToMidi(starterTracks, 108)
    const result = midiToProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(result.bpm).toBe(108)
    expect(result.tracks[0].notes.map((note) => note.midi)).toEqual(starterTracks[0].notes.map((note) => note.midi))
    expect(result.tracks[0].notes.map((note) => note.duration)).toEqual(starterTracks[0].notes.map((note) => note.duration))
  })
})
