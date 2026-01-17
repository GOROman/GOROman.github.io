import { useState, useCallback, useRef } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';
import type { PlaylistItem } from '@/lib/types';
import JSZip from 'jszip';

export function DropZone() {
  const { addToPlaylist, playSelectedItem, playlist, loadPDX, initialize } = useMDXPlayer();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsync = useCallback((file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const processZipFile = useCallback(
    async (zipFile: File) => {
      try {
        // Initialize audio context first
        await initialize();

        const zip = await JSZip.loadAsync(zipFile);
        const mdxEntries: { path: string; filename: string; zipEntry: JSZip.JSZipObject }[] = [];

        // First pass: collect MDX files and load PDX files directly to WASM
        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;

          const filename = path.split('/').pop() || '';
          if (filename.match(/\.mdx$/i)) {
            mdxEntries.push({ path, filename, zipEntry });
          } else if (filename.match(/\.pdx$/i)) {
            const data = await zipEntry.async('arraybuffer');
            console.log('ZIP PDX -> WASM:', filename, 'size:', data.byteLength);
            // Load PDX directly to WASM
            loadPDX(filename, data);
          }
        }

        // Second pass: create playlist items (MDX only, PDX is already in WASM)
        for (const mdx of mdxEntries) {
          const mdxData = await mdx.zipEntry.async('arraybuffer');

          const item: PlaylistItem = {
            id: crypto.randomUUID(),
            mdxFilename: mdx.filename,
            mdxData,
            pdxFilename: null,
            pdxData: null,
            title: null,
          };

          console.log('ZIP Adding:', mdx.filename);
          addToPlaylist(item);
        }
      } catch (err) {
        console.error('ZIP processing error:', err);
      }
    },
    [addToPlaylist, initialize, loadPDX]
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      const fileArray = Array.from(files);

      // Separate files by type
      const zipFiles = fileArray.filter((f) => f.name.match(/\.zip$/i));
      const mdxFiles = fileArray.filter((f) => f.name.match(/\.mdx$/i));
      const pdxFiles = fileArray.filter((f) => f.name.match(/\.pdx$/i));

      // Process ZIP files
      for (const zipFile of zipFiles) {
        await processZipFile(zipFile);
      }

      // Initialize if we have PDX or MDX files
      if (pdxFiles.length > 0 || mdxFiles.length > 0) {
        await initialize();
      }

      // Load PDX files directly to WASM
      for (const pdxFile of pdxFiles) {
        const data = await readFileAsync(pdxFile);
        console.log('PDX -> WASM:', pdxFile.name, 'size:', data.byteLength);
        loadPDX(pdxFile.name, data);
      }

      // Process MDX files (PDX is already in WASM)
      for (const mdxFile of mdxFiles) {
        const mdxData = await readFileAsync(mdxFile);

        const item: PlaylistItem = {
          id: crypto.randomUUID(),
          mdxFilename: mdxFile.name,
          mdxData,
          pdxFilename: null,
          pdxData: null,
          title: null,
        };

        console.log('Adding to playlist:', mdxFile.name);
        addToPlaylist(item);
      }

      // Auto-play first item if this is the first drop
      if (playlist.playingIndex === -1 && playlist.items.length === 0) {
        // Need to wait for state update
        setTimeout(() => playSelectedItem(), 100);
      }
    },
    [addToPlaylist, processZipFile, readFileAsync, playlist.playingIndex, playlist.items.length, playSelectedItem, initialize, loadPDX]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`mmdsp-dropzone ${isDragging ? 'drag-over' : ''}`}
      id="drop-zone"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mdx,.pdx,.zip"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      {isDragging
        ? 'Drop MDX/PDX/ZIP files here'
        : 'Drop MDX/PDX/ZIP files here or click to select'}
    </div>
  );
}
