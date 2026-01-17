import { useEffect, useState } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';
import { Header } from './Header';
import { ControlPanel } from './ControlPanel';
import { DropZone } from './DropZone';
import { Credit } from './Credit';
import { KeyboardVisualizer } from './visualizers/KeyboardVisualizer';
import { LevelMeter } from './visualizers/LevelMeter';
import { SpectrumAnalyzer } from './visualizers/SpectrumAnalyzer';
import { OPMRegisterDisplay } from './visualizers/OPMRegisterDisplay';

export function MDXPlayer() {
  const { playbackInfo } = useMDXPlayer();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  return (
    <div className="flex flex-col items-center">
      <div className="mmdsp-container">
        <Header />

        {/* Main Content */}
        <div className="flex flex-col gap-[10px] p-[10px]" id="mmdsp-main">
          {/* Top Panel: Keyboard + OPM Register */}
          <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-[10px]`} id="top-panel">
            <div className="mmdsp-panel flex-1" id="keyboard-panel">
              <div className="mmdsp-keyboard-header">
                KEYBOARD (FM1-8 / ADPCM1-8)
              </div>
              <KeyboardVisualizer />
            </div>

            {!isMobile && (
              <div className="mmdsp-panel" id="opm-register-panel">
                <div className="mmdsp-panel-header">YM2151(OPM) REGISTER</div>
                <OPMRegisterDisplay />
              </div>
            )}
          </div>

          {/* Bottom Panel - Desktop */}
          {!isMobile && (
            <div className="flex flex-row gap-[10px]" id="bottom-panel">
              {/* Control Panel */}
              <div className="mmdsp-panel" id="control-panel" style={{ flex: '1' }}>
                <div className="mmdsp-panel-header">CONTROL</div>
                <ControlPanel />
              </div>

              {/* Spectrum Panel */}
              <div className="mmdsp-panel" id="spectrum-panel" style={{ flex: '1' }}>
                <div className="mmdsp-panel-header">SPECTRUM</div>
                <SpectrumAnalyzer />
              </div>

              {/* Level Panel */}
              <div className="mmdsp-panel" id="level-panel" style={{ flex: '1' }}>
                <div className="mmdsp-panel-header">LEVEL</div>
                <LevelMeter />
              </div>
            </div>
          )}

          {/* Mobile: Spectrum + Level side by side */}
          {isMobile && (
            <div className="flex flex-row gap-[10px]">
              <div className="mmdsp-panel flex-1" id="spectrum-panel">
                <div className="mmdsp-panel-header">SPECTRUM</div>
                <SpectrumAnalyzer />
              </div>
              <div className="mmdsp-panel flex-1" id="level-panel">
                <div className="mmdsp-panel-header">LEVEL</div>
                <LevelMeter />
              </div>
            </div>
          )}

          {/* Mobile: Control Panel at bottom */}
          {isMobile && (
            <div className="mmdsp-panel" id="control-panel">
              <div className="mmdsp-panel-header">CONTROL</div>
              <ControlPanel />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mmdsp-footer" id="mmdsp-footer">
          {/* Title */}
          <div className="mb-2 overflow-hidden" id="now-playing">
            <span className="mmdsp-title-text block truncate" id="title">
              {playbackInfo.title || '---'}
            </span>
          </div>

          {/* File Info */}
          {!isMobile && (
            <div className="flex gap-5 text-[10px] text-[#303080] mb-2" id="file-info">
              <span>MDX: <span className="text-[#6060c0]" id="mdxfile">-</span></span>
              <span>PDX: <span className="text-[#6060c0]" id="pdxfile">-</span></span>
            </div>
          )}

          {/* Drop Zone */}
          <DropZone />
        </div>
      </div>

      {/* Credit */}
      <Credit />
    </div>
  );
}
