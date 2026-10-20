import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths, so the build works under a GitHub Pages project path (/<repo>/).
  base: './',
  plugins: [react()],
});
