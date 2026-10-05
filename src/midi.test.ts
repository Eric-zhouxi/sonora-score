import { describe, expect, it } from 'vitest'
import { midiToProject, projectToMidi } from './midi'
import { newNote, starterTracks, type Track } from './workspace'
import { newTrack, createProject, parseProject } from './workspace'
import { Midi } from '@tonejs/midi'
import { transposeTrack } from './arrangement'

describe('MIDI round trip', () => {
  it('keeps guitar/bass programs and drum note numbers on channel 10', () => {
    const tracks = (['guitar', 'electricGuitar', 'bass', 'drums'] as const).map((instrument) => ({ ...newTrack(instrument), notes: (instrument === 'drums' ? [36, 38, 42, 46, 49, 51] : [40, 52, 64]).map((midi, index) => ({ ...newNote(midi, .125), onsetBeats: index / 2 })) }))
    const bytes = projectToMidi(tracks, 104), midi = new Midi(bytes)
    expect(midi.tracks.map((track) => track.instrument.number)).toEqual([25, 27, 33, 0])
    expect(midi.tracks.map((track) => track.channel)).toEqual([0, 1, 2, 9])
    const restored = midiToProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(restored.tracks.map((track) => track.instrument)).toEqual(['guitar', 'electricGuitar', 'bass', 'drums'])
    expect(restored.tracks[3].notes.map((note) => note.midi)).toEqual([36, 38, 42, 46, 49, 51])
    expect(parseProject(JSON.stringify(createProject(104, tracks)))?.tracks.map((track) => track.instrument)).toEqual(['guitar', 'electricGuitar', 'bass', 'drums'])
    expect(transposeTrack(tracks[3], 12)).toBe(tracks[3])
  })
  it('preserves tempo, tracks, pitches and durations', () => {
    const bytes = projectToMidi(starterTracks, 108)
    const result = midiToProject(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(result.bpm).toBe(108)
    expect(result.tracks).toHaveLength(starterTracks.length)
    expect(new Set(result.tracks.map((track) => track.color)).size).toBe(starterTracks.length)
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
