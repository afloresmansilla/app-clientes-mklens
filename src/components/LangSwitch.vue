<template>
  <div class="lang-switch" :class="'is-' + variant" role="group" :aria-label="t('lang.label')">
    <button
      v-for="item in locales"
      :key="item.id"
      type="button"
      :class="{ 'is-active': locale === item.id }"
      :aria-pressed="locale === item.id"
      :title="t('lang.' + item.id)"
      @click="onPick(item.id)"
    >
      {{ item.short }}
    </button>
  </div>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { LOCALES, setLocale } from "../i18n";

defineProps({
  variant: { type: String, default: "light" },
});

const { t, locale } = useI18n();
const locales = LOCALES;

function onPick(id) {
  setLocale(id);
}
</script>
