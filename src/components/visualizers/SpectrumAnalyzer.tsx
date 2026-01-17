import { useRef, useEffect, useCallback } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

const COLORS = {
  bg: '#000008',
  barLow: '#2060a0',
  barMid: '#40a0ff',
  barHigh: '#80ffff',
  peak: '#ffffff',
  grid: '#101830',
};

export function SpectrumAnalyzer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const peakHoldRef = useRef<number[]>(Array(64).fill(0));
  const peakDecayRef = useRef<number[]>(Array(64).fill(0));
  const { audioContextRef, synthNodeRef, playerState, isReady } = useMDXPlayer();

  useEffect(() => {
    const audioContext = audioContextRef.current;
    const synthNode = synthNodeRef.current;

    if (!audioContext || !synthNode) return;
    if (analyserRef.current) return; // Already initialized

    // Create analyser node
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    // Connect synth -> analyser -> destination
    synthNode.disconnect();
    synthNode.connect(analyser);
    analyser.connect(audioContext.destination);

    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    return () => {
      if (analyserRef.current) {
        synthNode.disconnect();
        synthNode.connect(audioContext.destination);
        analyserRef.current = null;
      }
    };
  }, [audioContextRef, synthNodeRef, isReady]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    if (!canvas || !analyser || !dataArray) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analyser.getByteFrequencyData(dataArray);

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw bars (same as original)
    const barCount = 48;
    const barWidth = 4;
    const barGap = 2;
    const startX = (width - barCount * (barWidth + barGap)) / 2;
    const maxHeight = height - 10;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * dataArray.length);
      const value = dataArray[dataIndex];
      const barHeight = (value / 255) * maxHeight;
      const x = startX + i * (barWidth + barGap);

      // Update peak hold
      if (value > peakHoldRef.current[i]) {
        peakHoldRef.current[i] = value;
        peakDecayRef.current[i] = 15; // Hold for 15 frames
      } else if (peakDecayRef.current[i] > 0) {
        peakDecayRef.current[i]--;
      } else {
        peakHoldRef.current[i] = Math.max(0, peakHoldRef.current[i] - 4);
      }

      // Draw segmented bar
      if (barHeight > 0) {
        const segments = Math.ceil(barHeight / 4);
        for (let s = 0; s < segments; s++) {
          const segY = height - 5 - (s + 1) * 4;
          const ratio = s / (maxHeight / 4);
          if (ratio > 0.75) {
            ctx.fillStyle = COLORS.barHigh;
          } else if (ratio > 0.4) {
            ctx.fillStyle = COLORS.barMid;
          } else {
            ctx.fillStyle = COLORS.barLow;
          }
          ctx.fillRect(x, segY, barWidth, 3);
        }
      }

      // Draw peak
      if (peakHoldRef.current[i] > 0) {
        const peakY = height - 5 - (peakHoldRef.current[i] / 255) * maxHeight;
        ctx.fillStyle = COLORS.peak;
        ctx.fillRect(x, peakY - 1, barWidth, 2);
      }
    }

    if (playerState === 'playing') {
      animationIdRef.current = requestAnimationFrame(render);
    }
  }, [playerState]);

  useEffect(() => {
    if (playerState === 'playing') {
      render();
    } else {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [playerState, render]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={100}
      className="block w-full"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
