<template>
  <svg class="w-full h-auto" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="90" y="110" width="320" height="280" rx="14" fill="white" stroke="#1B2420" stroke-width="3" />
    <path d="M90 164V124A14 14 0 0 1 104 110H396A14 14 0 0 1 410 124V164Z" fill="#28A745" />

    <line x1="170" y1="164" x2="170" y2="390" stroke="#1B2420" stroke-opacity="0.12" stroke-width="2" />
    <line x1="250" y1="164" x2="250" y2="390" stroke="#1B2420" stroke-opacity="0.12" stroke-width="2" />
    <line x1="330" y1="164" x2="330" y2="390" stroke="#1B2420" stroke-opacity="0.12" stroke-width="2" />
    <line x1="90" y1="238" x2="410" y2="238" stroke="#1B2420" stroke-opacity="0.12" stroke-width="2" />
    <line x1="90" y1="314" x2="410" y2="314" stroke="#1B2420" stroke-opacity="0.12" stroke-width="2" />

    <!-- Rows populating in sequence - a bulk CSV import settling in -->
    <g class="row-fill" style="animation-delay: 0ms">
      <rect x="106" y="196" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="186" y="196" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="266" y="196" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="346" y="196" width="48" height="8" rx="4" fill="#28A745" />
    </g>
    <g class="row-fill" style="animation-delay: 350ms">
      <rect x="106" y="272" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="186" y="272" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="266" y="272" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="346" y="272" width="48" height="8" rx="4" fill="#28A745" />
    </g>
    <g class="row-fill" style="animation-delay: 700ms">
      <rect x="106" y="348" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="186" y="348" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="266" y="348" width="48" height="8" rx="4" fill="#1B2420" fill-opacity="0.3" />
      <rect x="346" y="348" width="48" height="8" rx="4" fill="#28A745" />
    </g>
  </svg>
</template>

<style scoped>
@keyframes row-fill {
  0%, 6% { opacity: 0.25; transform: translateX(-8px); }
  18%, 82% { opacity: 1; transform: translateX(0); }
  94%, 100% { opacity: 0.25; transform: translateX(-8px); }
}
.row-fill {
  transform-box: fill-box;
  animation: row-fill 3.2s ease-in-out infinite;
}
</style>
