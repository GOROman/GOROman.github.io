import { useState, useCallback, useRef } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';
import type { PlaylistItem } from '@/lib/types';
import JSZip from 'jszip';

export function DropZone() {
  const { addToPlaylist, playSelectedItem, playlist } = useMDXPlayer();
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
        const zip = await JSZip.loadAsync(zipFile);
        const mdxEntries: { path: string; filename: string; zipEntry: JSZip.JSZipObject }[] = [];
        const pdxCache: Record<string, { filename: string; data: ArrayBuffer }> = {};

        // First pass: collect all files
        for (const [path, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;

          const filename = path.split('/').pop() || '';
          if (filename.match(/\.mdx$/i)) {
            mdxEntries.push({ path, filename, zipEntry });
          } else if (filename.match(/\.pdx$/i)) {
            const data = await zipEntry.async('arraybuffer');
            pdxCache[filename.toUpperCase()] = { filename, data };
          }
        }

        // Second pass: create playlist items
        for (const mdx of mdxEntries) {
          const mdxData = await mdx.zipEntry.async('arraybuffer');

          // Try to find matching PDX (same name)
          const pdxName = mdx.filename.replace(/\.mdx$/i, '.PDX').toUpperCase();
          const pdxInfo = pdxCache[pdxName];

          const item: PlaylistItem = {
            id: crypto.randomUUID(),
            mdxFilename: mdx.filename,
            mdxData,
            pdxFilename: pdxInfo?.filename || null,
            pdxData: pdxInfo?.data || null,
            title: null,
          };

          addToPlaylist(item);
        }
      } catch (err) {
        console.error('ZIP processing error:', err);
      }
    },
    [addToPlaylist]
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

      // Read PDX files into cache
      const pdxCache: Record<string, { filename: string; data: ArrayBuffer }> = {};
      for (const pdxFile of pdxFiles) {
        const data = await readFileAsync(pdxFile);
        pdxCache[pdxFile.name.toUpperCase()] = { filename: pdxFile.name, data };
      }

      // Process MDX files
      for (const mdxFile of mdxFiles) {
        const mdxData = await readFileAsync(mdxFile);

        // Try to find matching PDX
        const pdxName = mdxFile.name.replace(/\.mdx$/i, '.PDX').toUpperCase();
        const pdxInfo = pdxCache[pdxName];

        const item: PlaylistItem = {
          id: crypto.randomUUID(),
          mdxFilename: mdxFile.name,
          mdxData,
          pdxFilename: pdxInfo?.filename || null,
          pdxData: pdxInfo?.data || null,
          title: null,
        };

        addToPlaylist(item);
      }

      // Auto-play first item if this is the first drop
      if (playlist.playingIndex === -1 && playlist.items.length === 0) {
        // Need to wait for state update
        setTimeout(() => playSelectedItem(), 100);
      }
    },
    [addToPlaylist, processZipFile, readFileAsync, playlist.playingIndex, playlist.items.length, playSelectedItem]
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
