import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#FFFFFF',
        surface: {
          50: '#FAFAFA',
          100: '#F7F7F7',
          200: '#F0F0F0',
          300: '#E7E7E7',
          400: '#DEDEDE',
          500: '#BDBDBD',
          800: '#222222',
          900: '#171717',
          950: '#111111',
        },
        border: {
          subtle: '#EFEFEF',
          DEFAULT: '#DEDEDE',
          strong: '#BDBDBD',
          dark: '#262626',
        },
        ink: {
          primary: '#111111',
          secondary: '#555555',
          muted: '#858585',
          light: '#A3A3A3',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        hand: ['var(--font-hand)', 'cursive', 'sans-serif'],
      },
      boxShadow: {
        sketch: '2px 2px 0px 0px #111111',
        'sketch-lg': '4px 4px 0px 0px #111111',
        'sketch-sm': '1px 1px 0px 0px #111111',
        panel: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        card: '0 2px 10px -1px rgba(0, 0, 0, 0.04)',
        modal: '0 20px 40px -10px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out forwards',
        'pop-in': 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(3px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
