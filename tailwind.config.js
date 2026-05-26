/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-fredoka)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: "#FF1493",
          hover: "#FF369B",
        },
        dark: {
          DEFAULT: "#000000",
          lighter: "#111111",
          light: "#1a1a1a",
        },
        purple: {
          300: '#c4b5fd',
          400: '#a855f7',
          500: '#9333ea',
          600: '#7e22ce',
          700: '#6b21a8',
          900: '#3b0764',
        },
      },
      boxShadow: {
        'glow-purple': '0 0 0 1px rgba(147,51,234,0.4), 0 8px 32px -8px rgba(147,51,234,0.45)',
        'glow-purple-sm': '0 0 0 1px rgba(147,51,234,0.35), 0 4px 18px -6px rgba(147,51,234,0.35)',
        'card-lift': '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px -16px rgba(0,0,0,0.6)',
      },
      animation: {
        'fm-fade-up':        'fmFadeUp 420ms cubic-bezier(0.22,1,0.36,1) both',
        'fm-fade-in':        'fmFadeIn 280ms cubic-bezier(0.22,1,0.36,1) both',
        'fm-slide-in-right': 'fmSlideInRight 220ms cubic-bezier(0.22,1,0.36,1) both',
        'fm-pulse-dot':      'fmPulseDot 2s ease-in-out infinite',
        'fm-pulse-glow':     'fmPulseGlow 2.4s ease-in-out infinite',
        'fm-shimmer':        'fmShimmer 1.8s linear infinite',
        'fm-typing-dots':    'fmTypingDots 1.2s ease-in-out infinite',
        'fm-drift':          'fmDrift 30s ease-in-out infinite',
        'fm-bar-grow':       'fmBarGrow 700ms cubic-bezier(0.22,1,0.36,1) both',
      },
      keyframes: {
        fmFadeUp:       { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        fmFadeIn:       { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        fmSlideInRight: { '0%': { opacity: 0, transform: 'translateX(16px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        fmPulseDot:     { '0%,100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.45, transform: 'scale(1.4)' } },
        fmPulseGlow:    { '0%,100%': { boxShadow: '0 0 0 0 rgba(147,51,234,0.35)' }, '50%': { boxShadow: '0 0 0 8px rgba(147,51,234,0)' } },
        fmShimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        fmTypingDots:   { '0%,60%,100%': { transform: 'translateY(0)', opacity: 0.4 }, '30%': { transform: 'translateY(-3px)', opacity: 1 } },
        fmDrift:        { '0%,100%': { transform: 'translate3d(-4%,-2%,0) scale(1.05)' }, '50%': { transform: 'translate3d(4%,3%,0) scale(1.12)' } },
        fmBarGrow:      { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
    },
  },
  plugins: [],
}
