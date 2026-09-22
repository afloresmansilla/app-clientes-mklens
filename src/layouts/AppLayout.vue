<template>
  <div class="shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 44 44"><path d="M10 11h11c7.2 0 13 5.8 13 13v9H23c-7.2 0-13-5.8-13-13v-9Z"/><circle cx="24.5" cy="19.5" r="4.5"/></svg>
        </span>
        <span>{{ t("brand.name") }}<small>{{ t("brand.clientArea") }}</small></span>
      </RouterLink>
      <nav class="side-nav">
        <RouterLink to="/">{{ t("nav.home") }}</RouterLink>
        <RouterLink to="/estudios">{{ t("nav.projects") }}</RouterLink>
        <RouterLink to="/equipo">{{ t("nav.team") }}</RouterLink>
        <RouterLink to="/facturacion">{{ t("nav.billing") }}</RouterLink>
        <RouterLink to="/ajustes">{{ t("nav.settings") }}</RouterLink>
      </nav>
      <div class="side-foot">
        <strong>{{ session.company || t("nav.organization") }}</strong>
        <span>{{ session.name || "" }}</span>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <h1>{{ title }}</h1>
        <div class="topbar-actions">
          <LangSwitch />
          <button class="btn btn-ghost" type="button" @click="onLogout">{{ t("nav.logout") }}</button>
        </div>
      </header>
      <nav class="mobile-nav">
        <RouterLink to="/">{{ t("nav.home") }}</RouterLink>
        <RouterLink to="/estudios">{{ t("nav.projects") }}</RouterLink>
        <RouterLink to="/equipo">{{ t("nav.team") }}</RouterLink>
        <RouterLink to="/facturacion">{{ t("nav.billing") }}</RouterLink>
        <RouterLink to="/ajustes">{{ t("nav.settings") }}</RouterLink>
      </nav>
      <div class="page">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { clearSession, getSession, logoutRequest } from "../api";
import LangSwitch from "../components/LangSwitch.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const session = getSession() || {};
const title = computed(() => t("nav.titles." + (route.name || "home")));

async function onLogout() {
  await logoutRequest();
  clearSession();
  router.replace({ name: "login" });
}
</script>
