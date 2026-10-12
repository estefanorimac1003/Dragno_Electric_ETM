/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        autocad: {
          bg: 'rgb(var(--cad-bg) / <alpha-value>)',
          canvas: 'rgb(var(--cad-canvas) / <alpha-value>)',
          inset: 'rgb(var(--cad-inset) / <alpha-value>)',
          raised: 'rgb(var(--cad-raised) / <alpha-value>)',
          surface: 'rgb(var(--cad-surface) / <alpha-value>)',
          panel: 'rgb(var(--cad-panel) / <alpha-value>)',
          panelHeader: 'rgb(var(--cad-header) / <alpha-value>)',
          hover: 'rgb(var(--cad-hover) / <alpha-value>)',
          border: 'rgb(var(--cad-border) / <alpha-value>)',
          borderLight: 'rgb(var(--cad-border-light) / <alpha-value>)',
          grid: 'rgb(var(--cad-grid) / <alpha-value>)',
          gridMajor: 'rgb(var(--cad-grid) / <alpha-value>)',
          cyan: 'rgb(var(--cad-accent) / <alpha-value>)',
          yellow: 'rgb(var(--cad-gold) / <alpha-value>)',
          green: 'rgb(var(--cad-live) / <alpha-value>)',
          red: 'rgb(var(--cad-danger) / <alpha-value>)',
          blue: 'rgb(var(--cad-accent) / <alpha-value>)',
          orange: 'rgb(var(--cad-gold) / <alpha-value>)',
          textMuted: 'rgb(var(--cad-muted) / <alpha-value>)',
          textBright: 'rgb(var(--cad-text) / <alpha-value>)',
          onAccent: 'rgb(var(--cad-on-accent) / <alpha-value>)',
          chip: 'rgb(var(--cad-chip) / <alpha-value>)',
          chipHover: 'rgb(var(--cad-chip-hover) / <alpha-value>)',
          chipGold: 'rgb(var(--cad-chip-gold) / <alpha-value>)',
          chipLive: 'rgb(var(--cad-chip-live) / <alpha-value>)',
          accentHot: 'rgb(var(--cad-accent-hot) / <alpha-value>)',
        },
        controlmax: {
          blue: '#0284c7',
          blueHover: '#0369a1',
          tabActive: '#0f172a',
          tabInactive: '#1e293b',
          accent: '#38bdf8',
        }
      },
      fontFamily: {
        cad: ['"Segoe UI"', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['"Consolas"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgb(var(--cad-accent) / 0.45)',
        'glow-yellow': '0 0 15px rgb(var(--cad-gold) / 0.55)',
        'glow-green': '0 0 15px rgb(var(--cad-live) / 0.55)',
        'glow-red': '0 0 15px rgb(var(--cad-danger) / 0.55)',
      }
    },
  },
  plugins: [],
}
