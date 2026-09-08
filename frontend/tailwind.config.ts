import type { Config } from 'tailwindcss';

/**
 * Design tokens live in CSS variables (see src/theme/tokens.css) so the same
 * components render in dark (control-room) and light (report / projector) themes.
 * Tailwind just maps names -> var(...).
 */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        forecast: 'rgb(var(--forecast) / <alpha-value>)',
        low: 'rgb(var(--low) / <alpha-value>)',
        medium: 'rgb(var(--medium) / <alpha-value>)',
        high: 'rgb(var(--high) / <alpha-value>)',
        critical: 'rgb(var(--critical) / <alpha-value>)',
        person: 'rgb(var(--person) / <alpha-value>)',
        car: 'rgb(var(--car) / <alpha-value>)',
        bus: 'rgb(var(--bus) / <alpha-value>)',
        truck: 'rgb(var(--truck) / <alpha-value>)',
        moto: 'rgb(var(--moto) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: 'var(--r-card)',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgb(255 255 255 / 0.03), 0 8px 24px -12px rgb(0 0 0 / 0.6)',
      },
      keyframes: {
        pulseCritical: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--critical) / 0.45)' },
          '50%': { boxShadow: '0 0 0 6px rgb(var(--critical) / 0)' },
        },
        slideIn: {
          from: { transform: 'translateX(12px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'pulse-critical': 'pulseCritical 2s ease-out infinite',
        'slide-in': 'slideIn 180ms ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
