import { describe, expect, it } from 'vitest'
import { createProject, durationToBeats, isAccidental, midiToJianpu, midiToName, midiToStaffY, newNote, noteOnsets, parseProject, pitches, starterTracks, type NoteEvent } from './music'

describe('music mapping', () => {
  it('maps middle C to staff, scientific pitch and jianpu', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToJianpu(60)).toEqual({ degree: '1', octave: 0 })
    expect(midiToStaffY(60)).toBe(110)
  })

  it('maps the octave above middle C', () => {
    expect(midiToName(72)).toBe('C5')
    expect(midiToJianpu(72)).toEqual({ degree: '1', octave: 1 })
    expect(midiToStaffY(72)).toBe(68)
  })

  it('maps all twelve chromatic pitches including sharp notation', () => {
    expect(pitches).toEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72])
    expect(midiToName(61)).toBe('C♯4')
    expect(midiToJianpu(61).degree).toBe('1♯')
    expect(isAccidental(61)).toBe(true)
    expect(isAccidental(62)).toBe(false)
  })

  it('converts notation durations to quarter-note beats', () => {
    expect(durationToBeats(0.25)).toBe(1)
    expect(durationToBeats(1)).toBe(4)
  })

  it('supports explicit overlapping onsets and sequential notes together', () => {
    const notes: NoteEvent[] = [60, 64, 67].map((midi) => ({ ...newNote(midi, 0.25), onsetBeats: 0 }))
    notes.push(newNote(72, 0.25))
    expect(noteOnsets(notes)).toEqual([0, 0, 0, 1])
  })

  it('migrates v1 projects where the track id was also the instrument', () => {
    const legacy = JSON.stringify({ ...createProject(96, starterTracks), schemaVersion: 1, tracks: starterTracks.map((track) => ({ ...track, id: track.instrument, instrument: undefined })) })
    const migrated = parseProject(legacy)
    expect(migrated?.schemaVersion).toBe(2)
    expect(migrated?.tracks.map((track) => track.instrument)).toEqual(['piano', 'violin'])
    expect(new Set(migrated?.tracks.map((track) => track.id)).size).toBe(2)
  })
})
