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
                // Brand palette — "flame" orange. Single source of truth for the
                // whole UI theme; swap these values to re-theme the entire app.
                brand: {
                    50:  '#fff5ed',
                    100: '#ffe8d4',
                    200: '#fecdaa',
                    300: '#fdac74',
                    400: '#fb8038',
                    500: '#f75a1b',
                    600: '#e8430a',
                    700: '#be3208',
                    800: '#972a0e',
                    900: '#7a2510',
                    950: '#420f05',
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
