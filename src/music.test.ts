import { describe, expect, it } from 'vitest'
import { durationToBeats, midiToJianpu, midiToName, midiToStaffY } from './music'

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

  it('converts notation durations to quarter-note beats', () => {
    expect(durationToBeats(0.25)).toBe(1)
    expect(durationToBeats(1)).toBe(4)
  })
})
