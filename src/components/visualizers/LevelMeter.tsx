import { useRef, useEffect, useCallback } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

// Same as original SpectrumAnalyzer/LevelMeter colors
const COLORS = {
  bg: '#000010',
  barLow: '#2060a0',
  barMid: '#40a0ff',
  barHigh: '#80ffff',
  barLowMuted: '#102030',
  barMidMuted: '#183050',
  barHighMuted: '#204060',
  peak: '#ffffff',
  peakMuted: '#404060',
  // MIDI: yellow
  barMidiLow: '#606000',
  barMidiMid: '#c0c000',
  barMidiHigh: '#ffff00',
  text: '#6080c0',
  textDim: '#304080',
  grid: '#101830',
  gridMuted: '#080818',
  label: '#5080c0',
  labelMuted: '#303050',
  panL: '#80c0ff',
  panR: '#80c0ff',
  panOff: '#303050',
};

const SEGMENT_HEIGHT = 3;
const SEGMENT_GAP = 2;

export function LevelMeter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { channelData, muteState } = useMDXPlayer();

  // Level state refs for decay animation
  const keyOnLevelRef = useRef<number[]>(Array(8).fill(0));
  const keyOffLevelRef = useRef<number[]>(Array(8).fill(0));
  const peakHoldRef = useRef<number[]>(Array(8).fill(0));
  const peakDecayRef = useRef<number[]>(Array(8).fill(0));

  const normalizeVolume = useCallback((volume: number) => {
    if (volume & 0x80) {
      return (0x7f - (volume & 0x7f)) * 2;
    }
    return (volume & 0xf) * 0x11;
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const headerHeight = 15;
    const footerHeight = 28;
    const barWidth = 28;
    const barGap = 10;
    const startX = 20;
    const maxBarHeight = height - headerHeight - footerHeight;
    const barTop = headerHeight;
    const totalSegments = Math.floor(maxBarHeight / (SEGMENT_HEIGHT + SEGMENT_GAP));

    // Header labels
    ctx.font = "9px 'Share Tech Mono', monospace";
    for (let ch = 0; ch < 8; ch++) {
      ctx.fillStyle = muteState.fm[ch] ? COLORS.labelMuted : COLORS.label;
      ctx.fillText(`${ch + 1}`, startX + ch * (barWidth + barGap) + barWidth / 2 - 3, 11);
    }

    // FM channels
    for (let ch = 0; ch < 8; ch++) {
      const x = startX + ch * (barWidth + barGap);
      const isMuted = muteState.fm[ch];

      let volume = 0;
      let currentKeyOn = false;
      let logicalSumOfKeyOn = false;

      if (channelData?.fm[ch] && !isMuted) {
        const fmCh = channelData.fm[ch];
        volume = normalizeVolume(fmCh.volume);
        currentKeyOn = fmCh.keyOn;
        logicalSumOfKeyOn = fmCh.logicalSumOfKeyOn;
      }

      // Update levels (simple_mdx_player style)
      if (!currentKeyOn) {
        keyOffLevelRef.current[ch] = Math.floor(keyOffLevelRef.current[ch] * 127 / 128);
      }
      if (logicalSumOfKeyOn) {
        keyOnLevelRef.current[ch] = volume;
        keyOffLevelRef.current[ch] = volume;
      }
      keyOnLevelRef.current[ch] = Math.floor(keyOnLevelRef.current[ch] * 31 / 32);

      // Draw grid
      ctx.fillStyle = isMuted ? COLORS.gridMuted : COLORS.grid;
      for (let s = 0; s < totalSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (SEGMENT_HEIGHT + SEGMENT_GAP);
        ctx.fillRect(x, segY, barWidth, SEGMENT_HEIGHT);
      }

      // Layer 1: KeyOff level (暗: slow decay)
      const keyOffSegments = Math.floor((keyOffLevelRef.current[ch] / 255) * totalSegments);
      for (let s = 0; s < keyOffSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (SEGMENT_HEIGHT + SEGMENT_GAP);
        const ratio = s / totalSegments;
        if (isMuted) {
          ctx.fillStyle = ratio > 0.8 ? COLORS.barHighMuted : ratio > 0.5 ? COLORS.barMidMuted : COLORS.barLowMuted;
        } else {
          // Dimmed version for keyOff layer
          ctx.fillStyle = ratio > 0.8 ? '#406080' : ratio > 0.5 ? '#305060' : '#203040';
        }
        ctx.fillRect(x, segY, barWidth, SEGMENT_HEIGHT);
      }

      // Layer 2: KeyOn level (明: fast decay)
      const keyOnSegments = Math.floor((keyOnLevelRef.current[ch] / 255) * totalSegments);
      for (let s = 0; s < keyOnSegments; s++) {
        const segY = barTop + maxBarHeight - (s + 1) * (SEGMENT_HEIGHT + SEGMENT_GAP);
        const ratio = s / totalSegments;
        if (isMuted) {
          ctx.fillStyle = ratio > 0.8 ? COLORS.barHighMuted : ratio > 0.5 ? COLORS.barMidMuted : COLORS.barLowMuted;
        } else {
          ctx.fillStyle = ratio > 0.8 ? COLORS.barHigh : ratio > 0.5 ? COLORS.barMid : COLORS.barLow;
        }
        ctx.fillRect(x, segY, barWidth, SEGMENT_HEIGHT);
      }

      // Peak hold
      const currentMax = Math.max(keyOnLevelRef.current[ch], keyOffLevelRef.current[ch]);
      if (currentMax > peakHoldRef.current[ch]) {
        peakHoldRef.current[ch] = currentMax;
        peakDecayRef.current[ch] = 30;
      } else if (peakDecayRef.current[ch] > 0) {
        peakDecayRef.current[ch]--;
      } else {
        peakHoldRef.current[ch] = Math.max(0, peakHoldRef.current[ch] - 4);
      }

      if (peakHoldRef.current[ch] > 0) {
        const peakSegment = Math.floor((peakHoldRef.current[ch] / 255) * totalSegments);
        if (peakSegment > 0) {
          const peakY = barTop + maxBarHeight - peakSegment * (SEGMENT_HEIGHT + SEGMENT_GAP);
          ctx.fillStyle = isMuted ? COLORS.peakMuted : COLORS.peak;
          ctx.fillRect(x, peakY, barWidth, SEGMENT_HEIGHT);
        }
      }
    }

    // PAN footer
    const panY = height - footerHeight + 5;
    ctx.fillStyle = COLORS.textDim;
    ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.fillText('PAN', 2, panY + 6);

    for (let ch = 0; ch < 8; ch++) {
      const x = startX + ch * (barWidth + barGap);
      const indicatorWidth = barWidth / 2 - 1;

      // Get PAN from OPM register
      const panFlCon = channelData?.opmRegs?.[0x20 + ch] || 0;
      const panR = (panFlCon >> 7) & 1;
      const panL = (panFlCon >> 6) & 1;

      ctx.fillStyle = panL ? COLORS.panL : COLORS.panOff;
      ctx.fillRect(x, panY, indicatorWidth, 10);

      ctx.fillStyle = panR ? COLORS.panR : COLORS.panOff;
      ctx.fillRect(x + indicatorWidth + 2, panY, indicatorWidth, 10);

      ctx.fillStyle = COLORS.textDim;
      ctx.font = "7px 'Share Tech Mono', monospace";
      ctx.fillText('L', x + 3, panY + 8);
      ctx.fillText('R', x + indicatorWidth + 5, panY + 8);
    }
  }, [channelData, muteState, normalizeVolume]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={120}
      className="block w-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
