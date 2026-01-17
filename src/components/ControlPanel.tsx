import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

export function ControlPanel() {
  const { playerState, play, pause, stop, fadeout, playbackInfo } = useMDXPlayer();

  const isInitial = playerState === 'stopped' && playbackInfo.time === '00:00';

  return (
    <div>
      {/* Control Buttons */}
      <div className="flex flex-wrap gap-2 p-3">
        <button
          onClick={play}
          className={`mmdsp-btn ${playerState === 'playing' ? 'active' : ''} ${isInitial ? 'blink' : ''}`}
        >
          PLAY
        </button>
        <button
          onClick={pause}
          className={`mmdsp-btn ${playerState === 'paused' ? 'active' : ''}`}
        >
          PAUSE
        </button>
        <button
          onClick={stop}
          className="mmdsp-btn"
        >
          STOP
        </button>
        <button
          onClick={fadeout}
          className="mmdsp-btn"
        >
          FADE
        </button>
      </div>

      {/* Info Display */}
      <div className="flex gap-5 px-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="mmdsp-info-label">TIME</span>
          <span className="mmdsp-info-value tabular-nums">{playbackInfo.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mmdsp-info-label">LOOP</span>
          <span className="mmdsp-info-value tabular-nums">
            {String(playbackInfo.loopCount).padStart(2, '0')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mmdsp-info-label">TEMPO</span>
          <span className="mmdsp-info-value tabular-nums">
            {String(playbackInfo.tempo).padStart(3, '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
