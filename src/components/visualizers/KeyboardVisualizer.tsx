import { useRef, useEffect, useCallback } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';
import { VISUALIZER_COLORS, NUM_FM_CHANNELS, NUM_PCM_CHANNELS, NUM_OCTAVES } from '@/lib/constants';

const CHANNEL_HEIGHT = 22;
const LABEL_WIDTH = 32;

// PCMチャンネル用の色（チャンネルごとに異なる色）
const PCM_CHANNEL_COLORS = [
  '#40ff40', // P1 - 緑
  '#00ff80', // P2 - シアングリーン
  '#00ffff', // P3 - シアン
  '#80ff00', // P4 - ライム
  '#ffff00', // P5 - 黄色
  '#ff8000', // P6 - オレンジ
  '#ff00ff', // P7 - マゼンタ
  '#8080ff', // P8 - 紫
];

export function KeyboardVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { channelData, muteState, toggleMute, midiState } = useMDXPlayer();

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
      isMuted: boolean,
      isMidi: boolean = false
    ) => {
      const octaveWidth = width / NUM_OCTAVES;
      const whiteKeyWidth = octaveWidth / 7;

      const mutedWhiteKey = '#181830';
      const mutedBlackKey = '#080818';
      const mutedBorder = '#202040';

      // MIDI mode colors (yellow-tinted keyboard)
      const midiWhiteKey = '#404020';
      const midiBlackKey = '#202010';
      const midiBorder = '#606030';
      const midiActiveKey = '#ffff80';

      // Background
      ctx.fillStyle = VISUALIZER_COLORS.bg;
      ctx.fillRect(x, y, width, height);

      // Draw white keys
      for (let oct = 0; oct < NUM_OCTAVES; oct++) {
        for (let wk = 0; wk < 7; wk++) {
          const kx = x + oct * octaveWidth + wk * whiteKeyWidth;
          const noteInOctave = [0, 2, 4, 5, 7, 9, 11][wk];
          const currentKeyIndex = oct * 12 + noteInOctave;
          const isActive = activeKey === currentKeyIndex;

          if (isActive) {
            if (isMidi) {
              ctx.fillStyle = midiActiveKey;
            } else {
              const brightness = Math.min(255, 180 + Math.floor((volume / 255) * 75));
              if (isPcm) {
                ctx.fillStyle = `rgb(${brightness}, 255, ${brightness})`;
              } else {
                ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`;
              }
            }
          } else if (isMidi) {
            ctx.fillStyle = midiWhiteKey;
          } else if (isMuted) {
            ctx.fillStyle = mutedWhiteKey;
          } else {
            ctx.fillStyle = VISUALIZER_COLORS.whiteKey;
          }

          ctx.fillRect(kx, y, whiteKeyWidth - 1, height);
          ctx.strokeStyle = isMidi ? midiBorder : (isMuted ? mutedBorder : VISUALIZER_COLORS.keyBorder);
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
          const isActive = activeKey === currentKeyIndex;

          if (isActive) {
            if (isMidi) {
              ctx.fillStyle = midiActiveKey;
            } else {
              const brightness = Math.min(255, 180 + Math.floor((volume / 255) * 75));
              if (isPcm) {
                ctx.fillStyle = `rgb(${brightness}, 255, ${brightness})`;
              } else {
                ctx.fillStyle = `rgb(${brightness}, ${brightness}, 255)`;
              }
            }
          } else if (isMidi) {
            ctx.fillStyle = midiBlackKey;
          } else if (isMuted) {
            ctx.fillStyle = mutedBlackKey;
          } else {
            ctx.fillStyle = VISUALIZER_COLORS.blackKey;
          }

          ctx.fillRect(kx, y, blackKeyWidth, blackKeyHeight);
        }
      }
    },
    []
  );

  // PCM用: 複数チャンネルのアクティブキーを1つのキーボードに描画
  const drawKeyboardMultiChannel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      activeKeys: { key: number; volume: number; color: string; muted: boolean }[]
    ) => {
      const octaveWidth = width / NUM_OCTAVES;
      const whiteKeyWidth = octaveWidth / 7;

      // Background
      ctx.fillStyle = VISUALIZER_COLORS.bg;
      ctx.fillRect(x, y, width, height);

      // アクティブな白鍵を収集
      const activeWhiteKeys = new Map<number, { color: string; volume: number }>();
      // アクティブな黒鍵を収集
      const activeBlackKeys = new Map<number, { color: string; volume: number }>();

      for (const ak of activeKeys) {
        if (ak.key < 0 || ak.muted) continue;
        const noteInOct = ak.key % 12;
        const isBlack = [1, 3, 6, 8, 10].includes(noteInOct);

        if (isBlack) {
          if (!activeBlackKeys.has(ak.key) || activeBlackKeys.get(ak.key)!.volume < ak.volume) {
            activeBlackKeys.set(ak.key, { color: ak.color, volume: ak.volume });
          }
        } else {
          if (!activeWhiteKeys.has(ak.key) || activeWhiteKeys.get(ak.key)!.volume < ak.volume) {
            activeWhiteKeys.set(ak.key, { color: ak.color, volume: ak.volume });
          }
        }
      }

      // Draw white keys
      for (let oct = 0; oct < NUM_OCTAVES; oct++) {
        for (let wk = 0; wk < 7; wk++) {
          const kx = x + oct * octaveWidth + wk * whiteKeyWidth;
          const noteInOctave = [0, 2, 4, 5, 7, 9, 11][wk];
          const currentKeyIndex = oct * 12 + noteInOctave;
          const activeInfo = activeWhiteKeys.get(currentKeyIndex);

          if (activeInfo) {
            ctx.fillStyle = activeInfo.color;
          } else {
            ctx.fillStyle = VISUALIZER_COLORS.whiteKey;
          }

          ctx.fillRect(kx, y, whiteKeyWidth - 1, height);
          ctx.strokeStyle = VISUALIZER_COLORS.keyBorder;
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
          const activeInfo = activeBlackKeys.get(currentKeyIndex);

          if (activeInfo) {
            ctx.fillStyle = activeInfo.color;
          } else {
            ctx.fillStyle = VISUALIZER_COLORS.blackKey;
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

      // Check if this channel is MIDI-controlled
      const isMidiActive = (midiState.midiChannelActive & (1 << ch)) !== 0;
      const midiKeyState = midiState.midiKeyState[ch];

      // Label (yellow if MIDI, dimmed if muted)
      if (isMidiActive) {
        ctx.fillStyle = VISUALIZER_COLORS.textMidi; // Yellow for MIDI
      } else if (isMuted) {
        ctx.fillStyle = VISUALIZER_COLORS.textDim;
      } else {
        ctx.fillStyle = VISUALIZER_COLORS.text;
      }
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(`FM${ch + 1}`, 2, y + 15);

      // Keyboard - MIDI takes priority
      let activeKey = -1;
      let volume = 0;
      let isMidi = false;

      if (isMidiActive && midiKeyState) {
        // MIDI mode
        isMidi = true;
        if (midiKeyState.keyOn) {
          activeKey = Math.max(0, Math.min(95, midiKeyState.note));
          volume = 255;
        }
      } else if (channelData?.fm[ch]) {
        const fmCh = channelData.fm[ch];
        if (fmCh.keyOn || fmCh.logicalSumOfKeyOn) {
          activeKey = noteToKeyIndex(fmCh.note);
          volume = fmCh.volume & 0x80 ? (0x7f - (fmCh.volume & 0x7f)) * 2 : (fmCh.volume & 0xf) * 0x11;
        }
      }

      drawKeyboard(ctx, keyboardStartX, y, keyboardWidth, CHANNEL_HEIGHT - 2, activeKey, volume, false, isMuted, isMidi);
    }

    // PCM Channels - 1つのキーボードにまとめて表示
    const pcmStartY = NUM_FM_CHANNELS * CHANNEL_HEIGHT + 4;

    // Label
    ctx.fillStyle = VISUALIZER_COLORS.text;
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillText('PCM', 2, pcmStartY + 15);

    // 全PCMチャンネルのアクティブキーを収集
    const activeKeys: { key: number; volume: number; color: string; muted: boolean }[] = [];
    for (let ch = 0; ch < NUM_PCM_CHANNELS; ch++) {
      if (channelData?.pcm[ch]) {
        const pcmCh = channelData.pcm[ch];
        if (pcmCh.keyOn) {
          activeKeys.push({
            key: noteToKeyIndex(pcmCh.note),
            volume: pcmCh.volume,
            color: PCM_CHANNEL_COLORS[ch],
            muted: muteState.pcm[ch],
          });
        }
      }
    }

    drawKeyboardMultiChannel(ctx, keyboardStartX, pcmStartY, keyboardWidth, CHANNEL_HEIGHT - 2, activeKeys);
  }, [channelData, muteState, midiState, drawKeyboard, drawKeyboardMultiChannel, noteToKeyIndex]);

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

      // Check PCM (1行にまとめたので、クリックで全PCMチャンネルをトグル)
      const pcmStartY = NUM_FM_CHANNELS * CHANNEL_HEIGHT + 4;
      if (canvasY >= pcmStartY && canvasY < pcmStartY + CHANNEL_HEIGHT) {
        for (let ch = 0; ch < NUM_PCM_CHANNELS; ch++) {
          toggleMute('pcm', ch);
        }
        return;
      }
    },
    [toggleMute]
  );

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        width={500}
        height={210}
        onClick={handleClick}
        className="w-full cursor-pointer"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
