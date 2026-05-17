/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ink — dark backgrounds, layered by depth
        ink: {
          950: '#0c0e14',  // page background, deepest
          900: '#13151c',  // card / panel surface
          800: '#191d28',  // raised card, inputs
          700: '#232838',  // borders, dividers
          600: '#353d52',  // hover borders, subtle dividers
        },
        // Paper — text on dark
        paper: {
          DEFAULT: '#e2e8f4',  // primary text
          dim: '#8892a4',       // secondary text
          faint: '#4a5568',     // tertiary / placeholder / disabled
        },
        // Ember — primary green CTA (replaces orange)
        ember: {
          DEFAULT: '#22c55e',
          soft: '#4ade80',
          muted: 'rgba(34,197,94,0.1)',
        },
        // Moss — bright success green (distinct from ember)
        moss: {
          DEFAULT: '#4ade80',
          muted: 'rgba(74,222,128,0.1)',
        },
        // Crimson — error
        crimson: {
          DEFAULT: '#f87171',
          muted: 'rgba(248,113,113,0.12)',
        },
      },
      fontFamily: {
        display: ['"Geist"', '"Inter Tight"', 'system-ui', 'sans-serif'],
        sans:    ['"Geist"', '"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card:        '0 1px 0 rgba(255,255,255,0.04), 0 4px 16px -4px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover':'0 1px 0 rgba(255,255,255,0.06), 0 8px 28px -6px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(34,197,94,0.12)',
        ember:       '0 0 32px -4px rgba(34,197,94,0.35)',
        'ember-sm':  '0 0 14px -2px rgba(34,197,94,0.22)',
        subtle:      'inset 0 0 0 1px rgba(255,255,255,0.05)',
        pop:         '0 0 0 1px rgba(34,197,94,0.4), 0 4px 16px -4px rgba(34,197,94,0.3)',
      },
      keyframes: {
        'pulse-ember': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':       { opacity: '0.5', transform: 'scale(0.85)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'transcript-in': {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'live-pulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(34,197,94,0.5)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(34,197,94,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
        },
        'marquee': {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'blink': {
          '50%': { opacity: '0' },
        },
        'msg-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          from: { backgroundPosition: '200% 0' },
          to:   { backgroundPosition: '-200% 0' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%':       { opacity: '1', transform: 'scale(1.04)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'pulse-ember':   'pulse-ember 1.6s ease-in-out infinite',
        'fade-up':       'fade-up 0.5s ease-out both',
        'transcript-in': 'transcript-in 0.3s ease-out both',
        'live-pulse':    'live-pulse 1.8s ease-out infinite',
        'marquee':       'marquee 30s linear infinite',
        'blink':         'blink 1s steps(2) infinite',
        'msg-in':        'msg-in 0.36s cubic-bezier(.2,.8,.2,1) both',
        'shimmer':       'shimmer 2s linear infinite',
        'glow-breathe':  'glow-breathe 3s ease-in-out infinite',
        'slide-in':      'slide-in 0.4s cubic-bezier(.2,.8,.2,1) both',
        'scale-in':      'scale-in 0.3s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
}
