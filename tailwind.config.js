/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        chippa: {
          ink: '#29232c', paper: '#fff8f4', berry: '#f22985', lilac: '#bba6f6',
          sky: '#9cd7f5', mint: '#cfe9bd', butter: '#ffe28c', peach: '#ffb18c'
        }
      },
      fontFamily: {
        display: ['Fredoka', 'Arial Rounded MT Bold', 'sans-serif'],
        sans: ['Montserrat', 'Arial', 'sans-serif'],
        hand: ['Caveat', 'cursive']
      },
      boxShadow: {
        paper: '0 10px 30px rgba(83, 51, 78, .08)',
        sticker: '0 6px 0 rgba(58, 42, 60, .12)'
      }
    }
  },
  plugins: []
};
