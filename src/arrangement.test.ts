import { describe, expect, it } from 'vitest'
import { clipRegions, keyInterval, moveClip, scoreEvents, selectedScore, splitClip, transposeTrack } from './arrangement'
import { playbackEvents } from './playback'
import { createProject, newNote, newTrack, normalizeTrack, parseProject } from './workspace'

function fixture() {
  const track = normalizeTrack({ ...newTrack('piano'), notes: [
    { ...newNote(60, 0.25), onsetBeats: 0, clipId: 'a' },
    { ...newNote(64, 0.25), onsetBeats: 1, clipId: 'a' },
    { ...newNote(67, 0.5), onsetBeats: 6, clipId: 'b' },
  ], clips: [{ id: 'a', name: '开头', startBeats: 0 }, { id: 'b', name: '结尾', startBeats: 6 }] }, 0)
  return track
}
describe('arrangement time and notation', () => {
  it('moves only the chosen clip and preserves its rhythm and the other clip', () => {
    const original = fixture(), moved = moveClip(original, 'a', 3)
    expect(moved.notes.map((note) => note.onsetBeats)).toEqual([3, 4, 6])
    expect(clipRegions(moved).find((clip) => clip.id === 'a')?.startBeats).toBe(3)
    expect(original.notes.map((note) => note.onsetBeats)).toEqual([0, 1, 6])
  })
  it('prevents moving a clip before zero without squashing its note intervals', () => {
    const moved = moveClip(fixture(), 'b', -2)
    expect(moved.notes.find((note) => note.clipId === 'b')?.onsetBeats).toBe(0)
  })
  it('splits at a note while keeping absolute playback time unchanged', () => {
    const track = fixture(), result = splitClip(track, track.notes[1].id)!
    expect(result.track.notes.map((note) => note.onsetBeats)).toEqual([0, 1, 6])
    expect(clipRegions(result.track).find((clip) => clip.id === result.clipId)?.notes.map((note) => note.midi)).toEqual([64])
  })
  it('fills initial, internal and trailing silence and splits rests at barlines', () => {
    const track = normalizeTrack({ ...newTrack('piano'), notes: [{ ...newNote(60, 0.25), onsetBeats: 2 }, { ...newNote(64, 0.25), onsetBeats: 6 }] }, 0)
    const events = scoreEvents(track, '4/4', 8)
    expect(events.filter((event) => event.kind === 'rest').reduce((sum, rest) => sum + rest.durationBeats, 0)).toBe(6)
    expect(events.every((event) => event.onsetBeats + event.durationBeats <= (event.measure + 1) * 4 + 0.0001)).toBe(true)
  })
  it('does not put rests inside overlapping notes or chords', () => {
    const track = normalizeTrack({ ...newTrack('piano'), notes: [{ ...newNote(60, 1), onsetBeats: 0 }, { ...newNote(64, 0.25), onsetBeats: 1 }] }, 0)
    expect(scoreEvents(track, '4/4', 4).filter((event) => event.kind === 'rest')).toEqual([])
  })
  it('splits a long note at local 3/4 bar boundaries with ties', () => {
    const track = normalizeTrack({ ...newTrack('piano'), notes: [{ ...newNote(60, 1), onsetBeats: 2 }] }, 0)
    const notes = scoreEvents(track, '3/4', 6).filter((event) => event.kind === 'note')
    expect(notes.map((note) => note.durationBeats)).toEqual([1, 3])
    expect(notes[0].tieOut).toBe(true)
    expect(notes[1].tieIn).toBe(true)
  })
  it('keeps independent meter and key in selected combined score', () => {
    const first = { ...fixture(), keySignature: 'D' as const, timeSignature: '3/4' as const }
    const second = { ...normalizeTrack(newTrack('piano', [first]), 1), keySignature: 'F' as const, timeSignature: '7/8' as const }
    const project = createProject(120, [first, second])
    const score = selectedScore(project, [first.id, second.id])
    expect(score.parts.map((part) => [part.key, part.meter])).toEqual([['D', '3/4'], ['F', '7/8']])
    expect(selectedScore(project, [second.id]).tracks).toHaveLength(1)
  })
  it('transposes all notes by one interval without changing timing or other parts', () => {
    const track = fixture(), changed = transposeTrack(track, keyInterval('C', 'D'), 'D')
    expect(changed.notes.map((note) => note.midi)).toEqual([62, 66, 69])
    expect(changed.notes.map((note) => note.onsetBeats)).toEqual([0, 1, 6])
    expect(track.notes.map((note) => note.midi)).toEqual([60, 64, 67])
  })
  it('migrates schema 3 and retains project identity, title and global defaults', () => {
    const project = createProject(96, [fixture()], '旧作品')
    const migrated = parseProject(JSON.stringify({ ...project, schemaVersion: 3, keySignature: 'F', timeSignature: '3/4', tracks: [{ ...fixture(), keySignature: undefined, timeSignature: undefined }] }))!
    expect(migrated.schemaVersion).toBe(4)
    expect(migrated.title).toBe('旧作品')
    expect(migrated.id).toBe(project.id)
    expect(migrated.tracks[0]).toMatchObject({ keySignature: 'F', timeSignature: '3/4' })
  })
})
describe('playback from the time cursor', () => {
  it('starts a sustaining note at the cursor and excludes ended notes', () => {
    const events = playbackEvents([fixture()], 7)
    expect(events.map((event) => [event.midi, event.startBeats, event.durationBeats])).toEqual([[67, 0, 1]])
  })
  it('merges ties and ignores muted tracks', () => {
    const track = normalizeTrack({ ...newTrack('piano'), notes: [{ ...newNote(60, 0.25), onsetBeats: 0, tieToNext: true }, { ...newNote(60, 0.25), onsetBeats: 1 }] }, 0)
    expect(playbackEvents([track], 0.5).map((event) => event.durationBeats)).toEqual([1.5])
    expect(playbackEvents([{ ...track, muted: true }])).toEqual([])
  })
})
