/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
