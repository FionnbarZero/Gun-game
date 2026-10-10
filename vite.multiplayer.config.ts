import { defineConfig } from 'vite';
import { colyseus } from 'colyseus/vite';

export default defineConfig({
  build: { outDir:'dist-multiplayer/client' },
  plugins: colyseus({ serverEntry:'/server/app.config.ts' }),
});
