/**
 * v-motion `hovered` variant for card/button hover lift, gated on
 * prefers-reduced-motion (no-op when reduced motion is preferred). Merge
 * the result into the same object passed to v-motion alongside any
 * initial/enter keys - @vueuse/motion reads `hovered` as one more state
 * inside that single variants object, not as a separate prop/directive.
 */
export function useHoverLift(liftPx = 6, scale = 1.01) {
  const prefersReduced = usePreferredReducedMotion()

  if (prefersReduced.value === 'reduce') {
    return {}
  }

  return {
    hovered: {
      y: -liftPx,
      scale,
      transition: { duration: 220, ease: 'easeOut' },
    },
  }
}
