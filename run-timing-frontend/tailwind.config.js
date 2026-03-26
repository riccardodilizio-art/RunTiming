/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                display: ['Barlow Condensed', 'sans-serif'],
                body: ['DM Sans', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                ocean: {
                    50:  '#f0f7ff',
                    100: '#dbeeff',
                    200: '#b8deff',
                    300: '#7cc3fd',
                    400: '#37a4f8',
                    500: '#0d87ea',
                    600: '#0168c8',
                    700: '#0152a2',
                    800: '#064785',
                    900: '#0a3c6e',
                    950: '#071f40',
                },
            },
            animation: {
                'fade-up': 'fadeUp 0.5s ease forwards',
            },
            keyframes: {
                fadeUp: {
                    '0%':   { opacity: '0', transform: 'translateY(16px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
