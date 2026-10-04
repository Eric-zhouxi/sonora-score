import { Midi } from '@tonejs/midi'
import { durationToBeats, newNote, type Duration, type InstrumentId, type Track } from './music'

const supportedDurations: Duration[] = [0.25, 0.5, 1, 2]

function closestDuration(beats: number): Duration {
  return supportedDurations.reduce((closest, duration) =>
    Math.abs(durationToBeats(duration) - beats) < Math.abs(durationToBeats(closest) - beats) ? duration : closest,
  )
}

export function projectToMidi(tracks: Track[], bpm: number): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  tracks.forEach((source) => {
    const target = midi.addTrack()
    target.name = source.name
    target.instrument.number = source.id === 'violin' ? 40 : 0
    let beats = 0
    source.notes.forEach((note) => {
      const durationTicks = durationToBeats(note.duration)
      target.addNote({ midi: note.midi, ticks: midi.header.ppq * beats, durationTicks: midi.header.ppq * durationTicks, velocity: note.velocity })
      beats += durationTicks
    })
  })
  return midi.toArray()
}

export function midiToProject(bytes: ArrayBuffer): { bpm: number; tracks: Track[] } {
  const midi = new Midi(bytes)
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 96)
  const colors = ['#d8aa59', '#d47f67']
  const ids: InstrumentId[] = ['piano', 'violin']
  const imported = midi.tracks.filter((track) => track.notes.length > 0).slice(0, 2)
  const tracks = imported.map((track, index): Track => {
    const id = ids[index]
    return {
      id,
      name: track.name || (id === 'piano' ? '导入钢琴' : '导入声部 2'),
      color: colors[index],
      muted: false,
      notes: [...track.notes]
        .sort((a, b) => a.ticks - b.ticks)
        .map((note) => ({ ...newNote(note.midi, closestDuration(note.durationTicks / midi.header.ppq)), velocity: note.velocity })),
    }
  })

  if (tracks.length === 0) throw new Error('MIDI 文件中没有音符')
  if (tracks.length === 1) tracks.push({ id: 'violin', name: '独奏小提琴', color: colors[1], muted: false, notes: [] })
  return { bpm, tracks }
}
