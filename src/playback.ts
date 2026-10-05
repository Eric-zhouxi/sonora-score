import { durationToBeats, noteOnsets, type Track } from './workspace'

export interface PlaybackEvent {
  trackId: string
  instrument: Track['instrument']
  noteId: string
  midi: number
  velocity: number
  startBeats: number
  durationBeats: number
}
export function playbackEvents(tracks: Track[], fromBeats = 0): PlaybackEvent[] {
  return tracks.filter((track) => !track.muted).flatMap((track) => {
    const onsets = noteOnsets(track.notes)
    const ordered = track.notes.map((note, index) => ({ note, onset: onsets[index] })).sort((a, b) => a.onset - b.onset)
    const events: PlaybackEvent[] = []
    const tied = new Set<number>()
    for (let index = 0; index < ordered.length; index++) {
      if (tied.has(index)) continue
      const { note, onset } = ordered[index]
      let duration = durationToBeats(note.duration), last = note
      while (last.tieToNext) {
        // Accompaniment may sit between tied melody notes in the same piano track.
        const next = ordered.findIndex((candidate, candidateIndex) => candidateIndex > index && !tied.has(candidateIndex) && candidate.note.midi === note.midi && candidate.note.staff === note.staff && Math.abs(candidate.onset - (onset + duration)) < 0.0001)
        if (next < 0) break
        tied.add(next)
        last = ordered[next].note
        duration += durationToBeats(last.duration)
      }
      if (last.fermata || note.fermata) duration *= 1.5
      const end = onset + duration
      if (end <= fromBeats) continue
      events.push({ trackId: track.id, instrument: track.instrument, noteId: note.id, midi: note.midi, velocity: note.velocity, startBeats: Math.max(onset, fromBeats) - fromBeats, durationBeats: end - Math.max(onset, fromBeats) })
    }
    return events
  })
}
