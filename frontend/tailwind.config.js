/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E1A', surface: '#111827', card: '#161D2E', border: '#1E2D47',
        accent: '#00D4AA', 'accent-dim': 'rgba(0,212,170,0.1)',
        gold: '#F5A623', danger: '#FF4D6D', blue: '#3D8EFF',
        muted: '#64748B', subtle: '#1C2740',
      },
      fontFamily: {
        mono: ['"DM Mono"', '"Courier New"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
