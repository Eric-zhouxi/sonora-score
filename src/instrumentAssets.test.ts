import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createBandDemo, withBandDemo } from './bandDemo'
import { INSTRUMENT_IDS, DRUM_PADS, drumInfo } from './instruments'

describe('expanded instrument assets', () => {
  it('bundles all 18 samples with matching content hashes and audio headers', () => {
    const manifest = JSON.parse(readFileSync('assets/samples/expanded-manifest.json', 'utf8'))
    expect(manifest.samples).toHaveLength(18)
    for (const sample of manifest.samples) {
      const bytes = readFileSync(`public/samples/${sample.file}`)
      expect(bytes.length).toBe(sample.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sample.sha256)
      if (sample.file.endsWith('.wav')) expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
      else expect(bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 0xff).toBe(true)
    }
  })
  it('exposes distinct instruments, nine pads and an editable nonduplicating demo', () => {
    expect(INSTRUMENT_IDS).toHaveLength(8)
    expect(DRUM_PADS).toHaveLength(9)
    expect(drumInfo(35)?.midi).toBe(36)
    expect(drumInfo(80)).toBeUndefined()
    const projects = [createBandDemo()]
    projects[0].title = '用户编辑的鼓曲'
    expect(withBandDemo(projects)).toBe(projects)
    expect(projects[0].tracks.map((track) => track.instrument)).toEqual(['guitar', 'electricGuitar', 'bass', 'drums'])
  })
})
