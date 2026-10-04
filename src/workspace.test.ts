import { describe, expect, it } from 'vitest'
import {
  beatsPerMeasure,
  createBlankProject,
  createExampleProject,
  midiToJianpu,
  midiToName,
  midiToStaffY,
  newTrack,
  parseProject,
} from './workspace'

describe('workspace score model', () => {
  it('creates a truly blank project with one editable piano part', () => {
    const project = createBlankProject()
    expect(project.example).not.toBe(true)
    expect(project.tracks).toHaveLength(1)
    expect(project.tracks[0]).toMatchObject({ instrument: 'piano', notes: [] })
  })

  it('ships a separate example score with first and second violin', () => {
    const example = createExampleProject()
    expect(example.example).toBe(true)
    expect(example.tracks.map((track) => track.name)).toEqual([
      '钢琴',
      '第一小提琴',
      '第二小提琴',
    ])
  })

  it('names additional violin parts by orchestral role', () => {
    const first = newTrack('violin')
    expect(first.name).toBe('第一小提琴')
    expect(newTrack('violin', [first]).name).toBe('第二小提琴')
  })

  it('spells the same black key as a sharp or a flat', () => {
    expect(midiToName(61, 'sharp')).toBe('C♯4')
    expect(midiToName(61, 'flat')).toBe('D♭4')
    expect(midiToJianpu(61, 'flat').degree).toContain('♭')
  })

  it('places enharmonic notes and bass-clef notes on their written staff positions', () => {
    expect(midiToStaffY(61, 'sharp')).not.toBe(midiToStaffY(61, 'flat'))
    expect(midiToStaffY(48, 'sharp', 'bass')).toBeGreaterThan(60)
  })

  it('calculates measure lengths for the supported meters', () => {
    expect(beatsPerMeasure('4/4')).toBe(4)
    expect(beatsPerMeasure('3/4')).toBe(3)
    expect(beatsPerMeasure('6/8')).toBe(3)
  })

  it('rejects invalid persisted project data', () => {
    expect(parseProject('{not-json')).toBeNull()
  })
})
