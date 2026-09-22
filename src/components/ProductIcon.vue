<template>
  <span class="meta-cell">
    <span class="meta-icon" :class="'is-' + kind" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="kind === 'auto'">
          <path d="M4 14 5.6 8.8A2 2 0 0 1 7.5 7.5h9a2 2 0 0 1 1.9 1.3L20 14" />
          <path d="M3.5 14h17v4.5h-17z" />
          <circle cx="7.2" cy="18.6" r="1.4" />
          <circle cx="16.8" cy="18.6" r="1.4" />
          <path d="M7 10.5h10" />
        </template>
        <template v-else-if="kind === 'moto'">
          <circle cx="6.4" cy="16.8" r="2.6" />
          <circle cx="17.6" cy="16.8" r="2.6" />
          <path d="M6.4 16.8 10.2 9h4.2L17.6 16.8" />
          <path d="M10.4 9h3.2L16.2 6.2H20" />
          <path d="M12.6 9 11 12.8" />
        </template>
        <template v-else-if="kind === 'home'">
          <path d="M4 11.5 12 4.5l8 7" />
          <path d="M6.5 10.8V20h11V10.8" />
          <path d="M10 20v-5.4h4V20" />
        </template>
        <template v-else-if="kind === 'health'">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8.2v7.6M8.2 12h7.6" />
        </template>
        <template v-else-if="kind === 'life'">
          <path d="M12 3.5 19.5 6.4v5.8c0 4.8-3.3 8.2-7.5 9.8-4.2-1.6-7.5-5-7.5-9.8V6.4L12 3.5z" />
          <path d="M8.8 12.2 11 14.4l4.2-4.3" />
        </template>
        <template v-else>
          <rect x="4" y="4" width="7" height="7" rx="1.6" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" />
        </template>
      </svg>
    </span>
    <span>{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { labelOf } from "../i18n";

const props = defineProps({
  product: { type: String, default: "" },
});

const { t, te } = useI18n();
const label = computed(() => labelOf(t, te, "products", props.product));
const kind = computed(() => {
  const key = String(props.product || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (key.includes("moto")) return "moto";
  if (key.includes("auto") || key === "motor") return "auto";
  if (key.includes("hogar") || key.includes("home") || key.includes("casa")) return "home";
  if (key.includes("salud") || key.includes("health")) return "health";
  if (key.includes("vida") || key.includes("life") || key.includes("riesgo")) return "life";
  return "other";
});
</script>
