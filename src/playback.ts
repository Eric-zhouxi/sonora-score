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
    for (let index = 0; index < ordered.length; index++) {
      const { note, onset } = ordered[index]
      let duration = durationToBeats(note.duration), last = note
      while (last.tieToNext && ordered[index + 1]?.note.midi === note.midi && Math.abs(ordered[index + 1].onset - (onset + duration)) < 0.0001) {
        index++
        last = ordered[index].note
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
