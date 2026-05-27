/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'ui-sans-serif', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        code: ['"Fira Code"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        'k-base':   '#070b14',
        'k-s1':     '#0b1220',
        'k-s2':     '#0f192c',
        'k-s3':     '#132138',
        'k-bd-dim': '#192540',
        'k-bd':     '#1f3054',
        'k-bd-hi':  '#274060',
        'k-tx-dim': '#2e4a70',
        'k-tx-mut': '#456688',
        'k-tx':     '#6c92b4',
        'k-tx-br':  '#9abcd8',
        'k-tx-wh':  '#cce0f4',
        'k-cyan':   '#22d3ee',
        'k-amber':  '#fb923c',
        'k-green':  '#34d399',
        'k-purple': '#a78bfa',
        'k-red':    '#f87171',
        'k-sky':    '#38bdf8',
        'k-gold':   '#fbbf24',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',     opacity: '1' },
        },
        'reveal-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-amber': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'sweep': {
          from: { transform: 'scaleX(0)', transformOrigin: 'left' },
          to:   { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
      },
      animation: {
        'slide-in':      'slide-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'reveal-up':     'reveal-up 0.35s ease-out',
        'pulse-amber':   'pulse-amber 1.6s ease-in-out infinite',
        'blink':         'blink 1s step-end infinite',
        'sweep':         'sweep 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
