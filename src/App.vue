<template>
  <RouterView />
</template>

<script setup>
import { RouterView } from "vue-router";
import { watch } from "vue";
import { useI18n } from "vue-i18n";

const { locale, t } = useI18n();

watch(
  locale,
  (value) => {
    document.documentElement.lang = value;
    document.title = t("meta.title");
  },
  { immediate: true }
);
</script>
