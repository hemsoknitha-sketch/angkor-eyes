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
        angkor: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          gold: '#f59e0b',
          ruby: '#ef4444',
          sapphire: '#3b82f6',
          slate: '#0f172a',
          dark: '#0a0f1d',
          card: '#131b2e',
          border: '#1e293b'
        }
      },
      fontFamily: {
        sans: ['Noto Sans Khmer', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
