/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui']
      },
      colors: {
        ink: '#181a2e',
        gold: '#785900',
        sun: '#ffc107',
        sky: '#00677d',
        aqua: '#50d9fe',
        rain: '#101425'
      },
      boxShadow: {
        glass: 'inset 0 1px 1px rgba(255,255,255,.55), 0 24px 80px rgba(24,26,46,.14)',
        glow: '0 0 42px rgba(80,217,254,.28)'
      }
    }
  },
  plugins: []
}
