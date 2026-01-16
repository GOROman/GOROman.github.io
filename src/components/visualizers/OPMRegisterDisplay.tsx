import { useRef, useEffect, useCallback } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

const COLORS = {
  bg: '#000010',
  text: '#6080c0',
  textDim: '#304080',
  textBright: '#80c0ff',
  textValue: '#4070b0',
  textChanged: '#e0e0ff',
  headerCol: '#4060a0',
  headerRow: '#4060a0',
  grid: '#101830',
};

export function OPMRegisterDisplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { channelData } = useMDXPlayer();
  const prevRegsRef = useRef<number[]>(Array(256).fill(0));
  const changedRegsRef = useRef<number[]>(Array(256).fill(0));

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const opmRegs = channelData?.opmRegs || [];

    // Update changed registers tracking
    for (let i = 0; i < 256; i++) {
      const currentValue = opmRegs[i] || 0;
      if (currentValue !== prevRegsRef.current[i]) {
        changedRegsRef.current[i] = 10; // Highlight for 10 frames
        prevRegsRef.current[i] = currentValue;
      } else if (changedRegsRef.current[i] > 0) {
        changedRegsRef.current[i]--;
      }
    }

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // Draw registers in 16x16 grid
    const cellWidth = 15;
    const cellHeight = 15;
    const startX = 2;
    const startY = 18;
    const dataStartX = startX + 18;

    // Header row (横)
    ctx.fillStyle = COLORS.headerCol;
    ctx.font = "10px 'Share Tech Mono', monospace";
    for (let col = 0; col < 16; col++) {
      const x = dataStartX + col * cellWidth;
      ctx.fillText(col.toString(16).toUpperCase().padStart(2, '0'), x, 11);
    }

    // Data rows
    for (let row = 0; row < 16; row++) {
      // Row header (縦)
      ctx.fillStyle = COLORS.headerRow;
      ctx.font = "10px 'Share Tech Mono', monospace";
      ctx.fillText(row.toString(16).toUpperCase() + '0', startX, startY + row * cellHeight + 9);

      for (let col = 0; col < 16; col++) {
        const regAddr = row * 16 + col;
        const regValue = opmRegs[regAddr] || 0;
        const x = dataStartX + col * cellWidth;
        const y = startY + row * cellHeight;

        // Highlight changed registers
        if (changedRegsRef.current[regAddr] > 0) {
          ctx.fillStyle = COLORS.textChanged;
        } else {
          ctx.fillStyle = COLORS.textValue;
        }

        ctx.font = "10px 'Share Tech Mono', monospace";
        ctx.fillText(regValue.toString(16).toUpperCase().padStart(2, '0'), x, y + 9);
      }
    }
  }, [channelData]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={262}
      height={260}
      className="block"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
