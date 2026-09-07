/**
 * DESIGN.md tokenlari CSS o'zgaruvchilariga bog'langan.
 * Shu sababli bitta <html class="dark"> almashishi butun palitrani o'zgartiradi.
 */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const tokens = [
  'surface', 'surface-dim', 'surface-bright',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest', 'surface-variant',
  'on-surface', 'on-surface-variant', 'inverse-surface', 'inverse-on-surface',
  'outline', 'outline-variant', 'surface-tint',
  'primary', 'on-primary', 'primary-container', 'on-primary-container', 'inverse-primary',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'warning', 'on-warning',
  'background', 'on-background',
];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(tokens.map((t) => [t, c(t)])),
      // To'liq shaffoflik shkalasi — @apply ichida ishlatilgan har qanday /NN
      // (masalan /12, /15, /45, /85) hal bo'lishi uchun. JSX'dagi arbitrary
      // qiymatlar (/[0.06]) baribir alohida ishlaydi.
      opacity: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i * 5, `${i * 5 / 100}`])
        .concat([[12, '0.12'], [15, '0.15'], [45, '0.45'], [85, '0.85']])),
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-lg': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-sm': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'headline-xl': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-lg': ['1.375rem', { lineHeight: '1.875rem', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-md': ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1rem', { lineHeight: '1.6rem', letterSpacing: '-0.005em' }],
        'body-md': ['0.875rem', { lineHeight: '1.45rem' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'label-md': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.04em', fontWeight: '600' }],
        'code-md': ['0.8125rem', { lineHeight: '1.375rem' }],
      },
      borderRadius: {
        sm: '0.25rem', DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem',
      },
      spacing: {
        'sidebar-collapsed': '4rem',
        'sidebar': '16rem',
        'inspector': '22rem',
      },
      boxShadow: {
        level2: '0 4px 20px -2px rgb(0 0 0 / 0.28), 0 0 0 1px rgb(var(--outline-variant) / 0.5)',
        level3: '0 12px 40px -8px rgb(0 0 0 / 0.42)',
        glow: '0 0 0 2px rgb(var(--primary) / 0.25), 0 0 12px rgb(var(--primary) / 0.15)',
      },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgb(var(--tertiary) / 0.45)' }, '70%': { boxShadow: '0 0 0 6px rgb(var(--tertiary) / 0)' }, '100%': { boxShadow: '0 0 0 0 rgb(var(--tertiary) / 0)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.18s ease-out',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
};
