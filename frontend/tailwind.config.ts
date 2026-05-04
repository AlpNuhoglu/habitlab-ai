import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f8',
          100: '#d4dff0',
          200: '#a9bfe1',
          300: '#7e9fd2',
          400: '#537fc3',
          500: '#3a67b0',
          600: '#2d528d',
          700: '#1f3a5f',
          800: '#152847',
          900: '#0c1a2f',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
