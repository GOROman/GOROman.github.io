import { useCallback, useRef, useEffect } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

export function Playlist() {
  const {
    playlist,
    selectPlaylistItem,
    playSelectedItem,
    removeFromPlaylist,
    clearPlaylist,
    toggleAutoPlay,
  } = useMDXPlayer();

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);

  // Scroll to selected item
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [playlist.currentIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (playlist.currentIndex > 0) {
            selectPlaylistItem(playlist.currentIndex - 1);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (playlist.currentIndex < playlist.items.length - 1) {
            selectPlaylistItem(playlist.currentIndex + 1);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          playSelectedItem();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (playlist.currentIndex >= 0) {
            removeFromPlaylist(playlist.currentIndex);
          }
          break;
      }
    },
    [playlist.currentIndex, playlist.items.length, selectPlaylistItem, playSelectedItem, removeFromPlaylist]
  );

  const handleItemClick = useCallback(
    (index: number) => {
      selectPlaylistItem(index);
    },
    [selectPlaylistItem]
  );

  const handleItemDoubleClick = useCallback(
    (index: number) => {
      selectPlaylistItem(index);
      playSelectedItem();
    },
    [selectPlaylistItem, playSelectedItem]
  );

  const currentNum = playlist.playingIndex >= 0 ? playlist.playingIndex + 1 : 0;
  const totalNum = playlist.items.length;

  return (
    <div className="mmdsp-panel mx-[10px] mb-[10px]">
      <div className="mmdsp-panel-header flex items-center gap-2.5">
        <span>PLAYLIST</span>
        <span className="text-[10px] text-[#303080] flex-1">
          [{String(currentNum).padStart(2, '0')}/{String(totalNum).padStart(2, '0')}]
        </span>
        <div className="flex gap-1">
          <button
            onClick={toggleAutoPlay}
            className={`mmdsp-playlist-btn ${playlist.isAutoPlay ? 'active' : ''}`}
            title="Auto Play"
          >
            AUTO
          </button>
          <button
            onClick={clearPlaylist}
            className="mmdsp-playlist-btn"
            title="Clear Playlist"
          >
            CLR
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="max-h-[150px] overflow-y-auto bg-[#000008] outline-none focus:outline focus:outline-1 focus:outline-[#3030a0]"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <ul className="list-none p-0 m-0">
          {playlist.items.length === 0 ? (
            <li className="p-5 text-center text-[11px] text-[#303080]">
              Drop MDX/PDX/ZIP files here
            </li>
          ) : (
            playlist.items.map((item, index) => (
              <li
                key={item.id}
                ref={index === playlist.currentIndex ? selectedRef : null}
                onClick={() => handleItemClick(index)}
                onDoubleClick={() => handleItemDoubleClick(index)}
                className={`
                  flex items-center gap-2 px-2 py-1 cursor-pointer
                  font-['MS_Gothic','Share_Tech_Mono',monospace] text-[11px]
                  text-[#6060c0] border-b border-[#101020]
                  transition-colors duration-100
                  hover:bg-[#181840]
                  ${index === playlist.currentIndex ? 'bg-gradient-to-b from-[#202060] to-[#101040] text-[#a0a0ff]' : ''}
                  ${index === playlist.playingIndex ? 'text-[#40ff40]' : ''}
                `}
              >
                {index === playlist.playingIndex && (
                  <span className="text-[8px] text-[#40ff40] mr-1">▶</span>
                )}
                <span className="w-6 text-[10px] text-[#303080] text-right">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {item.title || item.mdxFilename}
                </span>
                {item.title && (
                  <span className="text-[9px] text-[#303080] max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.mdxFilename}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
