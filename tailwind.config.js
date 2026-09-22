/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FFFFFF', // pure white body canvas (was a warm putty-cream #F3F0EE — flattened to white per feedback that the tint felt tiring on the eyes)
        'canvas-lift': '#F6F6F5', // one step off pure white, for nested "raised" sections to stay visible now that canvas itself is white
        bone: '#F4F4F4', // cool-neutral alt surface
        ink: {
          DEFAULT: '#141413', // ink black — primary text, primary CTA, footer
          soft: '#262627', // charcoal — muted heading/eyebrow alternate
          2: '#2B2B2A', // hover/pressed variant of ink
        },
        coral: {
          DEFAULT: '#CF4500', // signal orange — decorative accent (dots, arcs, washes) only
          light: '#F37338', // light signal orange — orbital arcs, decorative
          bg: '#FBE4D8', // pale orange wash for icon halos / badges
          deep: '#9A3A0A', // clay brown — for any actual coral *text* (AA-safe on canvas)
        },
        slate: {
          DEFAULT: '#696969', // muted secondary text
        },
        taupe: '#D1CDC7', // whisper / disabled text on canvas
        link: '#3860BE', // inline link blue
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'system-ui',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        hero: ['56px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'hero-md': ['64px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2-md': ['36px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h3: ['22px', { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        eyebrow: ['13px', { lineHeight: '1', letterSpacing: '0.06em', fontWeight: '700' }],
        body: ['16px', { lineHeight: '1.6', fontWeight: '450' }],
        'body-lg': ['18px', { lineHeight: '1.65', fontWeight: '450' }],
        nav: ['16px', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '600' }],
        footer: ['14px', { lineHeight: '1.5', fontWeight: '450' }],
      },
      borderRadius: {
        btn: '20px',
        card: '40px',
        pill: '999px',
      },
      boxShadow: {
        1: '0 4px 24px rgba(0, 0, 0, 0.04)',
        2: '0 24px 48px rgba(0, 0, 0, 0.08)',
        3: '0 70px 110px rgba(0, 0, 0, 0.25)',
      },
      spacing: {
        4.5: '18px',
        18: '72px',
        22: '88px',
      },
      maxWidth: {
        content: '1240px',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
