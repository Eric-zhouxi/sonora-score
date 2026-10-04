import { describe, expect, it } from 'vitest'
import { snapClipStart } from './clipSnapping'

describe('clip alignment', () => {
  it('aligns the closest edge to exact off-grid boundaries', () => {
    expect(snapClipStart(4.08, 2, [4.1, 9], 0.2, 1)).toEqual({ start: 4.1, guides: [4.1] })
    expect(snapClipStart(4.08, 2, [6.1], 0.2, 1)).toEqual({ start: 4.1, guides: [6.1] })
    expect(snapClipStart(4.08, 2, [4, 6], 0.2, 1)).toEqual({ start: 4, guides: [4, 6] })
  })
  it('uses the grid outside the attraction radius and never creates negative starts', () => {
    expect(snapClipStart(3.3, 2, [5.7], 0.2, 0.25)).toEqual({ start: 3.25, guides: [] })
    expect(snapClipStart(0.03, 2, [1.9], 0.2, 0)).toEqual({ start: 0.03, guides: [] })
    expect(snapClipStart(-1, 2, [0], 0.2, 1).start).toBe(0)
  })
  it('bypasses both alignment and beat snapping for fine dragging', () => {
    expect(snapClipStart(4.08, 2, [4, 6], 0.2, 1, true)).toEqual({ start: 4.08, guides: [] })
    expect(snapClipStart(4.08, 2, [], 0.2, 0)).toEqual({ start: 4.08, guides: [] })
  })
})
