<template>
  <Teleport to="body">
    <div class="loading-modal" role="dialog" aria-modal="true" aria-busy="true" aria-live="polite">
      <div class="loading-modal-body">
        <span class="spinner" aria-hidden="true"></span>
        <p>{{ label }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  text: { type: String, default: "" },
});

const { t } = useI18n();
const label = computed(() => props.text || t("common.loading"));
</script>
