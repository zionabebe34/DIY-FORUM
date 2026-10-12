/** @type {import('tailwindcss').Config} */
// Theme copied from the Claude Design mock-up (HandyHub.html).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Assistant', 'ui-sans-serif', 'system-ui'],
        display: ['"Frank Ruhl Libre"', 'Assistant', 'ui-serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Cream paper background — also redefines `white` so all
        // `bg-white` / `bg-white/85` / `text-white` flow as warm paper.
        white: '#fbf6ec',
        cream: '#fbf6ec',
        pure:  '#ffffff',
        // Saffron accent (class name `rust` kept from the original design)
        rust: {
          50: '#fdf3e8', 100: '#fae0c4', 200: '#f4c293', 300: '#ee9d5e', 400: '#ea843f',
          500: '#e8743b', 600: '#c8551d', 700: '#a8472b', 800: '#7d3520', 900: '#5b2614',
        },
        // Forest-warm neutrals (class name `slate` kept)
        slate: {
          50: '#f4ecd9', 100: '#ebe1c8', 200: '#d8ccaf', 300: '#b8ad8f', 400: '#8b9489',
          500: '#5d7068', 600: '#42584e', 700: '#2d443a', 800: '#20342c', 900: '#162a23',
        },
        // Dijon (secondary accent)
        dijon: { 300: '#e6d09a', 400: '#dcc282', 500: '#d4b96a', 600: '#b89a48', 700: '#8e7530' },
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(22 42 35 / 0.04), 0 1px 3px 0 rgb(22 42 35 / 0.06)',
        pop:  '0 10px 30px -10px rgb(22 42 35 / 0.20), 0 2px 6px 0 rgb(22 42 35 / 0.06)',
      },
    },
  },
  plugins: [],
};
