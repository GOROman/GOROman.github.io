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
  PlaylistItem,
  PlaylistState,
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
  playlist: PlaylistState;

  // Actions
  initialize: () => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  fadeout: () => void;
  loadMDX: (filename: string, data: ArrayBuffer) => void;
  loadPDX: (filename: string, data: ArrayBuffer) => void;
  toggleMute: (type: 'fm' | 'pcm', channel: number) => void;

  // Playlist Actions
  addToPlaylist: (item: PlaylistItem) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  selectPlaylistItem: (index: number) => void;
  playSelectedItem: () => void;
  toggleAutoPlay: () => void;

  // Refs for visualizers
  synthNodeRef: React.RefObject<AudioWorkletNode | null>;
  audioContextRef: React.RefObject<AudioContext | null>;
}

const MDXPlayerContext = createContext<MDXPlayerContextValue | null>(null);

const AUTO_PLAY_LOOP_LIMIT = 2;

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
  const [playlist, setPlaylist] = useState<PlaylistState>({
    items: [],
    currentIndex: -1,
    playingIndex: -1,
    isAutoPlay: true,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const synthNodeRef = useRef<AudioWorkletNode | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const lastLoopCountRef = useRef<number>(0);
  const currentPlayingItemIdRef = useRef<string | null>(null);
  const titleIgnoreUntilRef = useRef<number>(0);

  // Refs for callback functions to avoid circular dependencies
  const playNextItemRef = useRef<() => void>(() => {});

  // MIDI
  const { midiState, resetMidiState } = useMIDI(synthNodeRef);

  // Update playlist item title when received
  const updatePlayingItemTitle = useCallback((title: string) => {
    // Ignore title updates for a short period after song change
    // to avoid stale title from previous song
    if (Date.now() < titleIgnoreUntilRef.current) return;

    const currentItemId = currentPlayingItemIdRef.current;
    if (!currentItemId) return;

    setPlaylist((prev) => {
      // Find item by ID to avoid index mismatch issues
      const index = prev.items.findIndex(item => item.id === currentItemId);
      if (index === -1) return prev;

      const item = prev.items[index];
      if (item.title) return prev; // Already has title

      const newItems = [...prev.items];
      newItems[index] = { ...item, title };
      return { ...prev, items: newItems };
    });
  }, []);

  // Check for auto-play on loop count change
  const checkAutoPlay = useCallback(
    (loopCount: number) => {
      if (
        loopCount >= AUTO_PLAY_LOOP_LIMIT &&
        lastLoopCountRef.current < AUTO_PLAY_LOOP_LIMIT
      ) {
        playNextItemRef.current();
      }
      lastLoopCountRef.current = loopCount;
    },
    []
  );

  const updatePlaybackInfo = useCallback(
    (data: ChannelData) => {
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

      // Update playlist item title
      if (title) {
        updatePlayingItemTitle(title);
      }

      // Check for auto-play
      checkAutoPlay(data.loopCount || 0);
    },
    [updatePlayingItemTitle, checkAutoPlay]
  );

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

    console.log('loadPDX:', filename, 'dataType:', typeof data, 'byteLength:', data?.byteLength);

    synthNodeRef.current.port.postMessage(filename);
    synthNodeRef.current.port.postMessage(data);
  }, []);

  // Playlist Actions
  const addToPlaylist = useCallback((item: PlaylistItem) => {
    setPlaylist((prev) => {
      const newItems = [...prev.items, item];
      return {
        ...prev,
        items: newItems,
        currentIndex: prev.currentIndex === -1 ? 0 : prev.currentIndex,
      };
    });
  }, []);

  const removeFromPlaylist = useCallback((index: number) => {
    setPlaylist((prev) => {
      const newItems = prev.items.filter((_, i) => i !== index);
      let newCurrentIndex = prev.currentIndex;
      let newPlayingIndex = prev.playingIndex;

      if (newCurrentIndex >= newItems.length) {
        newCurrentIndex = newItems.length - 1;
      }
      if (newPlayingIndex >= newItems.length) {
        newPlayingIndex = -1;
      } else if (newPlayingIndex > index) {
        newPlayingIndex--;
      }

      return {
        ...prev,
        items: newItems,
        currentIndex: newCurrentIndex,
        playingIndex: newPlayingIndex,
      };
    });
  }, []);

  const clearPlaylist = useCallback(() => {
    setPlaylist((prev) => ({
      ...prev,
      items: [],
      currentIndex: -1,
      playingIndex: -1,
    }));
  }, []);

  const selectPlaylistItem = useCallback((index: number) => {
    setPlaylist((prev) => ({
      ...prev,
      currentIndex: index >= 0 && index < prev.items.length ? index : prev.currentIndex,
    }));
  }, []);

  const playItem = useCallback(
    async (item: PlaylistItem, index: number) => {
      // Initialize if not ready
      if (!audioContextRef.current || !synthNodeRef.current) {
        await initialize();
      }

      if (!synthNodeRef.current) return;

      // Track current item ID for title validation
      currentPlayingItemIdRef.current = item.id;

      // Ignore stale title updates for 500ms after song change
      titleIgnoreUntilRef.current = Date.now() + 500;

      // Load and play MDX (PDX should already be loaded in WASM from drop time)
      loadMDX(item.mdxFilename, item.mdxData);

      // Reset loop counter
      lastLoopCountRef.current = 0;

      // Update playlist state
      setPlaylist((prev) => ({
        ...prev,
        currentIndex: index,
        playingIndex: index,
      }));

      // Start playing
      if (audioContextRef.current) {
        audioContextRef.current.resume();
        setPlayerState('playing');
      }
    },
    [initialize, loadMDX, loadPDX]
  );

  const playSelectedItem = useCallback(async () => {
    setPlaylist((prev) => {
      if (prev.currentIndex >= 0 && prev.currentIndex < prev.items.length) {
        const item = prev.items[prev.currentIndex];
        // Use setTimeout to avoid state update during render
        setTimeout(() => playItem(item, prev.currentIndex), 0);
      }
      return prev;
    });
  }, [playItem]);

  const toggleAutoPlay = useCallback(() => {
    setPlaylist((prev) => ({
      ...prev,
      isAutoPlay: !prev.isAutoPlay,
    }));
  }, []);

  const playNextItem = useCallback(() => {
    setPlaylist((prev) => {
      if (prev.isAutoPlay && prev.playingIndex < prev.items.length - 1) {
        const nextIndex = prev.playingIndex + 1;
        const nextItem = prev.items[nextIndex];
        setTimeout(() => playItem(nextItem, nextIndex), 0);
      }
      return prev;
    });
  }, [playItem]);

  // Update playNextItemRef when playNextItem changes
  useEffect(() => {
    playNextItemRef.current = playNextItem;
  }, [playNextItem]);

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

  // Load MDX/PDX from URL parameters
  useEffect(() => {
    const loadFromURLParams = async () => {
      const params = new URLSearchParams(window.location.search);
      // Default to ds02.mdx (relative to base URL)
      const mdxUrl = params.get('mdx') || `${import.meta.env.BASE_URL}ds02.mdx`;
      const pdxUrl = params.get('pdx');

      console.log('Loading MDX:', { mdx: mdxUrl, pdx: pdxUrl });

      // Initialize audio context first
      await initialize();

      if (!synthNodeRef.current) return;

      try {
        // Load PDX first if specified
        if (pdxUrl) {
          const pdxResponse = await fetch(pdxUrl);
          if (pdxResponse.ok) {
            const pdxData = await pdxResponse.arrayBuffer();
            const pdxFilename = pdxUrl.split('/').pop() || 'unknown.pdx';
            console.log('Loaded PDX:', pdxFilename, 'size:', pdxData.byteLength);
            loadPDX(pdxFilename, pdxData);
          } else {
            console.warn('Failed to load PDX:', pdxUrl, pdxResponse.status);
          }
        }

        // Load MDX
        const mdxResponse = await fetch(mdxUrl);
        if (mdxResponse.ok) {
          const mdxData = await mdxResponse.arrayBuffer();
          const mdxFilename = mdxUrl.split('/').pop() || 'unknown.mdx';
          console.log('Loaded MDX:', mdxFilename, 'size:', mdxData.byteLength);
          loadMDX(mdxFilename, mdxData);
        } else {
          console.error('Failed to load MDX:', mdxUrl, mdxResponse.status);
        }
      } catch (e) {
        console.error('Error loading from URL params:', e);
      }
    };

    loadFromURLParams();
  }, [initialize, loadMDX, loadPDX]);

  return (
    <MDXPlayerContext.Provider
      value={{
        playerState,
        channelData,
        muteState,
        playbackInfo,
        isReady,
        midiState,
        playlist,
        initialize,
        play,
        pause,
        stop,
        fadeout,
        loadMDX,
        loadPDX,
        toggleMute,
        addToPlaylist,
        removeFromPlaylist,
        clearPlaylist,
        selectPlaylistItem,
        playSelectedItem,
        toggleAutoPlay,
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
