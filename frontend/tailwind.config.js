/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#f8fafc',  // clean neutral-light slate-50
          100: '#f1f5f9', // soft neutral slate-100
          200: '#e2e8f0', // neutral border/pill slate-200
          300: '#cbd5e1', // medium-light slate-300
          400: '#94a3b8', // muted slate-400
          500: '#64748b', // neutral slate-500
          600: '#475569', // slate dark slate-600
          700: '#334155', // deep slate slate-700
          800: '#1e293b', // charcoal slate-800
          900: '#0f172a', // deep graphite slate-900
        },
        terracotta: {
          50: '#f1f5f9',
          100: '#e2e8f0',
          200: '#cbd5e1',
          300: '#94a3b8',
          400: '#64748b',
          500: '#334155',
          600: '#1e293b',
          700: '#0f172a',
        },
        misty: {
          50: '#f8fafc',
          100: '#f0f4f8',
          200: '#E9EEF3',
          300: '#d9e2ec',
          400: '#bcccdc',
          500: '#9fb3c8',
          600: '#627d98',
          700: '#486581',
          800: '#334e68',
          900: '#102a43',
        },
        apple: {
          bg: "#E9EEF3",
          surface: "rgba(255, 255, 255, 0.88)",
          card: "rgba(255, 255, 255, 0.94)",
          cardHover: "#ffffff",
          elevated: "#ffffff",
          border: "rgba(148, 163, 184, 0.24)",
          borderLight: "rgba(148, 163, 184, 0.12)",
          borderHighlight: "rgba(148, 163, 184, 0.36)",
          blue: "#2563eb",
          blueMuted: "rgba(37, 99, 235, 0.1)",
          emerald: "#059669",
          emeraldMuted: "rgba(5, 150, 105, 0.1)",
          amber: "#d97706",
          amberMuted: "rgba(217, 119, 6, 0.1)",
          red: "#dc2626",
          redMuted: "rgba(220, 38, 38, 0.1)",
          purple: "#7c3aed",
          subtext: "#64748b",
          body: "#334155",
          dark: "#0f172a"
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      boxShadow: {
        'apple-card': '0 4px 24px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
        'apple-card-hover': '0 12px 32px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.9)',
        'apple-elevated': '0 20px 48px -12px rgba(15, 23, 42, 0.09), 0 8px 16px -4px rgba(15, 23, 42, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.95)',
        'apple-button': '0 1px 3px 0 rgba(15, 23, 42, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
        'apple-pill': '0 2px 8px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)',
      }
    },
  },
  plugins: [],
}
