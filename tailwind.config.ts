import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { cinnabar: '#8f302c', gold: '#b58b47', ink: '#342820', paper: '#f3eddf', wood: '#241e1a' },
      fontFamily: { royal: ['Georgia', 'Times New Roman', 'serif'] },
    },
  },
  plugins: [],
} satisfies Config;
