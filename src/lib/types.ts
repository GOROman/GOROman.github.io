// MDX Player Types

export interface FMChannel {
  keyOn: boolean;
  logicalSumOfKeyOn: boolean;
  note: number;
  volume: number;
}

export interface PCMChannel {
  keyOn: boolean;
  note: number;
  volume: number;
}

export interface MidiKeyState {
  keyOn: boolean;
  note: number;
}

export interface ChannelData {
  type: 'CHANNEL';
  fm: FMChannel[];
  pcm: PCMChannel[];
  opmRegs: number[];
  playTime: number;
  loopCount: number;
  tempo: number;
  titleBytes: number[];
  midiChannelActive: number;
  midiKeyState: MidiKeyState[];
}

export interface MuteState {
  fm: boolean[];
  pcm: boolean[];
}

export interface MuteMessage {
  type: 'MUTE';
  channelType: 'fm' | 'pcm';
  channel: number;
  muted: boolean;
}

export interface TitleMessage {
  type: 'TITLE';
  titleBytes: number[];
}

export type SynthMessage = ChannelData | TitleMessage;

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface PlaybackInfo {
  time: string;
  loopCount: number;
  tempo: number;
  title: string;
}

export interface VisualizerColors {
  bg: string;
  whiteKey: string;
  blackKey: string;
  keyBorder: string;
  keyOn: string;
  keyOnMidi: string;
  text: string;
  textDim: string;
  textBright: string;
  textMidi: string;
  regText: string;
}

export interface LevelMeterColors {
  bg: string;
  grid: string;
  gridMuted: string;
  barLow: string;
  barMid: string;
  barHigh: string;
  barLowMuted: string;
  barMidMuted: string;
  barHighMuted: string;
  barMidiLow: string;
  barMidiMid: string;
  barMidiHigh: string;
  peak: string;
  peakMuted: string;
  label: string;
  labelMuted: string;
  textDim: string;
  panL: string;
  panR: string;
  panOff: string;
}

export type VisualizerTab = 'keyboard' | 'level' | 'opm';
