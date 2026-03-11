/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf4',
          100: '#c5cfe0',
          200: '#8a9fc1',
          300: '#5a7aab',
          400: '#2d4a7a',
          500: '#1e3a6e',
          600: '#1a2f5a',
          700: '#152546',
          800: '#111d38',
          900: '#0c1525',
        },
        gold: {
          50: '#fdf8e8',
          100: '#f9edc5',
          200: '#f0d88a',
          300: '#e5c04f',
          400: '#c9a84c',
          500: '#b8963f',
          600: '#9a7a30',
          700: '#7a6025',
          800: '#5c481c',
          900: '#3d3012',
        }
      }
    },
  },
  plugins: [],
}
