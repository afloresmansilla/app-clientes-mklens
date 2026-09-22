<template>
  <img
    v-if="!failed && src"
    :class="imgClass"
    :src="src"
    :alt="alt"
    @error="failed = true"
  />
  <div v-else :class="imgClass + ' is-empty'" aria-hidden="true">{{ initial }}</div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  project: { type: Object, required: true },
  size: { type: String, default: "thumb" },
});

const failed = ref(false);

watch(
  () => [props.project && props.project.id, props.project && props.project.logoUrl],
  () => {
    failed.value = false;
  }
);

const src = computed(() => {
  if (props.project && props.project.logoUrl) return props.project.logoUrl;
  const id = props.project && props.project.id;
  return id ? "/api/estudios/" + id + "/logo" : "";
});

const imgClass = computed(() => (props.size === "lg" ? "project-logo-lg" : "project-logo-thumb"));

const alt = computed(() => (props.project && props.project.name) || "");

const initial = computed(() => {
  const letter = String((props.project && props.project.name) || "").trim().charAt(0);
  return letter ? letter.toUpperCase() : "?";
});
</script>
