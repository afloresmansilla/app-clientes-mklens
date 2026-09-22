<template>
  <div class="auth">
    <LangSwitch class="auth-lang" variant="dark" />
    <div class="auth-card">
      <div class="auth-brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 44 44" width="22" fill="none" stroke="#68f0c2" stroke-width="2.6">
            <path d="M10 11h11c7.2 0 13 5.8 13 13v9H23c-7.2 0-13-5.8-13-13v-9Z"/>
            <circle cx="24.5" cy="19.5" r="4.5"/>
          </svg>
        </span>
        {{ t("brand.name") }}
      </div>
      <h1>{{ t("auth.loginTitle") }}</h1>
      <p class="muted">{{ t("auth.subtitle") }}</p>
      <p v-if="notice" class="error">{{ notice }}</p>
      <form @submit.prevent="onSubmit">
        <div class="field">
          <label>{{ t("auth.email") }}</label>
          <input v-model="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          <label>{{ t("auth.password") }}</label>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn btn-accent" type="submit" :disabled="loading">
          {{ loading ? t("auth.processing") : t("auth.login") }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
      </form>
      <p class="muted" style="margin-top:16px">{{ t("auth.provisioned") }}</p>
    </div>
    <LoadingModal v-if="loading" />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { loginRequest, setSession } from "../api";
import { apiMessage } from "../i18n";
import LangSwitch from "../components/LangSwitch.vue";
import LoadingModal from "../components/LoadingModal.vue";

const { t, te } = useI18n();
const router = useRouter();
const route = useRoute();
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const notice = computed(() => {
  if (route.query.reason === "required") return t("auth.required");
  return "";
});

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    const res = await loginRequest(email.value, password.value);
    setSession(res.token, res.user);
    await router.replace({ name: "home" });
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.generic");
  } finally {
    loading.value = false;
  }
}
</script>
