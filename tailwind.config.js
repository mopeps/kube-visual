/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        code:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Background layers
        'k-base':   '#070b14',
        'k-s1':     '#0c1424',
        'k-s2':     '#111b30',
        'k-s3':     '#162340',
        // Borders
        'k-bd-dim': 'rgba(148,163,184,0.06)',
        'k-bd':     'rgba(148,163,184,0.12)',
        'k-bd-hi':  'rgba(148,163,184,0.22)',
        // Text
        'k-tx-dim': '#475569',
        'k-tx-mut': '#64748b',
        'k-tx':     '#94a3b8',
        'k-tx-br':  '#cbd5e1',
        'k-tx-wh':  '#f1f5f9',
        // Accents
        'k-cyan':   '#22d3ee',
        'k-teal':   '#5eead4',
        'k-amber':  '#fbbf24',
        'k-orange': '#fb923c',
        'k-green':  '#34d399',
        'k-purple': '#a78bfa',
        'k-pink':   '#f472b6',
        'k-red':    '#f87171',
        'k-sky':    '#38bdf8',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(24px)', opacity: '0' },
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
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 currentColor' },
          '50%':      { boxShadow: '0 0 0 4px transparent' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'slide-in':      'slide-in 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'reveal-up':     'reveal-up 0.35s ease-out',
        'pulse-amber':   'pulse-amber 1.8s ease-in-out infinite',
        'blink':         'blink 1s step-end infinite',
        'fade-in':       'fade-in 0.4s ease-out',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
