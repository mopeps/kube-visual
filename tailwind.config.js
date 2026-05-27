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
        'k-base':   '#05070f',
        'k-s1':     '#0a1020',
        'k-s2':     '#10182c',
        'k-s3':     '#16223e',
        // Borders
        'k-bd-dim': 'rgba(148,163,184,0.08)',
        'k-bd':     'rgba(148,163,184,0.18)',
        'k-bd-hi':  'rgba(148,163,184,0.34)',
        // Text
        'k-tx-dim': '#64748b',
        'k-tx-mut': '#94a3b8',
        'k-tx':     '#cbd5e1',
        'k-tx-br':  '#e2e8f0',
        'k-tx-wh':  '#f8fafc',
        // Neon accents
        'k-cyan':   '#00f0ff',
        'k-teal':   '#2dffd5',
        'k-amber':  '#ffcb33',
        'k-orange': '#ff8a2a',
        'k-green':  '#39ff88',
        'k-purple': '#c084fc',
        'k-pink':   '#ff5fbf',
        'k-red':    '#ff5470',
        'k-sky':    '#33c8ff',
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
