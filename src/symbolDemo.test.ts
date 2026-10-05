import { describe, expect, it } from 'vitest'
import { createSymbolDemo, SYMBOL_DEMO_ID, withSymbolDemo } from './symbolDemo'
import { createBlankProject } from './workspace'
import { playbackEvents } from './playback'
import { scoreEvents } from './arrangement'
import { trackForStaff } from './staffLayout'

describe('playable symbol demo', () => {
  it('adds the demo once without replacing any user or edited demo data', () => {
    const user = createBlankProject('我的作品'), projects = withSymbolDemo([user])
    expect(projects).toHaveLength(2)
    expect(projects[1]).toBe(user)
    projects[0].title = '我修改过的示例'
    expect(withSymbolDemo(projects)).toBe(projects)
    expect(projects[0].id).toBe(SYMBOL_DEMO_ID)
  })
  it('covers every input duration, accidentals, ties, fermatas and short/full-measure rests', () => {
    const demo = createSymbolDemo(), notes = demo.tracks.flatMap((track) => track.notes)
    expect([...new Set(notes.map((note) => note.duration))].sort()).toEqual([.0625, .125, .25, .5, 1])
    expect(notes.some((note) => note.spelling === 'sharp')).toBe(true)
    expect(notes.some((note) => note.spelling === 'flat')).toBe(true)
    expect(notes.some((note) => note.tieToNext)).toBe(true)
    expect(notes.some((note) => note.fermata)).toBe(true)
    const events = scoreEvents(trackForStaff(demo.tracks[0], 'treble', 'D'), '4/4', 40)
    expect(events.some((event) => event.kind === 'note' && event.durationBeats === 1.5 && event.tieOut)).toBe(true)
    for (const duration of [.25, .5, 1, 4]) expect(events.some((event) => event.kind === 'rest' && event.durationBeats === duration)).toBe(true)
  })
  it('sustains tied piano melody over accompaniment and holds the closing fermata', () => {
    const events = playbackEvents(createSymbolDemo().tracks)
    expect(events.find((event) => event.midi === 69 && event.startBeats === 16)?.durationBeats).toBe(2)
    expect(events.some((event) => event.midi === 69 && event.startBeats === 17)).toBe(false)
    expect(events.find((event) => event.midi === 50 && event.startBeats === 16)?.durationBeats).toBe(4)
    expect(Math.max(...events.map((event) => event.startBeats + event.durationBeats))).toBe(42)
  })
})
