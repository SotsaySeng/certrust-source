import { defineConfig, presetAttributify, presetIcons, presetUno } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      collections: {
        'simple-icons': () => import('@iconify-json/simple-icons/icons.json').then(i => i.default),
        'heroicons': () => import('@iconify-json/heroicons/icons.json').then(i => i.default),
      },
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
  safelist: [
    // Simple Icons for sponsors
    'i-simple-icons-slack',
    'i-simple-icons-netflix',
    'i-simple-icons-fitbit',
    'i-simple-icons-google',
    'i-simple-icons-airbnb',
    'i-simple-icons-uber',
    // Template-type icons (constants/templateTypes.ts) - only ever
    // referenced indirectly via getTemplateTypeIcon()'s lookup table in a
    // .ts file, so UnoCSS's static scanner can't discover them the way it
    // discovers a literal class string typed directly into a .vue
    // template. Used by issue.vue and pages/design-templates/*. This file
    // is the sole source of truth for safelist/presets/theme - @unocss/nuxt
    // shallow-merges (Object.assign) nuxt.config.ts's `unocss` block under
    // whatever this file exports, so any key both files set would have
    // this file's value win outright (verified against
    // node_modules/@unocss/config/dist/index.mjs). nuxt.config.ts's
    // `unocss` block now only sets `preflight`, the one option that
    // bypasses that merge entirely - see its comment for why.
    'i-heroicons-star',
    'i-heroicons-academic-cap',
    'i-heroicons-document-text',
    'i-heroicons-clipboard-document-check',
    'i-heroicons-clipboard-document-list',
    'i-heroicons-envelope-open',
    // Header "Manage" menu icons (MANAGE_MENU_LINKS in constants/index.ts),
    // same indirect-reference reason as above.
    'i-heroicons-home',
    'i-heroicons-paper-airplane',
    'i-heroicons-plus-circle',
    'i-heroicons-paint-brush',
    'i-heroicons-calendar-days',
  ],
  theme: {
    colors: {
      primary: '#28A745',
      secondary: '#E9F7EC',
      background: {
        light: '#FFFFFF',
        pink: '#F1FBF3'
      },
      text: {
        primary: '#1B2420',
        secondary: '#4B5A50'
      }
    },
    fontFamily: {
      sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
      display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
    }
  }
})
