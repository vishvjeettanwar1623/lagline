import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-raised': 'var(--bg-raised)',
        'bg-wash': 'var(--bg-wash)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-ghost': 'var(--text-ghost)',
        'accent-ink': 'var(--accent-ink)',
        'accent-warm': 'var(--accent-warm)',
        'accent-muted': 'var(--accent-muted)',
        'status-ahead': 'var(--status-ahead)',
        'status-behind': 'var(--status-behind)',
        'status-dirty': 'var(--status-dirty)',
        'status-clean': 'var(--status-clean)',
        'status-unlinked': 'var(--status-unlinked)',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'xs': ['var(--text-xs)', { letterSpacing: '0.08em' }],
        'sm': 'var(--text-sm)',
        'base': 'var(--text-base)',
        'lg': 'var(--text-lg)',
        'xl': 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
      },
    },
  },
  plugins: [],
} satisfies Config
