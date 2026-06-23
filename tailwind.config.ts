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
          // ── Paleta Claudia Agudelo Beauty ──────────────────
          bg:              '#FCF9EF', // Crema Marfil
          'bg-dark':       '#F5F0E0', // Crema ligeramente más oscura
          primary:         '#D9A5A8', // Rosa Floral
          'primary-light': '#F1B8C6', // Rosa Suave
          'primary-dark':  '#C08890', // Rosa más oscuro
          secondary:       '#CDA967', // Dorado
          'secondary-light':'#E2CC9A', // Dorado claro
          'secondary-dark': '#A88840', // Dorado oscuro
          sage:            '#A3A39B', // Verde Salvia
          'sage-light':    '#C5C5BE',
          'sage-dark':     '#7A7A73',
          beige:           '#DDD4AD', // Beige Dorado
          eucalyptus:      '#626360', // Eucalipto / gris oscuro
          accent:          '#D9A5A8', // alias → Rosa Floral (botón principal)
          'accent-dark':   '#C08890',
          text:            '#626360', // Eucalipto como color de texto
          'text-dark':     '#3A3B39',
          'text-muted':    '#A3A39B', // Verde Salvia para texto secundario
          white:           '#FFFFFF',
          'off-white':     '#FCF9EF',
          // compat aliases
          gold:            '#CDA967',
          'gold-light':    '#E2CC9A',
          'gold-dark':     '#A88840',
          rose:            '#D9A5A8',
          'rose-light':    '#F1B8C6',
          'rose-dark':     '#C08890',
          black:           '#626360',
          'black-soft':    '#3A3B39',
          'text-soft':     '#A3A39B',
        },
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gradient-beauty':  'linear-gradient(135deg, #D9A5A8 0%, #CDA967 60%, #F1B8C6 100%)',
        'gradient-warm':    'linear-gradient(135deg, #FCF9EF 0%, #F5F0E0 50%, #DDD4AD 100%)',
        'gradient-rose':    'linear-gradient(135deg, #FCF9EF 0%, #F1B8C6 100%)',
        'gradient-gold':    'linear-gradient(135deg, #CDA967 0%, #E2CC9A 50%, #CDA967 100%)',
        'gradient-accent':  'linear-gradient(135deg, #D9A5A8 0%, #F1B8C6 100%)',
        'gradient-section': 'linear-gradient(180deg, #FCF9EF 0%, #F5F0E0 100%)',
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
        pulseGold:  { '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,171,106,0.4)' }, '50%': { boxShadow: '0 0 0 12px rgba(201,171,106,0)' } },
        float:      { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      boxShadow: {
        'beauty':     '0 4px 24px rgba(217,165,168,0.25)',
        'beauty-lg':  '0 8px 48px rgba(217,165,168,0.35)',
        'card':       '0 2px 16px rgba(205,169,103,0.12)',
        'card-hover': '0 8px 32px rgba(205,169,103,0.22)',
      },
    },
  },
  plugins: [],
}

export default config
