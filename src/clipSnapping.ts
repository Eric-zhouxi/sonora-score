/** Snap either clip edge to nearby boundaries before applying the rhythmic grid. */
export function snapClipStart(rawStart: number, length: number, targets: number[], tolerance: number, grid: number, bypass = false) {
  const raw = Math.max(0, rawStart)
  if (bypass) return { start: raw, guides: [] as number[] }
  let start: number | undefined, closest = tolerance + Number.EPSILON
  for (const target of targets) {
    for (const edge of [0, length]) {
      const candidate = target - edge, distance = Math.abs(candidate - raw)
      if (candidate >= 0 && distance <= tolerance && distance < closest) {
        start = candidate
        closest = distance
      }
    }
  }
  if (start === undefined) return { start: Math.max(0, grid ? Math.round(raw / grid) * grid : raw), guides: [] as number[] }
  const alignedStart = start
  return { start, guides: [...new Set(targets.filter((target) => Math.abs(target - alignedStart) < 1e-7 || Math.abs(target - alignedStart - length) < 1e-7))] }
}
