type RevealTrigger = 'enter' | 'visibleOnce'
type RevealStyle = 'fade-up' | 'scale-in'

/**
 * Fade+slide-up (or scale-in) v-motion variants for scroll reveal, gated on
 * prefers-reduced-motion: when reduced motion is preferred, elements render
 * fully visible immediately instead of animating.
 */
export function useRevealMotion() {
  const prefersReduced = usePreferredReducedMotion()

  return (delayMs = 0, trigger: RevealTrigger = 'visibleOnce', style: RevealStyle = 'fade-up') => {
    if (prefersReduced.value === 'reduce') {
      return {}
    }

    const initial = style === 'scale-in'
      ? { opacity: 0, scale: 0.92, y: 16 }
      : { opacity: 0, y: 24 }

    return {
      initial,
      [trigger]: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: style === 'scale-in' ? 700 : 500, delay: delayMs, ease: 'easeOut' },
      },
    }
  }
}
