import { describe, expect, it } from 'vitest'
import { keySignatureMarks, pianoStaff, trackForStaff } from './staffLayout'
import { createProject, newNote, newTrack, parseProject } from './workspace'
import { scoreEvents } from './arrangement'

describe('piano grand staff', () => {
  it('splits legacy sequential notes without moving their absolute times', () => {
    const track = { ...newTrack('piano'), notes: [48, 60, 55, 72].map((midi) => newNote(midi, 0.25)) }
    const treble = trackForStaff(track, 'treble', 'C'), bass = trackForStaff(track, 'bass', 'C')
    expect(treble.notes.map((note) => [note.midi, note.onsetBeats])).toEqual([[60, 1], [72, 3]])
    expect(bass.notes.map((note) => [note.midi, note.onsetBeats])).toEqual([[48, 0], [55, 2]])
    expect(scoreEvents(treble, '4/4', 4).filter((event) => event.kind === 'rest').map((event) => event.onsetBeats)).toEqual([0, 2])
    expect(scoreEvents(bass, '4/4', 4).filter((event) => event.kind === 'rest').map((event) => event.onsetBeats)).toEqual([1, 3])
  })
  it('preserves explicit staff assignments on save and leaves other instruments alone', () => {
    const note = { ...newNote(72, 0.5), staff: 'bass' as const }
    const project = createProject(120, [{ ...newTrack('piano'), notes: [note] }])
    const restored = parseProject(JSON.stringify(project))!
    expect(pianoStaff(restored.tracks[0].notes[0], 'C')).toBe('bass')
    expect(trackForStaff(restored.tracks[0], 'bass', 'C').notes[0].midi).toBe(72)
    const cello = newTrack('cello')
    expect(trackForStaff(cello, 'bass', 'C')).toBe(cello)
  })
  it('places sharp and flat signatures after each clef in the correct order', () => {
    expect(keySignatureMarks('C', 'treble')).toEqual([])
    expect(keySignatureMarks('D', 'treble')).toEqual([{ symbol: '♯', y: 68 }, { symbol: '♯', y: 86 }])
    expect(keySignatureMarks('D', 'bass')).toEqual([{ symbol: '♯', y: 80 }, { symbol: '♯', y: 98 }])
    expect(keySignatureMarks('B♭', 'treble')).toEqual([{ symbol: '♭', y: 92 }, { symbol: '♭', y: 74 }])
    expect(keySignatureMarks('B♭', 'bass')).toEqual([{ symbol: '♭', y: 104 }, { symbol: '♭', y: 86 }])
    expect(keySignatureMarks('C♯', 'bass')).toHaveLength(7)
    expect(keySignatureMarks('C♭', 'treble')).toHaveLength(7)
  })
})
