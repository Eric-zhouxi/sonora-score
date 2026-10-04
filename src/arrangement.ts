import {
  beatsPerMeasure, durationToBeats, KEY_FIFTHS, KEY_TONICS, makeId, noteOnsets,
  trackDurationBeats, trackKey, trackMeter,
  type Clip, type KeySignature, type NoteEvent, type ProjectData, type Track,
} from './workspace'

export interface ClipRegion extends Clip { endBeats: number; notes: NoteEvent[] }
export function clipRegions(track: Track): ClipRegion[] {
  const onsets = noteOnsets(track.notes)
  const fallback = `${track.id}-main`
  const clips = track.clips?.length ? track.clips : [{ id: fallback, name: '片段 1', startBeats: Math.min(...onsets, 0) }]
  return clips.map((clip) => {
    const notes = track.notes.flatMap((note, index) => (note.clipId ?? clips[0].id) === clip.id ? [{ ...note, onsetBeats: onsets[index] }] : [])
    return { ...clip, notes, endBeats: Math.max(clip.startBeats, ...notes.map((note) => note.onsetBeats! + durationToBeats(note.duration))) }
  })
}

export function moveClip(track: Track, clipId: string, requestedStart: number): Track {
  const clip = clipRegions(track).find((region) => region.id === clipId)
  if (!clip) return track
  const start = Math.max(0, requestedStart), delta = start - clip.startBeats
  const onsets = noteOnsets(track.notes)
  return {
    ...track,
    clips: clipRegions(track).map(({ notes: _notes, endBeats: _end, ...region }) => region.id === clipId ? { ...region, startBeats: start } : region),
    notes: track.notes.map((note, index) => ({ ...note, onsetBeats: onsets[index] + (clip.notes.some((item) => item.id === note.id) ? delta : 0) })).sort((a, b) => a.onsetBeats! - b.onsetBeats!),
  }
}

export function splitClip(track: Track, noteId: string): { track: Track; clipId: string } | null {
  const onsets = noteOnsets(track.notes)
  const index = track.notes.findIndex((note) => note.id === noteId)
  if (index < 0) return null
  const sourceId = track.notes[index].clipId ?? clipRegions(track)[0]?.id
  const newClip: Clip = { id: makeId('clip'), name: `片段 ${clipRegions(track).length + 1}`, startBeats: onsets[index] }
  const notes = track.notes.map((note, n) => ({ ...note, onsetBeats: onsets[n], clipId: (note.clipId ?? sourceId) === sourceId && onsets[n] >= onsets[index] ? newClip.id : note.clipId }))
  return { track: { ...track, clips: [...clipRegions(track).map(({ notes: _notes, endBeats: _end, ...clip }) => clip), newClip], notes }, clipId: newClip.id }
}

export function transposeTrack(track: Track, semitones: number, targetKey?: KeySignature): Track {
  // Shift the entire part by a single interval; never clamp individual notes and change the harmony.
  const min = Math.min(...track.notes.map((note) => note.midi), 108)
  const max = Math.max(...track.notes.map((note) => note.midi), 0)
  const shift = Math.max(-min, Math.min(127 - max, semitones))
  return { ...track, keySignature: targetKey ?? track.keySignature, notes: track.notes.map((note) => ({ ...note, midi: note.midi + shift, spelling: undefined })) }
}
export function keyInterval(from: KeySignature, to: KeySignature): number {
  let interval = (KEY_TONICS[to] - KEY_TONICS[from] + 12) % 12
  if (interval > 6) interval -= 12
  return interval
}

export interface ScoreEvent {
  kind: 'note' | 'rest'
  id: string
  onsetBeats: number
  durationBeats: number
  measure: number
  note?: NoteEvent
  tieIn?: boolean
  tieOut?: boolean
  fullMeasure?: boolean
}
const EPS = 0.00001
const restValues = [6, 4, 3, 2, 1.5, 1, 0.75, 0.5, 0.375, 0.25]
export function scoreEvents(track: Track, meter: ProjectData['timeSignature'], endBeats?: number): ScoreEvent[] {
  const measure = beatsPerMeasure(meter), onsets = noteOnsets(track.notes)
  const end = endBeats ?? Math.ceil(Math.max(measure, trackDurationBeats(track.notes)) / measure) * measure
  const intervals = track.notes.map((note, index) => ({ note, start: onsets[index], end: onsets[index] + durationToBeats(note.duration) })).sort((a, b) => a.start - b.start)
  const events: ScoreEvent[] = []
  function rests(start: number, stop: number) {
    let cursor = start
    while (stop - cursor > EPS) {
      const barEnd = (Math.floor((cursor + EPS) / measure) + 1) * measure
      const available = Math.min(stop, barEnd) - cursor
      const fullMeasure = Math.abs(cursor % measure) < EPS && available >= measure - EPS
      const duration = fullMeasure ? measure : restValues.find((value) => value <= available + EPS) ?? available
      events.push({ kind: 'rest', id: `rest-${cursor}`, onsetBeats: cursor, durationBeats: duration, measure: Math.floor((cursor + EPS) / measure), fullMeasure })
      cursor += duration
    }
  }
  let covered = 0
  for (const interval of intervals) {
    if (interval.start > covered + EPS) rests(covered, Math.min(end, interval.start))
    let cursor = interval.start
    while (cursor < Math.min(interval.end, end) - EPS) {
      const stop = Math.min(interval.end, end, (Math.floor((cursor + EPS) / measure) + 1) * measure)
      events.push({ kind: 'note', id: `${interval.note.id}-${cursor}`, onsetBeats: cursor, durationBeats: stop - cursor, measure: Math.floor((cursor + EPS) / measure), note: interval.note, tieIn: cursor > interval.start + EPS, tieOut: stop < interval.end - EPS || interval.note.tieToNext })
      cursor = stop
    }
    covered = Math.max(covered, interval.end)
  }
  if (covered < end - EPS) rests(covered, end)
  return events.sort((a, b) => a.onsetBeats - b.onsetBeats || (a.kind === 'rest' ? 1 : -1))
}
export function selectedScore(project: ProjectData, trackIds: string[]) {
  const tracks = project.tracks.filter((track) => trackIds.includes(track.id))
  const endBeats = Math.max(4, ...tracks.map((track) => trackDurationBeats(track.notes)))
  return { tracks, endBeats, parts: tracks.map((track) => ({ track, key: trackKey(track, project), meter: trackMeter(track, project), events: scoreEvents(track, trackMeter(track, project), endBeats) })) }
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL = [0, 2, 4, 5, 7, 9, 11]
export function keyAlterations(key: KeySignature): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(LETTERS.map((letter) => [letter, 0]))
  const fifths = KEY_FIFTHS[key]
  const order = fifths >= 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F']
  order.slice(0, Math.abs(fifths)).forEach((letter) => { result[letter] = Math.sign(fifths) })
  return result
}
export function writtenPitch(note: NoteEvent, key: KeySignature) {
  const octave = Math.floor(note.midi / 12) - 1, alterations = keyAlterations(key)
  if (!note.spelling) {
    for (const oct of [octave, octave - 1, octave + 1]) for (let index = 0; index < LETTERS.length; index++) {
      const letter = LETTERS[index], alter = alterations[letter]
      if ((oct + 1) * 12 + NATURAL[index] + alter === note.midi) return { letter, octave: oct, alter, degree: index }
    }
  }
  const pc = note.midi % 12
  const index = NATURAL.indexOf(pc)
  if (index >= 0) return { letter: LETTERS[index], octave, alter: 0, degree: index }
  const useFlat = note.spelling === 'flat' || (!note.spelling && KEY_FIFTHS[key] < 0)
  const degree = useFlat ? [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][pc] : [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc]
  return { letter: LETTERS[degree], octave, alter: useFlat ? -1 : 1, degree }
}
