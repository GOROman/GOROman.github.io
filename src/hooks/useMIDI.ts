import { useState, useEffect, useCallback, useRef } from 'react';

interface MIDIInput {
  id: string;
  name: string;
  manufacturer: string;
}

interface UseMIDIReturn {
  isSupported: boolean;
  inputs: MIDIInput[];
  selectedInputId: string;
  selectInput: (id: string) => void;
  isActive: boolean;
}

export function useMIDI(synthNodeRef: React.RefObject<AudioWorkletNode | null>): UseMIDIReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [inputs, setInputs] = useState<MIDIInput[]>([]);
  const [selectedInputId, setSelectedInputId] = useState('');
  const [isActive, setIsActive] = useState(false);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const selectedInputRef = useRef<MIDIInput | null>(null);
  const labelTimeoutRef = useRef<number | null>(null);

  // Handle MIDI message
  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    // Flash active indicator
    setIsActive(true);
    if (labelTimeoutRef.current) {
      clearTimeout(labelTimeoutRef.current);
    }
    labelTimeoutRef.current = window.setTimeout(() => {
      setIsActive(false);
    }, 100);

    // Forward to synth
    if (synthNodeRef.current) {
      const data = event.data;
      if (data) {
        synthNodeRef.current.port.postMessage(
          JSON.stringify({
            type: 'MIDI',
            data: Array.from(data),
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

  return {
    isSupported,
    inputs,
    selectedInputId,
    selectInput,
    isActive,
  };
}
