/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Terminal-first: everything is mono.
        sans:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['"Major Mono Display"', '"JetBrains Mono"', 'monospace'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        code:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── Catppuccin Mocha · background layers ────────────────────────
        'k-crust':  '#11111b',   // outermost window chrome
        'k-base':   '#1e1e2e',   // main canvas surface
        'k-s1':     '#181825',   // mantle · sidebar
        'k-s2':     '#313244',   // surface0 · raised cards
        'k-s3':     '#45475a',   // surface1 · nested
        'k-s4':     '#585b70',   // surface2 · selection hi
        // ── Borders (overlay0 with alpha so they layer cleanly) ────────
        'k-bd-dim': 'rgba(108, 112, 134, 0.18)',
        'k-bd':     'rgba(108, 112, 134, 0.34)',
        'k-bd-hi':  'rgba(108, 112, 134, 0.58)',
        // ── Text hierarchy ─────────────────────────────────────────────
        'k-tx-dim': '#585b70',   // surface2 · very faded
        'k-tx-mut': '#6c7086',   // overlay0
        'k-tx':     '#a6adc8',   // subtext0
        'k-tx-br':  '#bac2de',   // subtext1
        'k-tx-wh':  '#cdd6f4',   // text · the "white"
        // ── Catppuccin accents (k-* names repointed) ───────────────────
        'k-cyan':   '#89dceb',   // sky
        'k-teal':   '#94e2d5',   // teal
        'k-amber':  '#fab387',   // peach (warm accent)
        'k-orange': '#eba0ac',   // maroon
        'k-green':  '#a6e3a1',   // green
        'k-purple': '#cba6f7',   // mauve
        'k-pink':   '#f5c2e7',   // pink
        'k-red':    '#f38ba8',   // red
        'k-sky':    '#74c7ec',   // sapphire
        // ── Additional Catppuccin accents (new) ────────────────────────
        'k-yellow':    '#f9e2af',
        'k-blue':      '#89b4fa',
        'k-lavender':  '#b4befe',
        'k-rosewater': '#f5e0dc',
        'k-flamingo':  '#f2cdcd',
        'k-maroon':    '#eba0ac',
        'k-sapphire':  '#74c7ec',
        'k-mauve':     '#cba6f7',
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
          '50%':      { opacity: '0.4' },
        },
        'blink': {
          '0%, 49%':   { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'caret-blink': {
          '0%, 60%':   { opacity: '1' },
          '61%, 100%': { opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'type-in': {
          from: { width: '0' },
          to:   { width: '100%' },
        },
        'scanline-drift': {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100vh' },
        },
        'flicker': {
          '0%, 100%':   { opacity: '1' },
          '7%, 9%':     { opacity: '0.85' },
          '8%':         { opacity: '0.6' },
          '50%, 52%':   { opacity: '0.92' },
        },
      },
      animation: {
        'slide-in':      'slide-in 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'reveal-up':     'reveal-up 0.35s ease-out',
        'pulse-amber':   'pulse-amber 1.8s ease-in-out infinite',
        'blink':         'blink 1s step-end infinite',
        'caret':         'caret-blink 1.1s step-end infinite',
        'fade-in':       'fade-in 0.4s ease-out',
        'type-in':       'type-in 0.9s steps(28, end) forwards',
        'flicker':       'flicker 6s infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
