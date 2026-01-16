import { useRef, useEffect, useCallback } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';
import { VISUALIZER_COLORS, NUM_FM_CHANNELS, NUM_PCM_CHANNELS, NUM_OCTAVES } from '@/lib/constants';

const CHANNEL_HEIGHT = 22;
const LABEL_WIDTH = 32;

export function KeyboardVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { channelData, muteState, toggleMute } = useMDXPlayer();

  const noteToKeyIndex = useCallback((note: number) => {
    return Math.floor((note + 27) / 64);
  }, []);

  const drawKeyboard = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      activeKey: number,
      volume: number,
      isPcm: boolean,
      isMuted: boolean
    ) => {
      const octaveWidth = width / NUM_OCTAVES;
      const whiteKeyWidth = octaveWidth / 7;

      const mutedWhiteKey = '#181830';
      const mutedBlackKey = '#080818';
      const mutedBorder = '#202040';

      // Background
      ctx.fillStyle = VISUALIZER_COLORS.bg;
      ctx.fillRect(x, y, width, height);

      // Draw white keys
      for (let oct = 0; oct < NUM_OCTAVES; oct++) {
        for (let wk = 0; wk < 7; wk++) {
          const kx = x + oct * octaveWidth + wk * whiteKeyWidth;
          const noteInOctave = [0, 2, 4, 5, 7, 9, 11][wk];
          const currentKeyIndex = oct * 12 + noteInOctave;
          const isActive = activeKey === currentKeyIndex && !isMuted;

          if (isActive) {
            const brightness = Math.min(255, 180 + Math.floor((volume / 255) * 75));
            if (isPcm) {
              ctx.fillStyle = `rgb(${brightness}, 255, ${brightness})`;
            } else {
              ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`;
            }
          } else {
            ctx.fillStyle = isMuted ? mutedWhiteKey : VISUALIZER_COLORS.whiteKey;
          }

          ctx.fillRect(kx, y, whiteKeyWidth - 1, height);
          ctx.strokeStyle = isMuted ? mutedBorder : VISUALIZER_COLORS.keyBorder;
          ctx.strokeRect(kx, y, whiteKeyWidth - 1, height);
        }
      }

      // Draw black keys
      const blackKeyWidth = whiteKeyWidth * 0.6;
      const blackKeyHeight = height * 0.6;
      const blackKeyPattern = [1, 1, 0, 1, 1, 1, 0];

      for (let oct = 0; oct < NUM_OCTAVES; oct++) {
        for (let wk = 0; wk < 7; wk++) {
          if (blackKeyPattern[wk] === 0) continue;

          const kx = x + oct * octaveWidth + (wk + 1) * whiteKeyWidth - blackKeyWidth / 2;
          const blackNoteIndices = [1, 3, null, 6, 8, 10, null];
          const noteIndex = blackNoteIndices[wk];
          if (noteIndex === null) continue;

          const currentKeyIndex = oct * 12 + noteIndex;
          const isActive = activeKey === currentKeyIndex && !isMuted;

          if (isActive) {
            const brightness = Math.min(255, 180 + Math.floor((volume / 255) * 75));
            if (isPcm) {
              ctx.fillStyle = `rgb(${brightness}, 255, ${brightness})`;
            } else {
              ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`;
            }
          } else {
            ctx.fillStyle = isMuted ? mutedBlackKey : VISUALIZER_COLORS.blackKey;
          }

          ctx.fillRect(kx, y, blackKeyWidth, blackKeyHeight);
        }
      }
    },
    []
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = VISUALIZER_COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const keyboardStartX = LABEL_WIDTH;
    const keyboardWidth = width - LABEL_WIDTH;

    // FM Channels
    for (let ch = 0; ch < NUM_FM_CHANNELS; ch++) {
      const y = ch * CHANNEL_HEIGHT;
      const isMuted = muteState.fm[ch];

      // Label
      ctx.fillStyle = isMuted ? VISUALIZER_COLORS.textDim : VISUALIZER_COLORS.text;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(`FM${ch + 1}`, 2, y + 15);

      // Keyboard
      let activeKey = -1;
      let volume = 0;

      if (channelData?.fm[ch]) {
        const fmCh = channelData.fm[ch];
        if (fmCh.keyOn || fmCh.logicalSumOfKeyOn) {
          activeKey = noteToKeyIndex(fmCh.note);
          volume = fmCh.volume & 0x80 ? (0x7f - (fmCh.volume & 0x7f)) * 2 : (fmCh.volume & 0xf) * 0x11;
        }
      }

      drawKeyboard(ctx, keyboardStartX, y, keyboardWidth, CHANNEL_HEIGHT - 2, activeKey, volume, false, isMuted);
    }

    // PCM Channels
    const pcmStartY = NUM_FM_CHANNELS * CHANNEL_HEIGHT + 4;
    for (let ch = 0; ch < NUM_PCM_CHANNELS; ch++) {
      const y = pcmStartY + ch * CHANNEL_HEIGHT;
      const isMuted = muteState.pcm[ch];

      // Label
      ctx.fillStyle = isMuted ? VISUALIZER_COLORS.textDim : VISUALIZER_COLORS.text;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(`P${ch + 1}`, 2, y + 15);

      // Keyboard
      let activeKey = -1;
      let volume = 0;

      if (channelData?.pcm[ch]) {
        const pcmCh = channelData.pcm[ch];
        if (pcmCh.keyOn) {
          activeKey = noteToKeyIndex(pcmCh.note);
          volume = pcmCh.volume;
        }
      }

      drawKeyboard(ctx, keyboardStartX, y, keyboardWidth, CHANNEL_HEIGHT - 2, activeKey, volume, true, isMuted);
    }
  }, [channelData, muteState, drawKeyboard, noteToKeyIndex]);

  useEffect(() => {
    render();
  }, [render]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Scale for device pixel ratio
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = x * scaleX;
      const canvasY = y * scaleY;

      if (canvasX > LABEL_WIDTH) return;

      // Check FM channels
      for (let ch = 0; ch < NUM_FM_CHANNELS; ch++) {
        const chY = ch * CHANNEL_HEIGHT;
        if (canvasY >= chY && canvasY < chY + CHANNEL_HEIGHT) {
          toggleMute('fm', ch);
          return;
        }
      }

      // Check PCM channels
      const pcmStartY = NUM_FM_CHANNELS * CHANNEL_HEIGHT + 4;
      for (let ch = 0; ch < NUM_PCM_CHANNELS; ch++) {
        const chY = pcmStartY + ch * CHANNEL_HEIGHT;
        if (canvasY >= chY && canvasY < chY + CHANNEL_HEIGHT) {
          toggleMute('pcm', ch);
          return;
        }
      }
    },
    [toggleMute]
  );

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        width={500}
        height={360}
        onClick={handleClick}
        className="w-full cursor-pointer"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
