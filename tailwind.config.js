/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Syne"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Surface
        'bg':       '#070b14',
        'bg-2':     '#0d1424',
        'bg-3':     '#121b30',
        'panel':    '#0a1120',
        'border-w': 'rgba(255,255,255,0.10)',
        'border-d': 'rgba(255,255,255,0.05)',

        // Text
        'tx-bright': '#ffffff',
        'tx':        'rgba(255,255,255,0.85)',
        'tx-muted':  'rgba(255,255,255,0.55)',
        'tx-dim':    'rgba(255,255,255,0.35)',

        // Zone accents — top-to-bottom gradient through the stack
        'k-cyan':   '#00e5ff',   // External client
        'k-blue':   '#3b82f6',   // Bare metal infrastructure
        'k-sky':    '#38bdf8',   // Guest control plane namespace
        'k-teal':   '#14b8a6',   // KubeVirt launcher container
        'k-green':  '#22c55e',   // Guest worker node · VMI
        'k-purple': '#7c3aed',
        'k-amber':  '#f59e0b',

        // Trace
        'packet':   '#ff4d6d',
      },
      keyframes: {
        'fade-in':       { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in':      { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'pulse-dot':     { '0%,100%': { opacity: '1', transform: 'scale(1)' }, '50%': { opacity: '0.4', transform: 'scale(0.7)' } },
        'shimmer':       { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in':   'fade-in 0.35s ease-out',
        'slide-in':  'slide-in 0.3s ease-out',
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
        'shimmer':   'shimmer 2.6s linear infinite',
      },
    },
  },
  plugins: [],
}
