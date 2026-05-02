import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In production we deploy to https://lasite.github.io/sgs/, so the
// asset paths must be prefixed with /sgs/.  Locally `pnpm dev` serves
// from / so the dev server keeps working.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/sgs/' : '/',
  server: {
    port: 5173,
  },
}));
