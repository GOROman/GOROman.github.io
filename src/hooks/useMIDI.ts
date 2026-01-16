import { useState, useEffect, useCallback, useRef } from 'react';
import type { MidiKeyState } from '@/lib/types';

interface MIDIInput {
  id: string;
  name: string;
  manufacturer: string;
}

interface MidiState {
  midiChannelActive: number;
  midiKeyState: MidiKeyState[];
}

interface UseMIDIReturn {
  isSupported: boolean;
  inputs: MIDIInput[];
  selectedInputId: string;
  selectInput: (id: string) => void;
  isActive: boolean;
  midiState: MidiState;
  resetMidiState: () => void;
}

export function useMIDI(synthNodeRef: React.RefObject<AudioWorkletNode | null>): UseMIDIReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [inputs, setInputs] = useState<MIDIInput[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [midiState, setMidiState] = useState<MidiState>({
    midiChannelActive: 0,
    midiKeyState: Array(8).fill(null).map(() => ({ keyOn: false, note: 0 })),
  });
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const selectedInputRef = useRef<MIDIInput | null>(null);
  const labelTimeoutRef = useRef<number | null>(null);

  // Handle MIDI message
  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 1) return;

    // Console log
    const hex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`MIDI In: ${hex}`);

    // Flash active indicator
    setIsActive(true);
    if (labelTimeoutRef.current) {
      clearTimeout(labelTimeoutRef.current);
    }
    labelTimeoutRef.current = window.setTimeout(() => {
      setIsActive(false);
    }, 100);

    // Parse MIDI message
    const status = data[0];
    const command = status & 0xf0;
    const channel = status & 0x0f;
    const data1 = data.length > 1 ? data[1] : 0;
    const data2 = data.length > 2 ? data[2] : 0;

    // Forward Note On/Off to synth and update local state
    const fmCh = channel % 8;

    if (command === 0x90 && data2 > 0) {
      // Note On (velocity > 0)

      // Update local MIDI state immediately for display
      setMidiState((prev) => {
        const newKeyState = [...prev.midiKeyState];
        newKeyState[fmCh] = { keyOn: true, note: data1 };
        return {
          midiChannelActive: prev.midiChannelActive | (1 << fmCh),
          midiKeyState: newKeyState,
        };
      });

      if (synthNodeRef.current) {
        synthNodeRef.current.port.postMessage(
          JSON.stringify({
            type: 'MIDI_KEY_ON',
            midiChannel: channel,
            note: data1,
          })
        );
      }
    } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
      // Note Off or Note On with velocity 0
      // Only update if note matches
      setMidiState((prev) => {
        if (prev.midiKeyState[fmCh].note !== data1) {
          return prev;
        }
        const newKeyState = [...prev.midiKeyState];
        newKeyState[fmCh] = { keyOn: false, note: data1 };
        return {
          ...prev,
          midiKeyState: newKeyState,
        };
      });

      if (synthNodeRef.current) {
        synthNodeRef.current.port.postMessage(
          JSON.stringify({
            type: 'MIDI_KEY_OFF',
            midiChannel: channel,
            note: data1,
          })
        );
      }
    }
  }, [synthNodeRef]);

  // Update input list
  const updateInputList = useCallback(() => {
    if (!midiAccessRef.current) return;

    const inputList: MIDIInput[] = [];
    midiAccessRef.current.inputs.forEach((input) => {
      inputList.push({
        id: input.id,
        name: input.name || 'Unknown',
        manufacturer: input.manufacturer || 'Unknown',
      });
    });
    setInputs(inputList);
  }, []);

  // Select input
  const selectInput = useCallback((id: string) => {
    if (!midiAccessRef.current) return;

    // Remove listener from previous input
    if (selectedInputRef.current && midiAccessRef.current) {
      const prevInput = midiAccessRef.current.inputs.get(selectedInputRef.current.id);
      if (prevInput) {
        prevInput.onmidimessage = null;
      }
    }

    setSelectedInputId(id);

    if (!id) {
      selectedInputRef.current = null;
      return;
    }

    const input = midiAccessRef.current.inputs.get(id);
    if (input) {
      input.onmidimessage = handleMIDIMessage;
      selectedInputRef.current = {
        id: input.id,
        name: input.name || 'Unknown',
        manufacturer: input.manufacturer || 'Unknown',
      };
      console.log(`MIDI Input selected: ${input.name}`);
    }
  }, [handleMIDIMessage]);

  // Initialize MIDI
  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    navigator.requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccessRef.current = access;
        updateInputList();

        // Handle state changes
        access.onstatechange = () => {
          updateInputList();
        };
      })
      .catch((err) => {
        console.error('MIDI access denied:', err);
        setIsSupported(false);
      });

    return () => {
      if (labelTimeoutRef.current) {
        clearTimeout(labelTimeoutRef.current);
      }
    };
  }, [updateInputList]);

  // 最初に見つけたデバイスを自動選択
  useEffect(() => {
    if (inputs.length > 0 && !selectedInputId) {
      selectInput(inputs[0].id);
    }
  }, [inputs, selectedInputId, selectInput]);

  // Reset MIDI state
  const resetMidiState = useCallback(() => {
    setMidiState({
      midiChannelActive: 0,
      midiKeyState: Array(8).fill(null).map(() => ({ keyOn: false, note: 0 })),
    });
  }, []);

  return {
    isSupported,
    inputs,
    selectedInputId,
    selectInput,
    isActive,
    midiState,
    resetMidiState,
  };
}
