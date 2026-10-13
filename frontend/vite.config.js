import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the Flask API runs on :5050 — proxy it so the browser sees a single
// origin (the session cookie then works without any CORS setup).
const API = process.env.API_URL || 'http://127.0.0.1:5050';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: { statements: 85, lines: 85 },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
});
