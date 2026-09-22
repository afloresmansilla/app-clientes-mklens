<template>
  <div>
    <div class="page-head">
      <div>
        <p class="muted" style="margin:0">{{ t("projects.subtitle") }}</p>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!loading && !projects.length" class="muted">{{ t("projects.noProjects") }}</p>

    <section v-for="group in groupedProjects" :key="group.product" class="project-source">
      <div class="project-source-head">
        <div>
          <h3 class="project-source-title">
            <ProductIcon :product="group.product" />
          </h3>
          <p class="muted" style="margin:4px 0 0">
            {{ group.projects.length }}
            {{ group.projects.length === 1 ? t("projects.sourceOne") : t("projects.sourceMany") }}
          </p>
        </div>
      </div>
      <article class="card">
        <table class="table">
          <thead>
            <tr>
              <th>{{ t("projects.colSource") }}</th>
              <th>{{ t("projects.colMarket") }}</th>
              <th>{{ t("projects.colMissions") }}</th>
              <th>{{ t("projects.colStatus") }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in group.projects" :key="p.id">
              <td>
                <div class="project-name-cell">
                  <ProjectLogo :project="p" />
                  <RouterLink :to="'/estudios/' + p.id"><strong>{{ p.sourceName || p.name }}</strong></RouterLink>
                </div>
              </td>
              <td><MarketFlag :market="p.market" /></td>
              <td>{{ t("projects.missionsCount", { n: p.missionsCount }) }}</td>
              <td>
                <span class="badge" :class="statusClass(p.status)">{{ projectStatusLabel(p.status) }}</span>
                <span v-if="p.subscribed" class="badge ok" style="margin-left:6px">{{ t("projects.subscribed") }}</span>
              </td>
              <td class="actions">
                <RouterLink class="btn btn-ghost btn-sm" :to="'/estudios/' + p.id">
                  {{ t("projects.viewMissions") }}
                </RouterLink>
                <button
                  v-if="!p.subscribed"
                  class="btn btn-accent btn-sm"
                  type="button"
                  :disabled="busyId === p.id"
                  @click="subscribe(p)"
                >
                  {{ busyId === p.id ? t("projects.subscribing") : t("projects.subscribe") }}
                </button>
                <button
                  v-else
                  class="btn btn-danger btn-sm"
                  type="button"
                  :disabled="busyId === p.id"
                  @click="unsubscribe(p)"
                >
                  {{ busyId === p.id ? t("projects.unsubscribing") : t("projects.unsubscribe") }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
    <LoadingModal v-if="loading || busyId" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { apiMessage, labelOf } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";
import MarketFlag from "../components/MarketFlag.vue";
import ProductIcon from "../components/ProductIcon.vue";
import ProjectLogo from "../components/ProjectLogo.vue";

const PRODUCT_ORDER = ["autos", "motos", "hogar", "vidariesgo", "salud", "diversos"];

const { t, te } = useI18n();
const projects = ref([]);
const error = ref("");
const busyId = ref("");
const loading = ref(true);

const groupedProjects = computed(() => {
  const groups = new Map();
  for (const product of PRODUCT_ORDER) {
    groups.set(product, { product, projects: [] });
  }
  for (const project of projects.value) {
    const key = PRODUCT_ORDER.includes(project.product) ? project.product : "diversos";
    if (!groups.has(key)) groups.set(key, { product: key, projects: [] });
    groups.get(key).projects.push(project);
  }
  return Array.from(groups.values()).filter((group) => group.projects.length);
});

function statusClass(status) {
  if (status === "active" || status === "activo") return "ok";
  if (status === "open") return "warn";
  return "idle";
}

function projectStatusLabel(status) {
  return labelOf(t, te, "projectStatus", status);
}

async function subscribe(project) {
  error.value = "";
  busyId.value = project.id;
  try {
    await api("/estudios/" + project.id + "/subscribe", { method: "POST" });
    const proj = await api("/estudios");
    projects.value = proj.projects || [];
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.subscribe_failed");
  } finally {
    busyId.value = "";
  }
}

async function unsubscribe(project) {
  error.value = "";
  busyId.value = project.id;
  try {
    await api("/estudios/" + project.id + "/unsubscribe", { method: "POST" });
    const proj = await api("/estudios");
    projects.value = proj.projects || [];
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.unsubscribe_failed");
  } finally {
    busyId.value = "";
  }
}

onMounted(async () => {
  try {
    const proj = await api("/estudios");
    projects.value = proj.projects || [];
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.projects.load_failed");
  } finally {
    loading.value = false;
  }
});
</script>
