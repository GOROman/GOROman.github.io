import { APP_VERSION } from '@/lib/constants';
import { useMIDI } from '@/hooks/useMIDI';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

export function Header() {
  const { synthNodeRef } = useMDXPlayer();
  const { isSupported, inputs, selectedInputId, selectInput, isActive } = useMIDI(synthNodeRef);

  return (
    <div className="mmdsp-header" id="mmdsp-header">
      <span className="mmdsp-title">
        WASM MDXPlayer <span className="text-[#6060c0] text-[10px]">Powered by Claude Code</span>
      </span>

      {/* MIDI Control */}
      <div className="flex items-center gap-2" id="midi-control">
        <span className={`text-[10px] transition-all ${isActive ? 'text-[#ffff00] drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]' : 'text-[#808000]'}`}>
          MIDI IN:
        </span>
        <select
          id="midi-input-select"
          value={selectedInputId}
          onChange={(e) => selectInput(e.target.value)}
          disabled={!isSupported}
          className="bg-[#101030] text-[#80a0ff] border border-[#404080] px-2 py-0.5 text-[10px] min-w-[180px] cursor-pointer hover:border-[#6060c0] hover:bg-[#181848] focus:outline-none focus:border-[#8080ff] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">-- No Device --</option>
          {inputs.map((input) => (
            <option key={input.id} value={input.id}>
              {input.name} ({input.manufacturer})
            </option>
          ))}
        </select>
      </div>

      <span className="mmdsp-version">v{APP_VERSION}</span>
    </div>
  );
}
