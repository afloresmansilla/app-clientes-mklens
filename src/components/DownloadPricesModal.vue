<template>
  <Teleport to="body">
    <div class="dialog-modal" role="dialog" aria-modal="true" :aria-label="t('parseo.downloadTitle')" @click.self="close">
      <div class="dialog-card">
        <header class="dialog-head">
          <div>
            <h2>{{ t("parseo.downloadTitle") }}</h2>
            <p class="muted">{{ t("parseo.downloadHint") }}</p>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" @click="close">{{ t("parseo.close") }}</button>
        </header>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="picker-grid">
          <section class="picker-col">
            <header>
              <strong>{{ t("parseo.downloadCovers") }}</strong>
              <button class="link-btn" type="button" @click="toggleAll('covers')">
                {{ allCoversSelected ? t("parseo.selectNone") : t("parseo.selectAll") }}
              </button>
            </header>
            <div class="picker-list">
              <label v-for="item in covers" :key="item.cover" class="picker-item">
                <input v-model="selectedCovers" type="checkbox" :value="item.cover" />
                <span>{{ coverLabel(item.cover) }}</span>
                <small>{{ formatNumber(item.quotes) }}</small>
              </label>
            </div>
          </section>
          <section class="picker-col">
            <header>
              <strong>{{ t("parseo.downloadBrands") }}</strong>
              <button class="link-btn" type="button" @click="toggleAll('brands')">
                {{ allBrandsSelected ? t("parseo.selectNone") : t("parseo.selectAll") }}
              </button>
            </header>
            <div class="picker-list">
              <label v-for="brand in brands" :key="brand.brandId" class="picker-item">
                <input v-model="selectedBrands" type="checkbox" :value="brand.brandId" />
                <span>{{ brand.brandName }}</span>
              </label>
            </div>
          </section>
        </div>
        <label class="picker-item include-sample">
          <input v-model="includeSample" type="checkbox" />
          <span>{{ t("parseo.includeSample") }}</span>
        </label>
        <footer class="dialog-actions">
          <p class="muted">{{ t("parseo.downloadReady", { covers: selectedCovers.length, brands: selectedBrands.length }) }}</p>
          <button class="btn btn-ghost" type="button" :disabled="busy" @click="close">{{ t("parseo.cancel") }}</button>
          <button class="btn btn-accent" type="button" :disabled="busy || !canDownload" @click="confirm">
            {{ busy ? t("parseo.downloading") : t("parseo.downloadExcel") }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { labelOf } from "../i18n";

const props = defineProps({
  covers: { type: Array, default: () => [] },
  brands: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  error: { type: String, default: "" },
});

const emit = defineEmits(["close", "download"]);
const { t, te, locale } = useI18n();
const selectedCovers = ref([]);
const selectedBrands = ref([]);
const includeSample = ref(true);

const allCoversSelected = computed(
  () => props.covers.length > 0 && selectedCovers.value.length === props.covers.length
);
const allBrandsSelected = computed(
  () => props.brands.length > 0 && selectedBrands.value.length === props.brands.length
);
const canDownload = computed(() => selectedCovers.value.length > 0 && selectedBrands.value.length > 0);

function coverLabel(cover) {
  return labelOf(t, te, "covers", cover);
}

function formatNumber(value) {
  return new Intl.NumberFormat(locale.value).format(Number(value || 0));
}

function resetSelection() {
  selectedCovers.value = props.covers.map((item) => item.cover);
  selectedBrands.value = props.brands.map((brand) => brand.brandId);
}

function toggleAll(kind) {
  if (kind === "covers") {
    selectedCovers.value = allCoversSelected.value ? [] : props.covers.map((item) => item.cover);
    return;
  }
  selectedBrands.value = allBrandsSelected.value ? [] : props.brands.map((brand) => brand.brandId);
}

function close() {
  if (props.busy) return;
  emit("close");
}

function confirm() {
  if (!canDownload.value || props.busy) return;
  const coverLabels = {};
  selectedCovers.value.forEach((cover) => {
    coverLabels[cover] = coverLabel(cover);
  });
  emit("download", {
    covers: selectedCovers.value.slice(),
    brands: selectedBrands.value.slice(),
    coverLabels,
    includeSample: includeSample.value,
  });
}

function onKey(event) {
  if (event.key === "Escape") close();
}

watch(() => [props.covers, props.brands], resetSelection, { deep: true });
onMounted(() => {
  resetSelection();
  window.addEventListener("keydown", onKey);
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});
</script>
