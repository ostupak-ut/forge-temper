/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // theme tokens (space-separated RGB channels via CSS vars)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        field: 'rgb(var(--field) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        grid: 'rgb(var(--grid) / <alpha-value>)',
        // forge/temper palette
        forge: '#e8743b',
        temper: '#3b9ae8',
        disc: {
          v: '#22c55e', // verified  (green)
          p: '#3b82f6', // plausible (blue)
          h: '#f59e0b', // heuristic (orange)
          c: '#ef4444', // conjectured (red)
        },
      },
    },
  },
  plugins: [],
}
