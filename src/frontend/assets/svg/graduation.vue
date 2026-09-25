<template>
  <svg class="w-full h-auto" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Certificate document -->
    <rect x="120" y="80" width="260" height="330" rx="14" fill="white" stroke="#1B2420" stroke-width="3" />
    <rect x="155" y="130" width="130" height="13" rx="6.5" fill="#1B2420" />
    <rect x="155" y="168" width="190" height="7" rx="3.5" fill="#1B2420" fill-opacity="0.2" />
    <rect x="155" y="190" width="190" height="7" rx="3.5" fill="#1B2420" fill-opacity="0.2" />
    <rect x="155" y="212" width="150" height="7" rx="3.5" fill="#1B2420" fill-opacity="0.2" />
    <rect x="155" y="248" width="120" height="10" rx="5" fill="#28A745" fill-opacity="0.85" />

    <!-- Ribbon tails -->
    <path d="M276 436L268 488L294 468L288 436Z" fill="#1B2420" />
    <path d="M320 436L326 488L300 468L306 436Z" fill="#1B2420" />

    <!-- Verification pulse, echoing the hero credential card's VERIFIED badge -->
    <circle class="seal-pulse" cx="300" cy="400" r="44" fill="none" stroke="#28A745" stroke-width="3" />
    <circle class="seal-pulse seal-pulse--delay" cx="300" cy="400" r="44" fill="none" stroke="#28A745" stroke-width="3" />

    <!-- Seal -->
    <circle cx="300" cy="400" r="44" fill="#28A745" />
    <path d="M280 400l16 16 26-30" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </svg>
</template>

<style scoped>
@keyframes seal-pulse {
  0% { transform: scale(1); opacity: 0.55; }
  100% { transform: scale(1.7); opacity: 0; }
}
.seal-pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: seal-pulse 2.6s ease-out infinite;
}
.seal-pulse--delay {
  animation-delay: 1.3s;
}
</style>
