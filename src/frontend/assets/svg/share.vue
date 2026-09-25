<template>
  <svg class="w-full h-auto" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Recipient -->
    <path d="M160 420C160 320 195 260 250 260C305 260 340 320 340 420" fill="white" stroke="#1B2420" stroke-width="3" />
    <rect x="238" y="218" width="24" height="48" fill="white" stroke="#1B2420" stroke-width="3" />
    <circle cx="250" cy="170" r="55" fill="white" stroke="#1B2420" stroke-width="3" />
    <circle cx="231" cy="162" r="4.5" fill="#1B2420" />
    <circle cx="269" cy="162" r="4.5" fill="#1B2420" />
    <path d="M226 184Q250 202 274 184" stroke="#1B2420" stroke-width="4" stroke-linecap="round" fill="none" />

    <!-- Sparkle -->
    <path d="M372 96l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" fill="#28A745" />

    <!-- Phone with credential badge -->
    <rect x="222" y="300" width="56" height="98" rx="10" fill="white" stroke="#1B2420" stroke-width="3" />
    <circle cx="250" cy="349" r="17" fill="#28A745" />
    <path d="M241 349l6 7 12-14" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />

    <!-- Share signal, flowing from the credential toward each platform -->
    <path class="signal" d="M278 313L353 213" stroke="#28A745" stroke-width="2.5" stroke-dasharray="1 9" stroke-linecap="round" />
    <path class="signal signal--2" d="M278 340L378 300" stroke="#28A745" stroke-width="2.5" stroke-dasharray="1 9" stroke-linecap="round" />
    <path class="signal signal--3" d="M278 367L353 380" stroke="#28A745" stroke-width="2.5" stroke-dasharray="1 9" stroke-linecap="round" />

    <!-- Platforms - real marks from this project's existing simple-icons dependency -->
    <g class="node-arrive" style="animation-delay: 0ms">
      <rect x="338" y="196" width="34" height="34" rx="10" fill="white" stroke="#1B2420" stroke-width="2.5" />
      <svg x="346" y="204" width="18" height="18" viewBox="0 0 24 24">
        <path fill="#1B2420" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037c-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85c3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.06 2.06 0 0 1-2.063-2.065a2.064 2.064 0 1 1 2.063 2.065m1.782 13.019H3.555V9h3.564zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
      </svg>
    </g>
    <g class="node-arrive" style="animation-delay: 350ms">
      <rect x="362" y="282" width="34" height="34" rx="10" fill="white" stroke="#1B2420" stroke-width="2.5" />
      <svg x="370" y="290" width="18" height="18" viewBox="0 0 24 24">
        <path fill="#1B2420" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967c-.273-.099-.471-.148-.67.15c-.197.297-.767.966-.94 1.164c-.173.199-.347.223-.644.075c-.297-.15-1.255-.463-2.39-1.475c-.883-.788-1.48-1.761-1.653-2.059c-.173-.297-.018-.458.13-.606c.134-.133.298-.347.446-.52s.198-.298.298-.497c.099-.198.05-.371-.025-.52s-.669-1.612-.916-2.207c-.242-.579-.487-.5-.669-.51a13 13 0 0 0-.57-.01c-.198 0-.52.074-.792.372c-.272.297-1.04 1.016-1.04 2.479c0 1.462 1.065 2.875 1.213 3.074s2.096 3.2 5.077 4.487c.709.306 1.262.489 1.694.625c.712.227 1.36.195 1.871.118c.571-.085 1.758-.719 2.006-1.413s.248-1.289.173-1.413c-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214l-3.741.982l.998-3.648l-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884c2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.9 11.9 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413" />
      </svg>
    </g>
    <g class="node-arrive" style="animation-delay: 700ms">
      <rect x="338" y="362" width="34" height="34" rx="10" fill="white" stroke="#1B2420" stroke-width="2.5" />
      <svg x="346" y="370" width="18" height="18" viewBox="0 0 24 24">
        <path fill="#1B2420" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978c.401 0 .955.042 1.468.103a9 9 0 0 1 1.141.195v3.325a9 9 0 0 0-.653-.036a27 27 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.7 1.7 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103l-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647" />
      </svg>
    </g>
  </svg>
</template>

<style scoped>
@keyframes node-arrive {
  0%, 8% { opacity: 0; transform: scale(0.5); }
  20%, 80% { opacity: 1; transform: scale(1); }
  92%, 100% { opacity: 0; transform: scale(0.5); }
}
.node-arrive {
  transform-box: fill-box;
  transform-origin: center;
  animation: node-arrive 2.6s ease-out infinite;
}

@keyframes signal-flow {
  to { stroke-dashoffset: -30; }
}
.signal {
  animation: signal-flow 0.7s linear infinite;
}
.signal--2 {
  animation-delay: -0.23s;
}
.signal--3 {
  animation-delay: -0.46s;
}
</style>
