/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0e1a17',
        paper: '#f6f3ec',
        chart: '#1f6f5c',
        pulse: '#e0563a',
        vitals: '#2f7cb8',
      },
      fontFamily: {
        display: ['"IBM Plex Serif"', 'serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
