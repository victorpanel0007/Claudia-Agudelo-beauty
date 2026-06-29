import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        beauty: {
          // ── Paleta Oficial Claudia Agudelo Beauty ──────────────
          bg:              '#FFF8EE', // Crema Suave
          'bg-dark':       '#F5EFE0', // Crema ligeramente más oscura
          'rosa-claro':    '#FAD6E0', // Rosa Claro
          primary:         '#EFA1B5', // Rosa Medio (botones principales)
          'primary-light': '#FAD6E0', // Rosa Claro (hover light)
          'primary-dark':  '#D4809A', // Rosa Medio oscurecido
          borgona:         '#8B1E3F', // Borgoña (acento fuerte)
          'borgona-light': '#B5486A', // Borgoña claro
          'borgona-dark':  '#5C0F28', // Borgoña oscuro
          sage:            '#A7B8A6', // Verde Salvia
          'sage-light':    '#C5D1C4', // Verde Salvia claro
          'sage-dark':     '#7A9479', // Verde Salvia oscuro
          secondary:       '#D4AF37', // Dorado
          'secondary-light':'#E8CC6A', // Dorado claro
          'secondary-dark': '#A8861C', // Dorado oscuro
          text:            '#222222', // Negro Suave
          'text-dark':     '#111111',
          'text-muted':    '#666666',
          white:           '#FFFFFF',
          'off-white':     '#FFF8EE',
          // Aliases
          gold:            '#D4AF37',
          'gold-light':    '#E8CC6A',
          'gold-dark':     '#A8861C',
          black:           '#222222',
          'black-soft':    '#444444',
          'text-soft':     '#888888',
        },
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gradient-beauty':  'linear-gradient(135deg, #8B1E3F 0%, #5C0F28 100%)',
        'gradient-warm':    'linear-gradient(135deg, #FFF8EE 0%, #FAD6E0 100%)',
        'gradient-rose':    'linear-gradient(135deg, #FFF8EE 0%, #EFA1B5 100%)',
        'gradient-gold':    'linear-gradient(135deg, #D4AF37 0%, #E8CC6A 50%, #D4AF37 100%)',
        'gradient-borgona': 'linear-gradient(135deg, #8B1E3F 0%, #B5486A 100%)',
        'gradient-section': 'linear-gradient(180deg, #FFF8EE 0%, #FAD6E0 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.5s ease-in-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'bounce-soft':'bounceSoft 2s infinite',
        'pulse-gold': 'pulseGold 2s infinite',
        'float':      'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:    { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown:  { '0%': { transform: 'translateY(-20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        bounceSoft: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        pulseGold:  { '0%, 100%': { boxShadow: '0 0 0 0 rgba(212,175,55,0.4)' }, '50%': { boxShadow: '0 0 0 12px rgba(212,175,55,0)' } },
        float:      { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      boxShadow: {
        'beauty':     '0 4px 24px rgba(139,30,63,0.15)',
        'beauty-lg':  '0 8px 48px rgba(139,30,63,0.25)',
        'card':       '0 2px 16px rgba(139,30,63,0.08)',
        'card-hover': '0 8px 32px rgba(139,30,63,0.15)',
      },
    },
  },
  plugins: [],
}

export default config
