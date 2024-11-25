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
        background: {
          light: '#f3f4f6', // gray-100
          dark: '#111827',  // gray-900
        },
        surface: {
          light: '#ffffff',
          dark: '#1f2937',  // gray-800
        }
      }
    },
  },
  plugins: [],
}