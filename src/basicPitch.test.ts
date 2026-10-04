import { describe, expect, it } from 'vitest'
import { inferChords, type TranscribedNote } from './basicPitch'

function note(midi: number, start = 0, duration = 1): TranscribedNote {
  return { midi, onsetSeconds: start, durationSeconds: duration, confidence: 0.9 }
}

describe('browser polyphonic post-processing', () => {
  it('labels simultaneous C major notes as a C chord', () => {
    const chords = inferChords([note(60), note(64), note(67)], 1)
    expect(chords).toHaveLength(1)
    expect(chords[0].label).toBe('C')
    expect(chords[0].startSeconds).toBe(0)
    expect(chords[0].endSeconds).toBe(1)
  })

  it('keeps adjacent major and minor regions separate', () => {
    const notes = [note(60, 0), note(64, 0), note(67, 0), note(57, 1), note(60, 1), note(64, 1)]
    const chords = inferChords(notes, 2)
    expect(chords.map((chord) => chord.label)).toEqual(['C', 'Am'])
  })

  it('does not invent a chord from a monophonic melody', () => {
    expect(inferChords([note(60), note(64, 1)], 2)).toEqual([])
  })
})
