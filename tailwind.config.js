/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Novo brand + pitch-inspired palette
        novo: {
          primary: '#0066CC',
          danger: '#DC3545',
          success: '#28A745',
          warning: '#FFC107',
        },
        pitch: {
          50: '#ecfdf5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
      },
      fontFamily: {
        display: ['"Clash Display"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
