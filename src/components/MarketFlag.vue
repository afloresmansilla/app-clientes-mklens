<template>
  <span class="meta-cell">
    <span v-if="emoji" class="meta-flag" aria-hidden="true">{{ emoji }}</span>
    <span>{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { labelOf } from "../i18n";

const props = defineProps({
  market: { type: String, default: "" },
});

const { t, te } = useI18n();

const ALIASES = {
  ESPANA: "ES",
  ESPAÑA: "ES",
  SPAIN: "ES",
  PORTUGAL: "PT",
  FRANCE: "FR",
  FRANCIA: "FR",
  ITALY: "IT",
  ITALIA: "IT",
  GERMANY: "DE",
  ALEMANIA: "DE",
  DEUTSCHLAND: "DE",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  "REINO UNIDO": "GB",
  "ESTADOS UNIDOS": "US",
  "UNITED STATES": "US",
  USA: "US",
  MEXICO: "MX",
  MÉXICO: "MX",
  ARGENTINA: "AR",
  COLOMBIA: "CO",
};

function marketCode(value) {
  const raw = String(value || "").trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const upper = raw.toUpperCase();
  if (ALIASES[upper]) return ALIASES[upper];
  if (te("markets." + raw)) return raw.toUpperCase();
  return "";
}

const code = computed(() => marketCode(props.market));
const label = computed(() => labelOf(t, te, "markets", props.market || code.value));
const emoji = computed(() => {
  if (!/^[A-Z]{2}$/.test(code.value)) return "";
  return String.fromCodePoint(...[...code.value].map((char) => 127397 + char.charCodeAt(0)));
});
</script>
