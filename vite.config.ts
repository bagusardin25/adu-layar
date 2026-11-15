import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devvit } from '@devvit/start/vite';

// The build Reddit runs: the client entrypoints in devvit.json plus the server bundle.
export default defineConfig({
  plugins: [react(), devvit()],
});
