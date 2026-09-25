<script setup lang="ts">
// Decorative "credential card" mockup - not real data, purely to make the
// hero visually demonstrate the product (a signed, verifiable credential)
// rather than describe it in text alone. Pure CSS/markup, no image asset.
const qrPattern = '1110110100110110011010101'.split('').map(Number)
</script>

<template>
  <div class="relative w-full max-w-sm mx-auto select-none" style="perspective: 1200px;">
    <!-- Back card: depth/stack effect -->
    <div
      class="absolute inset-0 translate-x-4 translate-y-6 rotate-2 rounded-2xl bg-white border border-text-primary/10"
      aria-hidden="true"
    />

    <!-- Front card -->
    <div
      class="card-float relative rounded-2xl bg-white border border-text-primary/10 shadow-sm p-6 md:p-7"
      style="--card-tilt: -2deg;"
    >
      <!-- Precision corner marks - a deliberate "instrument", not a poster -->
      <span class="absolute -top-2 -left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-primary/50" aria-hidden="true" />
      <span class="absolute -bottom-2 -right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-primary/50" aria-hidden="true" />

      <!-- Top row -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-text-primary flex items-center justify-center">
            <BaseIcon collection="heroicons" name="shield-check" class="size-4 text-white" />
          </div>
          <span class="font-mono text-[11px] font-semibold tracking-widest text-text-secondary">CERTRUST</span>
        </div>
        <!-- Status cycles Draft -> Issued -> Verified on a loop, holding
             longest on Verified - shows the whole issuing flow without
             turning the hero into a multi-panel animation. All three states
             are stacked and sized to the widest (an invisible sizer reserves
             the box), so the pill never changes width as it cycles. -->
        <span class="relative inline-flex h-[22px]">
          <span class="invisible inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap">
            <span class="size-1.5" />VERIFIED
          </span>

          <span class="status-pill status-draft absolute inset-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full border border-text-primary/15 text-text-secondary font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap">
            <span class="size-1.5 rounded-full bg-text-primary/30" />
            DRAFT
          </span>
          <span class="status-pill status-issued absolute inset-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 text-primary font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap">
            <span class="size-1.5 rounded-full bg-primary" />
            ISSUED
          </span>
          <span class="status-pill status-verified absolute inset-0 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 text-primary font-mono text-[10px] font-semibold tracking-wider whitespace-nowrap">
            <span class="relative flex size-1.5">
              <span class="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
              <span class="relative inline-flex rounded-full size-1.5 bg-primary" />
            </span>
            VERIFIED
          </span>
        </span>
      </div>

      <!-- Title -->
      <p class="font-mono text-[10px] uppercase tracking-widest text-text-secondary/70 mb-1.5">
        Certificate of Completion
      </p>
      <h3 class="font-display font-bold text-xl text-text-primary mb-1 text-balance">
        Advanced Cloud Security
      </h3>
      <p class="text-sm text-text-secondary mb-6">
        Awarded to <span class="font-medium text-text-primary">Jane Doe</span>
      </p>

      <!-- Bottom row: QR + signature -->
      <div class="flex items-end justify-between pt-5 border-t border-dashed border-text-primary/15">
        <div class="grid grid-cols-5 gap-0.5" aria-hidden="true">
          <div
            v-for="(filled, i) in qrPattern"
            :key="i"
            class="w-1.5 h-1.5 rounded-[1px]"
            :class="filled ? 'bg-text-primary' : 'bg-text-primary/10'"
          />
        </div>
        <div class="text-right">
          <p class="font-mono text-[9px] text-text-secondary/60 mb-0.5">
            ED25519 SIGNATURE
          </p>
          <p class="font-mono text-[11px] text-text-primary/80">
            0x8F3A…E91C
          </p>
        </div>
      </div>
    </div>

    <!-- Recipient toast: pops in partway through the pill's "Verified"
         window and clears before it loops back to Draft - a second beat
         after the first ("issuer verifies it" -> "recipient gets it and
         shows it off") rather than two things happening at once. Reuses
         Jane Doe from the card above rather than inventing a second name,
         so the two elements read as one continuous moment. -->
    <div
      class="toast-pop absolute -bottom-6 -left-10 flex items-center gap-2.5 rounded-xl bg-white border border-text-primary/10 shadow-md px-3.5 py-2.5 pointer-events-none"
      aria-hidden="true"
    >
      <div class="relative flex-none w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
        <span class="font-display font-bold text-[11px] text-primary">JD</span>
        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white flex items-center justify-center">
          <BaseIcon collection="heroicons" name="check" class="size-2 text-white" />
        </span>
      </div>
      <div class="leading-tight">
        <p class="text-xs font-semibold text-text-primary whitespace-nowrap">
          Jane just verified
        </p>
        <p class="font-mono text-[9px] text-text-secondary/70 uppercase tracking-wide">
          Shared to LinkedIn
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 6s loop: Draft (0-20%) -> Issued (20-40%) -> Verified (40-100%, the long
   hold) -> instant cut back to Draft. Each segment's fade is ~200ms; the
   loop seam (Verified opacity 1 at 100% cutting to Draft opacity 1 at 0%)
   is deliberately a hard cut, not a cross-fade - keeps the swap crisp
   rather than muddying two states together for a frame. */
@keyframes status-draft {
  0%, 16.5% { opacity: 1; }
  20%, 100% { opacity: 0; }
}
@keyframes status-issued {
  0%, 20% { opacity: 0; }
  23.5%, 36.5% { opacity: 1; }
  40%, 100% { opacity: 0; }
}
@keyframes status-verified {
  0%, 40% { opacity: 0; }
  43.5%, 100% { opacity: 1; }
}
.status-draft {
  animation: status-draft 6s linear infinite;
}
.status-issued {
  animation: status-issued 6s linear infinite;
}
.status-verified {
  animation: status-verified 6s linear infinite;
}

/* The global reduced-motion rule (main.css) only crushes animation
   *duration*, which would make this cycle strobe through all three states
   near-instantly instead of stopping - pin it to the resting/final state
   instead, overriding the animated opacity directly (author !important
   outranks a running CSS animation in the cascade). */
@media (prefers-reduced-motion: reduce) {
  .status-draft,
  .status-issued {
    opacity: 0 !important;
  }
  .status-verified {
    opacity: 1 !important;
  }
}

/* Synced to the same 6s cycle as the status pill: appears a beat after the
   pill settles on Verified (46%), clears well before the loop cuts back to
   Draft (93%) - two sequential beats, not two things fighting for
   attention at once. */
@keyframes toast-pop {
  0%, 46% { opacity: 0; transform: translateY(10px) scale(0.94); }
  50%, 88% { opacity: 1; transform: translateY(0) scale(1); }
  93%, 100% { opacity: 0; transform: translateY(10px) scale(0.94); }
}
.toast-pop {
  animation: toast-pop 6s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .toast-pop {
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
