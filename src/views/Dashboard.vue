<template>
  <div>
    <div class="page-head">
      <div>
        <h2 style="font-size:28px">{{ t("dashboard.hello", { name: user.name }) }}</h2>
        <p class="muted">{{ org.name }}</p>
      </div>
      <RouterLink class="btn btn-accent" to="/estudios">{{ t("dashboard.newProject") }}</RouterLink>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="grid-3">
      <article class="card kpi">
        <strong>{{ subscribed.length }}</strong>
        <span>{{ t("dashboard.kpiProjects") }}</span>
      </article>
      <article class="card kpi">
        <strong>{{ members }}</strong>
        <span>{{ t("dashboard.kpiTeam") }}</span>
      </article>
      <article class="card kpi">
        <strong>{{ formatUsd(wallet.balanceUsd) }}</strong>
        <span>{{ t("dashboard.kpiWallet") }}</span>
      </article>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <article class="card">
        <h2>{{ t("dashboard.recentProjects") }}</h2>
        <p class="muted">{{ t("dashboard.recentHint") }}</p>
        <table class="table" style="margin-top:14px">
          <thead>
            <tr>
              <th>{{ t("dashboard.name") }}</th>
              <th>{{ t("projects.colMarket") }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!subscribed.length">
              <td colspan="3" class="muted">{{ t("dashboard.noProjects") }}</td>
            </tr>
            <tr v-for="p in subscribed.slice(0, 6)" :key="p.id">
              <td>
                <RouterLink :to="'/estudios/' + p.id"><strong>{{ p.name }}</strong></RouterLink>
              </td>
              <td><MarketFlag :market="p.market" /></td>
              <td>
                <span class="badge ok">{{ t("projects.subscribed") }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
      <article class="card">
        <h2>{{ t("dashboard.wallet") }}</h2>
        <p class="muted">{{ t("dashboard.walletHint") }}</p>
        <p style="margin:18px 0 8px">
          <strong>{{ formatUsd(wallet.balanceUsd) }}</strong>
        </p>
        <RouterLink class="btn btn-ghost" to="/facturacion">{{ t("dashboard.seeWallet") }}</RouterLink>
      </article>
    </div>
    <article class="card" style="margin-top:16px">
      <h2>{{ t("dashboard.boughtEditions") }}</h2>
      <p class="muted">{{ t("dashboard.boughtHint") }}</p>
      <table class="table" style="margin-top:14px">
        <thead>
          <tr>
            <th>{{ t("dashboard.name") }}</th>
            <th>{{ t("dashboard.colEdition") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!editions.length">
            <td colspan="3" class="muted">{{ t("dashboard.noBought") }}</td>
          </tr>
          <tr v-for="edition in editions" :key="edition.projectId + '-' + edition.id">
            <td>
              <RouterLink :to="'/estudios/' + edition.projectId"><strong>{{ edition.projectName }}</strong></RouterLink>
            </td>
            <td>{{ editionLabel(edition) }}</td>
            <td class="actions">
              <RouterLink class="btn btn-accent btn-sm" :to="editionPath(edition)">
                {{ t("projectDetail.consult") }}
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
    <LoadingModal v-if="loading" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api, getSession } from "../api";
import { apiMessage } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";
import MarketFlag from "../components/MarketFlag.vue";

const { t, te, locale } = useI18n();
const user = getSession() || { name: "" };
const org = ref({ name: "" });
const projects = ref([]);
const editions = ref([]);
const members = ref(0);
const wallet = ref({ balanceUsd: 0 });
const error = ref("");
const loading = ref(true);

const subscribed = computed(() => (projects.value || []).filter((p) => p.subscribed));

function formatUsd(value) {
  return new Intl.NumberFormat(locale.value, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatDay(value) {
  if (!value) return "";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return "";
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale.value, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function editionLabel(edition) {
  const start = formatDay(edition.fieldStartedAt);
  const end = formatDay(edition.fieldEndedAt);
  if (start && end) return start + " – " + end;
  return edition.purchasedAt || "—";
}

function editionPath(edition) {
  return "/estudios/" + edition.projectId + "/ediciones/" + edition.id;
}

onMounted(async () => {
  try {
    const me = await api("/me");
    org.value = me.org;
    if (me.wallet) wallet.value = me.wallet;
    const [proj, bought, team] = await Promise.all([
      api("/estudios"),
      api("/ediciones"),
      api("/team"),
    ]);
    projects.value = proj.projects || [];
    editions.value = bought.editions || [];
    members.value = (team.members || []).length;
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.dashboard.load_failed");
  } finally {
    loading.value = false;
  }
});
</script>
