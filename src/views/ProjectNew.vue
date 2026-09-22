<template>
  <article class="card" style="max-width:640px">
    <h2>{{ t("projectNew.title") }}</h2>
    <p class="muted">{{ t("projectNew.hint") }}</p>
    <form style="display:grid;gap:14px;margin-top:18px" @submit.prevent="onSubmit">
      <div class="field">
        <label>{{ t("projectNew.name") }}</label>
        <input v-model="name" required :placeholder="t('projectNew.namePlaceholder')" />
      </div>
      <div class="grid-2">
        <div class="field">
          <label>{{ t("projectNew.market") }}</label>
          <input v-model="market" required :placeholder="t('projectNew.marketPlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t("projectNew.product") }}</label>
          <select v-model="product" required>
            <option v-for="item in productKeys" :key="item" :value="item">{{ t("products." + item) }}</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>{{ t("projectNew.notes") }}</label>
        <textarea v-model="notes" rows="3" :placeholder="t('projectNew.notesPlaceholder')"></textarea>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-accent" type="submit" :disabled="loading">
          {{ loading ? t("projectNew.creating") : t("projectNew.create") }}
        </button>
        <RouterLink class="btn btn-ghost" to="/estudios">{{ t("projectNew.cancel") }}</RouterLink>
      </div>
    </form>
    <LoadingModal v-if="loading" />
  </article>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { apiMessage } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";

const { t, te } = useI18n();
const router = useRouter();
const name = ref("");
const market = ref("");
const product = ref("Autos");
const notes = ref("");
const loading = ref(false);
const error = ref("");
const productKeys = ["Autos", "Hogar", "Salud", "Vida", "Otro"];

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const res = await api("/estudios", {
      method: "POST",
      body: {
        name: name.value.trim(),
        market: market.value.trim(),
        product: product.value,
        notes: notes.value.trim(),
      },
    });
    router.push("/estudios/" + res.project.id);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.create_failed");
  } finally {
    loading.value = false;
  }
}
</script>
