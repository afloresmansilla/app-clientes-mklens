<template>
  <div v-if="project" class="project-detail">
    <p class="muted project-detail-back">
      <RouterLink to="/estudios">{{ t("projectDetail.back") }}</RouterLink>
    </p>
    <article class="card project-hero">
      <div class="project-hero-top">
        <div class="project-detail-identity">
          <ProjectLogo :project="project" size="lg" />
          <div class="project-hero-copy">
            <h2>{{ project.name }}</h2>
            <div class="project-chips">
              <span class="project-chip"><ProductIcon :product="project.product" /></span>
              <span class="project-chip"><MarketFlag :market="project.market" /></span>
              <span v-if="project.sourceName" class="project-chip">{{ project.sourceName }}</span>
            </div>
          </div>
        </div>
        <div class="project-hero-actions">
          <span class="badge" :class="statusClass(project.status)">{{ projectStatusLabel(project.status) }}</span>
          <span v-if="project.subscribed" class="badge ok">{{ t("projects.subscribed") }}</span>
          <button
            v-if="!project.subscribed"
            class="btn btn-accent"
            type="button"
            :disabled="busy"
            @click="subscribe"
          >
            {{ busy ? t("projects.subscribing") : t("projects.subscribe") }}
          </button>
          <button
            v-else
            class="btn btn-danger"
            type="button"
            :disabled="busy"
            @click="unsubscribe"
          >
            {{ busy ? t("projects.unsubscribing") : t("projects.unsubscribe") }}
          </button>
        </div>
      </div>
      <div
        v-if="hasHeroBody"
        class="project-hero-body"
        :class="{ 'has-brands': hasDescription && brands.length }"
      >
        <div v-if="hasDescription" class="project-hero-copy-block">
          <div
            v-if="description.body"
            class="project-description"
            v-html="description.body"
          />
          <dl v-if="description.facts.length" class="project-facts">
            <div v-for="fact in description.facts" :key="fact.label" class="project-fact">
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </div>
          </dl>
        </div>
        <aside v-if="brands.length" class="project-brands-panel">
          <h3>{{ t("projectDetail.brandsTitle") }}</h3>
          <p class="muted">{{ t("projectDetail.brandsCount", { n: brands.length }) }}</p>
          <div class="project-brand-grid">
            <div
              v-for="brand in brands"
              :key="brand.brandId"
              class="project-brand-tile"
              :title="brand.brandName"
            >
              <img
                :src="brand.logo"
                :alt="brand.brandName"
                @error="failLogo(brand.logo)"
              />
            </div>
          </div>
        </aside>
      </div>
    </article>
    <p v-if="error" class="error">{{ error }}</p>
    <article class="card project-editions">
      <div class="project-editions-head">
        <h2>{{ t("projectDetail.missionsTitle") }}</h2>
        <p class="muted">{{ t("projectDetail.missionsHint") }}</p>
      </div>
      <p v-if="!missions.length" class="muted" style="margin:0">{{ t("projectDetail.noMissions") }}</p>
      <div v-else class="edition-table">
        <div class="edition-row edition-row-head">
          <span>{{ t("projectDetail.colMission") }}</span>
          <span>{{ t("projectDetail.colPerformed") }}</span>
          <span>{{ t("projectDetail.colVerified") }}</span>
          <span>{{ t("projectDetail.colPurchase") }}</span>
          <span></span>
        </div>
        <div v-for="mission in missions" :key="mission.id" class="edition-row">
          <RouterLink :to="missionPath(mission)" class="edition-title">
            {{ editionTitle(mission) }}
          </RouterLink>
          <strong class="edition-num">{{ formatNumber(mission.pseudocompras) }}</strong>
          <strong class="edition-num">{{ formatNumber(mission.verifiedPseudocompras) }}</strong>
          <div class="edition-status">
            <span v-if="mission.purchased" class="badge ok">{{ t("projectDetail.bought") }}</span>
          </div>
          <div class="edition-action">
            <RouterLink class="btn btn-accent btn-sm" :to="missionPath(mission)">
              {{ t("projectDetail.consult") }}
            </RouterLink>
          </div>
        </div>
      </div>
    </article>
  </div>
  <article v-else-if="error" class="card empty">{{ error }}</article>
  <LoadingModal v-if="(!project && !error) || busy" />
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { splitDescriptionHtml } from "../html";
import { apiMessage, labelOf } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";
import MarketFlag from "../components/MarketFlag.vue";
import ProductIcon from "../components/ProductIcon.vue";
import ProjectLogo from "../components/ProjectLogo.vue";

const { t, te, locale } = useI18n();
const route = useRoute();
const project = ref(null);
const missions = ref([]);
const error = ref("");
const busy = ref(false);

const failedLogos = ref(new Set());
const description = computed(() => splitDescriptionHtml(project.value && project.value.description));
const brands = computed(() =>
  ((project.value && project.value.brands) || []).filter(
    (brand) => brand.logo && !failedLogos.value.has(brand.logo)
  )
);
const hasDescription = computed(() => Boolean(description.value.body || description.value.facts.length));
const hasHeroBody = computed(() => hasDescription.value || brands.value.length);

function failLogo(src) {
  const next = new Set(failedLogos.value);
  next.add(src);
  failedLogos.value = next;
}

function statusClass(status) {
  if (status === "active" || status === "activo") return "ok";
  if (status === "open") return "warn";
  return "idle";
}

function projectStatusLabel(status) {
  return labelOf(t, te, "projectStatus", status);
}

function missionPath(mission) {
  return "/estudios/" + route.params.id + "/ediciones/" + mission.id;
}

function formatNumber(value) {
  return new Intl.NumberFormat(locale.value).format(Number(value || 0));
}

function formatDay(value) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return new Intl.DateTimeFormat(locale.value, { day: "2-digit", month: "short", year: "numeric" }).format(value);
  }
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length === 3) {
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale.value, { day: "2-digit", month: "short", year: "numeric" }).format(date);
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale.value, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function editionTitle(mission) {
  const start = formatDay(mission.fieldStartedAt);
  const end = formatDay(mission.fieldEndedAt);
  if (start && end) return start + " – " + end;
  return (project.value && project.value.name) || mission.title;
}

function applyPayload(res) {
  project.value = res.project;
  missions.value = (res.missions || []).slice().sort((a, b) => {
    return String(b.fieldStartedAt || "").localeCompare(String(a.fieldStartedAt || ""));
  });
}

async function subscribe() {
  error.value = "";
  busy.value = true;
  try {
    const res = await api("/estudios/" + route.params.id + "/subscribe", { method: "POST" });
    applyPayload(res);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.subscribe_failed");
  } finally {
    busy.value = false;
  }
}

async function unsubscribe() {
  error.value = "";
  busy.value = true;
  try {
    const res = await api("/estudios/" + route.params.id + "/unsubscribe", { method: "POST" });
    applyPayload(res);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.unsubscribe_failed");
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    const res = await api("/estudios/" + route.params.id);
    applyPayload(res);
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.not_found");
  }
});
</script>
