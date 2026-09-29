/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        background: '#071426', // Primary bg
        surface: '#0B1A2E', // Secondary
        surfaceElevated: '#112943', // Elevated panel
        panel: '#0E2038', // Panel
        border: '#1C3A5A',
        borderLight: '#16314D', // Subtle borders
        primary: '#00B7FF', // Electric cyan
        primaryHover: '#1687FF', // Bright blue
        accentCyan: '#00B7FF',
        accentViolet: '#7657FF', // Purple
        textMain: '#F4F8FF', // Text Primary
        textSecondary: '#8FA7C2', // Text Secondary
        textMuted: '#58718D', // Text Muted
        semantic: {
          green: '#00E5A0', // Emerald
          amber: '#FFAA00', // Orange
          red: '#FF3B4E' // Red
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}
