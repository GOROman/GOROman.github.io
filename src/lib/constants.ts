import type { VisualizerColors, LevelMeterColors } from './types';

export const VISUALIZER_COLORS: VisualizerColors = {
  bg: '#000010',
  whiteKey: '#303060',
  blackKey: '#101030',
  keyBorder: '#404080',
  keyOn: '#e0e0ff',
  keyOnMidi: '#ffff80',
  text: '#6080c0',
  textDim: '#304080',
  textBright: '#80a0ff',
  textMidi: '#ffff00',
  regText: '#5070b0',
};

export const LEVEL_METER_COLORS: LevelMeterColors = {
  bg: '#000010',
  grid: '#102040',
  gridMuted: '#080818',
  barLow: '#4080ff',
  barMid: '#60a0ff',
  barHigh: '#80c0ff',
  barLowMuted: '#203040',
  barMidMuted: '#304050',
  barHighMuted: '#405060',
  barMidiLow: '#c0c000',
  barMidiMid: '#e0e000',
  barMidiHigh: '#ffff00',
  peak: '#ffffff',
  peakMuted: '#606060',
  label: '#60a0ff',
  labelMuted: '#304060',
  textDim: '#304080',
  panL: '#00ff00',
  panR: '#ff4040',
  panOff: '#202040',
};

export const NUM_FM_CHANNELS = 8;
export const NUM_PCM_CHANNELS = 8;
export const NUM_OCTAVES = 8;

export const SAMPLE_RATE = 48000;

export const APP_VERSION = '0.12';
