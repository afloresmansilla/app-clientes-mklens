<template>
  <div style="display:grid;gap:16px;max-width:640px">
    <article class="card">
      <h2>{{ t("settings.language") }}</h2>
      <p class="muted">{{ t("lang.hint") }}</p>
      <div class="field" style="margin-top:14px">
        <label>{{ t("lang.label") }}</label>
        <select :value="locale" @change="setLocale($event.target.value)">
          <option v-for="item in locales" :key="item.id" :value="item.id">{{ t("lang." + item.id) }}</option>
        </select>
      </div>
    </article>
    <article class="card">
      <h2>{{ t("settings.organization") }}</h2>
      <p class="muted">{{ t("settings.orgHint") }}</p>
      <form style="display:grid;gap:14px;margin-top:18px" @submit.prevent="onSave">
        <div class="field">
          <label>{{ t("settings.legalName") }}</label>
          <input v-model="org.name" required />
        </div>
        <div class="field">
          <label>{{ t("settings.taxId") }}</label>
          <input v-model="org.taxId" required />
        </div>
        <div class="field">
          <label>{{ t("settings.address") }}</label>
          <input v-model="org.address" required />
        </div>
        <div class="field">
          <label>{{ t("settings.billingEmail") }}</label>
          <input v-model="org.billingEmail" type="email" required />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="saving">{{ t("settings.save") }}</button>
        <p v-if="saved" class="muted">{{ t("settings.saved") }}</p>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </article>
    <LoadingModal v-if="loading || saving" />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { LOCALES, apiMessage, setLocale } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";

const { t, te, locale } = useI18n();
const locales = LOCALES;
const org = reactive({ name: "", taxId: "", address: "", billingEmail: "" });
const saved = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref("");

onMounted(async () => {
  try {
    const me = await api("/me");
    org.name = me.org.name || "";
    org.taxId = me.org.taxId || "";
    org.address = me.org.address || "";
    org.billingEmail = me.org.billingEmail || "";
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.generic");
  } finally {
    loading.value = false;
  }
});

async function onSave() {
  error.value = "";
  saved.value = false;
  saving.value = true;
  try {
    await api("/organization", { method: "PUT", body: { ...org } });
    saved.value = true;
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.org.save_failed");
  } finally {
    saving.value = false;
  }
}
</script>
