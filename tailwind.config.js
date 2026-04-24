/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta navy remapeada para "Elite Tactical Interface"
        // mantem nomes antigos (compativel com codigo existente)
        navy: {
          50: '#e8ecf4',
          100: '#c5cfe0',
          200: '#8a9fc1',
          300: '#5a7aab',
          400: '#353943',
          500: '#31353f',
          600: '#262a34',
          700: '#181b25',
          800: '#0f131c',
          900: '#0A0E17',
        },
        // Dourado Elite Tactical
        gold: {
          50: '#fdf8e8',
          100: '#f9edc5',
          200: '#ffe088',
          300: '#e9c349',
          400: '#f2ca50',
          500: '#d4af37',
          600: '#b8963f',
          700: '#7a6025',
          800: '#5c481c',
          900: '#3d3012',
        },
        // Novos tokens do design system (para componentes novos)
        background: '#0A0E17',
        surface: '#0f131c',
        'surface-container': '#1c1f29',
        'surface-container-low': '#181b25',
        'surface-container-high': '#262a34',
        'on-surface': '#dfe2ef',
        'on-surface-variant': '#d0c5af',
        primary: '#f2ca50',
        'primary-container': '#d4af37',
        'on-primary': '#3c2f00',
        secondary: '#d7ffc5',
        'secondary-container': '#2ff801',
        'secondary-fixed': '#79ff5b',
        tertiary: '#72dcff',
        'tertiary-container': '#00c3ed',
        error: '#ffb4ab',
        outline: '#99907c',
        'outline-variant': '#4d4635',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'label-caps': ['12px', { lineHeight: '16px', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      boxShadow: {
        'glass': 'inset 0 0 20px rgba(255,255,255,0.02)',
        'glass-gold': '0 0 30px rgba(212,175,55,0.2)',
        'nav-top': '0 -4px 20px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
