import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MMDSP Color Scheme
        'mmdsp': {
          'bg-dark': '#000008',
          'bg-panel': '#000010',
          'bg-body': '#000004',
          'border': '#202048',
          'border-light': '#3030a0',
          'text-primary': '#40ff40',
          'text-secondary': '#6060c0',
          'text-dim': '#303080',
          'text-cyan': '#60a0ff',
          'text-yellow': '#b0b0d0',
          'text-white': '#a0a0e0',
          'key-white': '#101030',
          'key-black': '#000018',
          'keyon': '#00ff00',
          'level-bar': '#4080ff',
          'level-top': '#80c0ff',
        },
      },
      fontFamily: {
        'mmdsp': ['Menlo', 'Monaco', "'Courier New'", "'Liberation Mono'", 'monospace'],
        'share-tech': ['"Share Tech Mono"', 'monospace'],
        'jp': ['"MS Gothic"', '"Osaka-Mono"', '"Source Han Code JP"', '"Noto Sans Mono CJK JP"', '"Hiragino Kaku Gothic ProN"', 'monospace'],
      },
      boxShadow: {
        'mmdsp': 'inset 1px 1px 0 #3030a0, inset -1px -1px 0 #202048, 0 0 20px rgba(0, 100, 255, 0.2)',
        'mmdsp-panel': 'inset 1px 1px 0 rgba(255, 255, 255, 0.05)',
        'mmdsp-btn-hover': '0 0 8px rgba(96, 160, 255, 0.3)',
        'mmdsp-btn-active': '0 0 8px rgba(96, 160, 255, 0.5)',
      },
      animation: {
        'btn-pulse': 'btnPulse 2.5s ease-in-out infinite',
        'bubble-pulse': 'bubblePulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        btnPulse: {
          '0%, 100%': {
            background: 'linear-gradient(to bottom, #202060 0%, #101040 100%)',
            color: '#60a0ff',
            boxShadow: 'none',
          },
          '50%': {
            background: 'linear-gradient(to bottom, #305030 0%, #203020 100%)',
            color: '#80ff80',
            boxShadow: '0 0 20px rgba(100, 255, 100, 0.3), inset 0 0 10px rgba(100, 255, 100, 0.1)',
          },
        },
        bubblePulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
