import { MDXPlayerProvider } from '@/contexts/MDXPlayerContext';
import { MDXPlayer } from '@/components/MDXPlayer';

export default function App() {
  return (
    <MDXPlayerProvider>
      <MDXPlayer />
    </MDXPlayerProvider>
  );
}
