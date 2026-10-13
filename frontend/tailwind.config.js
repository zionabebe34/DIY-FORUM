/** @type {import('tailwindcss').Config} */
// Modern Studio theme for HandyHub (clean, crisp, maker-focused palette)
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Assistant', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Rubik', 'Assistant', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Modern Studio: crisp pure white surfaces & cards
        white: '#ffffff',
        cream: '#ffffff',
        pure:  '#ffffff',
        // Modern Maker Vibrant Orange accent (replaces Claude terracotta rust)
        rust: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Modern cool neutral Slate palette (replaces murky Claude yellow-forest neutrals)
        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Modern energetic amber/gold accent
        dijon: {
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.05), 0 1px 2px -1px rgb(15 23 42 / 0.05)',
        pop:  '0 12px 28px -6px rgb(15 23 42 / 0.12), 0 4px 10px -2px rgb(15 23 42 / 0.04)',
      },
    },
  },
  plugins: [],
};
