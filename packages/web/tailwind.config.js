/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wei: '#3b82f6',
        shu: '#dc2626',
        wu: '#16a34a',
        qun: '#ca8a04',
      },
    },
  },
  plugins: [],
};
