import { Midi } from '@tonejs/midi'
import { durationToBeats, newNote, noteOnsets, type Duration, type InstrumentId, type Track } from './music'

const supportedDurations: Duration[] = [0.25, 0.5, 1, 2]
const midiPrograms: Record<InstrumentId, number> = { piano: 0, violin: 40, cello: 42, flute: 73 }

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
    target.instrument.number = midiPrograms[source.instrument]
    const onsets = noteOnsets(source.notes)
    source.notes.forEach((note, index) => {
      const durationTicks = durationToBeats(note.duration)
      target.addNote({ midi: note.midi, ticks: midi.header.ppq * onsets[index], durationTicks: midi.header.ppq * durationTicks, velocity: note.velocity })
    })
  })
  return midi.toArray()
}

export function midiToProject(bytes: ArrayBuffer): { bpm: number; tracks: Track[] } {
  const midi = new Midi(bytes)
  const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 96)
  const colors = ['#d8aa59', '#d47f67']
  const imported = midi.tracks.filter((track) => track.notes.length > 0).slice(0, 2)
  const tracks = imported.map((track, index): Track => {
    const program = track.instrument.number
    const instrument: InstrumentId = program === 42 ? 'cello' : program === 73 ? 'flute' : program >= 40 && program <= 47 ? 'violin' : 'piano'
    return {
      id: `imported-${index + 1}`,
      instrument,
      name: track.name || `导入${instrument === 'piano' ? '钢琴' : instrument === 'violin' ? '小提琴' : instrument === 'cello' ? '大提琴' : '长笛'}`,
      color: colors[index],
      muted: false,
      notes: [...track.notes]
        .sort((a, b) => a.ticks - b.ticks)
        .map((note) => ({
          ...newNote(note.midi, closestDuration(note.durationTicks / midi.header.ppq)),
          velocity: note.velocity,
          onsetBeats: note.ticks / midi.header.ppq,
        })),
    }
  })

  if (tracks.length === 0) throw new Error('MIDI 文件中没有音符')
  if (tracks.length === 1) tracks.push({ id: 'violin-1', instrument: 'violin', name: '独奏小提琴', color: colors[1], muted: false, notes: [] })
  return { bpm, tracks }
}
