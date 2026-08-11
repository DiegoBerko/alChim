import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0D0D0D',
        surface: '#1A1A1A',
        'surface-elevated': '#242424',
        border: '#2A2A2A',
        accent: '#F5A623',
        'accent-hover': '#E09520',
        'text-primary': '#FFFFFF',
        'text-secondary': '#999999',
      },
    },
  },
  plugins: [],
};

export default config;
