/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
        display: ['Syne', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        'k-bg':      '#070b14',
        'k-bg2':     '#0d1424',
        'k-cyan':    '#00e5ff',
        'k-purple':  '#7c3aed',
        'k-sky':     '#0ea5e9',
        'k-amber':   '#f59e0b',
        'k-emerald': '#10b981',
        'k-red':     '#ff4d6d',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.4', transform: 'scale(0.7)' },
        },
      },
      animation: {
        'slide-in':  'slide-in 0.2s ease-out',
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
