import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type {
  PlayerState,
  ChannelData,
  MuteState,
  PlaybackInfo,
  MidiKeyState,
} from '@/lib/types';
import { SAMPLE_RATE } from '@/lib/constants';
import { useMIDI } from '@/hooks/useMIDI';

interface MidiState {
  midiChannelActive: number;
  midiKeyState: MidiKeyState[];
}

interface MDXPlayerContextValue {
  // State
  playerState: PlayerState;
  channelData: ChannelData | null;
  muteState: MuteState;
  playbackInfo: PlaybackInfo;
  isReady: boolean;
  midiState: MidiState;

  // Actions
  initialize: () => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  fadeout: () => void;
  loadMDX: (filename: string, data: ArrayBuffer) => void;
  loadPDX: (filename: string, data: ArrayBuffer) => void;
  toggleMute: (type: 'fm' | 'pcm', channel: number) => void;

  // Refs for visualizers
  synthNodeRef: React.RefObject<AudioWorkletNode | null>;
  audioContextRef: React.RefObject<AudioContext | null>;
}

const MDXPlayerContext = createContext<MDXPlayerContextValue | null>(null);

export function MDXPlayerProvider({ children }: { children: ReactNode }) {
  const [playerState, setPlayerState] = useState<PlayerState>('stopped');
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [muteState, setMuteState] = useState<MuteState>({
    fm: Array(8).fill(false),
    pcm: Array(8).fill(false),
  });
  const [playbackInfo, setPlaybackInfo] = useState<PlaybackInfo>({
    time: '00:00',
    loopCount: 0,
    tempo: 0,
    title: '',
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const synthNodeRef = useRef<AudioWorkletNode | null>(null);
  const animationIdRef = useRef<number | null>(null);

  // MIDI
  const { midiState, resetMidiState } = useMIDI(synthNodeRef);

  const updatePlaybackInfo = useCallback((data: ChannelData) => {
    const playTimeMs = (data.playTime * 1024) / 4000;
    const seconds = Math.floor(playTimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const time = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    let title = '';
    if (data.titleBytes && data.titleBytes.length > 0) {
      try {
        const decoder = new TextDecoder('shift-jis');
        title = decoder.decode(new Uint8Array(data.titleBytes));
      } catch {
        // ignore decode errors
      }
    }

    setPlaybackInfo({
      time,
      loopCount: data.loopCount || 0,
      tempo: data.tempo || 0,
      title,
    });
  }, []);

  const initialize = useCallback(async () => {
    if (audioContextRef.current) return;

    const context = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: SAMPLE_RATE,
    });
    audioContextRef.current = context;

    await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}mdx.wasm.js`);
    const synthNode = new AudioWorkletNode(context, 'wasm-synth', {
      outputChannelCount: [2],
    });
    synthNodeRef.current = synthNode;

    synthNode.connect(context.destination);

    synthNode.port.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CHANNEL') {
          setChannelData(data);
          updatePlaybackInfo(data);
        } else if (data.type === 'TITLE') {
          if (data.titleBytes && data.titleBytes.length > 0) {
            try {
              const decoder = new TextDecoder('shift-jis');
              const title = decoder.decode(new Uint8Array(data.titleBytes));
              setPlaybackInfo((prev) => ({ ...prev, title }));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    // Request initial title
    synthNode.port.postMessage('GET_TITLE');

    // Suspend until play
    await context.suspend();
    setIsReady(true);
  }, [updatePlaybackInfo]);

  const startRenderLoop = useCallback(() => {
    const render = () => {
      if (synthNodeRef.current && playerState === 'playing') {
        synthNodeRef.current.port.postMessage('CHANNEL');
      }
      animationIdRef.current = requestAnimationFrame(render);
    };
    render();
  }, [playerState]);

  const stopRenderLoop = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (playerState === 'playing') {
      startRenderLoop();
    }
    return () => stopRenderLoop();
  }, [playerState, startRenderLoop, stopRenderLoop]);

  const play = useCallback(async () => {
    // Initialize if not ready (for iOS)
    if (!audioContextRef.current || !synthNodeRef.current) {
      await initialize();
    }

    if (!audioContextRef.current || !synthNodeRef.current) return;

    if (playerState === 'stopped') {
      synthNodeRef.current.port.postMessage('REPLAY');

      // Reset all mute states on STOP -> PLAY
      setMuteState({
        fm: Array(8).fill(false),
        pcm: Array(8).fill(false),
      });

      // Reset MIDI state in synth and UI
      synthNodeRef.current.port.postMessage(JSON.stringify({ type: 'RESET_MIDI' }));
      resetMidiState();
    }

    audioContextRef.current.resume();
    setPlayerState('playing');
  }, [playerState, resetMidiState, initialize]);

  const pause = useCallback(() => {
    if (!audioContextRef.current) return;

    if (playerState === 'playing') {
      audioContextRef.current.suspend();
      setPlayerState('paused');
    } else if (playerState === 'paused') {
      audioContextRef.current.resume();
      setPlayerState('playing');
    }
  }, [playerState]);

  const stop = useCallback(() => {
    if (!synthNodeRef.current) return;

    synthNodeRef.current.port.postMessage('STOP');
    setPlayerState('stopped');
  }, []);

  const fadeout = useCallback(() => {
    if (!synthNodeRef.current) return;

    synthNodeRef.current.port.postMessage('FADEOUT');
  }, []);

  const loadMDX = useCallback((filename: string, data: ArrayBuffer) => {
    if (!synthNodeRef.current) return;

    synthNodeRef.current.port.postMessage('MDX');
    synthNodeRef.current.port.postMessage(data);
    synthNodeRef.current.port.postMessage('GET_TITLE');

    setPlaybackInfo((prev) => ({
      ...prev,
      title: filename.replace(/\.mdx$/i, ''),
    }));
  }, []);

  const loadPDX = useCallback((filename: string, data: ArrayBuffer) => {
    if (!synthNodeRef.current) return;

    synthNodeRef.current.port.postMessage(filename);
    synthNodeRef.current.port.postMessage(data);
  }, []);

  const toggleMute = useCallback(
    (type: 'fm' | 'pcm', channel: number) => {
      setMuteState((prev) => {
        const newState = { ...prev };
        if (type === 'fm') {
          newState.fm = [...prev.fm];
          newState.fm[channel] = !prev.fm[channel];
        } else {
          newState.pcm = [...prev.pcm];
          newState.pcm[channel] = !prev.pcm[channel];
        }

        // Send mute state to synth
        if (synthNodeRef.current) {
          synthNodeRef.current.port.postMessage(
            JSON.stringify({
              type: 'MUTE',
              channelType: type,
              channel,
              muted: type === 'fm' ? newState.fm[channel] : newState.pcm[channel],
            })
          );
        }

        // Log mute state
        const chName = type === 'fm' ? `FM${channel + 1}` : `PCM${channel + 1}`;
        const muted = type === 'fm' ? newState.fm[channel] : newState.pcm[channel];
        console.log(`${chName} ${muted ? 'MUTED' : 'UNMUTED'}`);

        return newState;
      });
    },
    []
  );

  // Keyboard shortcuts: 1-8 for FM, 9 for PCM1
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key;
      if (key >= '1' && key <= '8') {
        // FM channels 1-8
        const channel = parseInt(key) - 1;
        toggleMute('fm', channel);
      } else if (key === '9') {
        // PCM channel 1
        toggleMute('pcm', 0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleMute]);

  return (
    <MDXPlayerContext.Provider
      value={{
        playerState,
        channelData,
        muteState,
        playbackInfo,
        isReady,
        midiState,
        initialize,
        play,
        pause,
        stop,
        fadeout,
        loadMDX,
        loadPDX,
        toggleMute,
        synthNodeRef,
        audioContextRef,
      }}
    >
      {children}
    </MDXPlayerContext.Provider>
  );
}

export function useMDXPlayer() {
  const context = useContext(MDXPlayerContext);
  if (!context) {
    throw new Error('useMDXPlayer must be used within MDXPlayerProvider');
  }
  return context;
}
