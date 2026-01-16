import { useState, useCallback, useRef } from 'react';
import { useMDXPlayer } from '@/contexts/MDXPlayerContext';

export function DropZone() {
  const { loadMDX, loadPDX, play } = useMDXPlayer();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList) => {
      const fileArray = Array.from(files);

      // Load PDX files first
      fileArray
        .filter((file) => file.name.match(/\.pdx$/i))
        .forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              loadPDX(file.name, event.target.result as ArrayBuffer);
            }
          };
          reader.readAsArrayBuffer(file);
        });

      // Then load MDX files
      fileArray
        .filter((file) => file.name.match(/\.mdx$/i))
        .forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              loadMDX(file.name, event.target.result as ArrayBuffer);
              play();
            }
          };
          reader.readAsArrayBuffer(file);
        });
    },
    [loadMDX, loadPDX, play]
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
        accept=".mdx,.pdx"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      {isDragging
        ? 'Drop MDX/PDX files here'
        : 'Drop MDX/PDX files here or click to select'}
    </div>
  );
}
