/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Emnex brand — emerald green
        brand: {
          DEFAULT: '#20AA6E',
          light: '#2ECC85',
          dark: '#178A58',
          50: '#EAF8F1',
          100: '#CFEFE0',
          600: '#178A58',
          700: '#126E47',
        },
        // Dark sections (rails, headers, CTA)
        ink: {
          DEFAULT: '#1E1E1E',
          deep: '#141414',
          soft: '#2A2A2A',
        },
        // Light surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F3F7',
          sunken: '#E9ECF2',
        },
        line: {
          DEFAULT: '#E7EAE7',
          dark: '#333333',
        },
        // Text
        content: {
          DEFAULT: '#14201A',
          muted: '#5B6660',
          subtle: '#8A938D',
          invert: '#F4F6F4',
        },
        // Market direction (kept legible for candlestick charts)
        bull: '#20AA6E',
        bear: '#E5484D',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      maxWidth: {
        container: '76rem',
      },
      boxShadow: {
        soft: '0 18px 50px -24px rgba(20, 32, 26, 0.25)',
        card: '0 1px 2px rgba(20,32,26,0.04), 0 12px 32px -20px rgba(20,32,26,0.30)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out both',
        'fade-up': 'fadeUp 0.6s ease-out both',
        marquee: 'marquee 28s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [typography],
};
