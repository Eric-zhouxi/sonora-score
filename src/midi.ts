import { Midi } from '@tonejs/midi'
import { durationToBeats, newNote, newTrack, normalizeTrack, noteOnsets, TRACK_COLORS, type Duration, type InstrumentId, type Track } from './workspace'
import { INSTRUMENTS } from './instruments'

const supportedDurations: Duration[] = [0.0625, 0.125, 0.25, 0.5, 1, 2]

function closestDuration(beats: number): Duration {
  return supportedDurations.reduce((closest, duration) =>
    Math.abs(durationToBeats(duration) - beats) < Math.abs(durationToBeats(closest) - beats) ? duration : closest,
  )
}

export function projectToMidi(tracks: Track[], bpm: number): Uint8Array {
  const midi = new Midi()
  midi.header.setTempo(bpm)
  const channels = new Map<InstrumentId, number>()
  tracks.forEach((source) => {
    const target = midi.addTrack()
    target.name = source.name
    if (source.instrument !== 'drums' && !channels.has(source.instrument)) {
      const channel = channels.size
      channels.set(source.instrument, channel >= 9 ? channel + 1 : channel)
    }
    target.channel = source.instrument === 'drums' ? 9 : channels.get(source.instrument)!
    target.instrument.number = INSTRUMENTS[source.instrument].program
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
  const imported = midi.tracks.filter((track) => track.notes.length > 0)
  const tracks = imported.map((track, index): Track => {
    const program = track.instrument.number
    const instrument: InstrumentId = track.channel === 9 ? 'drums' : program >= 24 && program <= 26 ? 'guitar' : program >= 27 && program <= 31 ? 'electricGuitar' : program >= 32 && program <= 39 ? 'bass' : program === 42 ? 'cello' : program === 73 ? 'flute' : program >= 40 && program <= 47 ? 'violin' : 'piano'
    return normalizeTrack({
      ...newTrack(instrument),
      color: TRACK_COLORS[index % TRACK_COLORS.length],
      name: track.name || `导入${INSTRUMENTS[instrument].name}`,
      muted: false,
      notes: [...track.notes]
        .sort((a, b) => a.ticks - b.ticks)
        .map((note) => ({
          ...newNote(note.midi, closestDuration(note.durationTicks / midi.header.ppq)),
          velocity: note.velocity,
          onsetBeats: note.ticks / midi.header.ppq,
        })),
    }, index)
  })

  if (tracks.length === 0) throw new Error('MIDI 文件中没有音符')
  return { bpm, tracks }
}
