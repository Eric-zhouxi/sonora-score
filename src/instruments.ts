export const INSTRUMENTS = {
  piano: { name: '钢琴', icon: '♬', program: 0 },
  violin: { name: '小提琴', icon: '𝄞', program: 40 },
  cello: { name: '大提琴', icon: '𝄢', program: 42 },
  flute: { name: '长笛', icon: '♩', program: 73 },
  guitar: { name: '木吉他', icon: '♬', program: 25 },
  electricGuitar: { name: '电吉他', icon: 'ϟ', program: 27 },
  bass: { name: '电贝斯', icon: '𝄢', program: 33 },
  drums: { name: '电子鼓组', icon: '▦', program: 0 },
} as const
export type InstrumentId = keyof typeof INSTRUMENTS
export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[]

export const DRUM_PADS = [
  { midi: 36, name: '底鼓', file: 'kick', y: 116, cross: false },
  { midi: 38, name: '军鼓', file: 'snare', y: 92, cross: false },
  { midi: 42, name: '闭合踩镲', file: 'closed-hat', y: 62, cross: true },
  { midi: 46, name: '开放踩镲', file: 'open-hat', y: 62, cross: true },
  { midi: 41, name: '低通鼓', file: 'low-tom', y: 104, cross: false },
  { midi: 45, name: '中通鼓', file: 'mid-tom', y: 86, cross: false },
  { midi: 48, name: '高通鼓', file: 'high-tom', y: 80, cross: false },
  { midi: 49, name: '碎音镲', file: 'crash', y: 56, cross: true },
  { midi: 51, name: '叮叮镲', file: 'ride', y: 68, cross: true },
] as const

export function drumInfo(midi: number) {
  const aliases: Record<number, number> = { 35: 36, 37: 38, 40: 38, 44: 42, 43: 41, 47: 45, 50: 48, 52: 49, 55: 49, 57: 49, 53: 51, 59: 51 }
  return DRUM_PADS.find((pad) => pad.midi === (aliases[midi] ?? midi))
}
export function drumName(midi: number) { return drumInfo(midi)?.name ?? `打击乐 ${midi}（通用音色）` }
