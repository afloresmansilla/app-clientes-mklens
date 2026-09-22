<template>
  <div>
    <div class="page-head">
      <p class="muted" style="margin:0">{{ t("team.count", { n: people.length }) }}</p>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="grid-2">
      <article class="card">
        <h2>{{ t("team.people") }}</h2>
        <table class="table" style="margin-top:12px">
          <thead>
            <tr><th>{{ t("team.name") }}</th><th>{{ t("team.role") }}</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="m in people" :key="m.id + m.email">
              <td>
                <strong>{{ m.name }}</strong>
                <div class="muted">{{ m.email }}</div>
              </td>
              <td>
                <span class="badge">
                  {{ roleLabel(m.role) }}{{ isInvited(m) ? t("team.invitedSuffix") : "" }}
                </span>
              </td>
              <td>
                <button
                  v-if="m.role !== 'admin' && !isInvited(m)"
                  class="btn btn-danger"
                  type="button"
                  @click="onRemove(m.id)"
                >
                  {{ t("team.remove") }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>
      <article class="card">
        <h2>{{ t("team.invite") }}</h2>
        <p class="muted">{{ t("team.inviteHint") }}</p>
        <form style="display:grid;gap:12px;margin-top:14px" @submit.prevent="onInvite">
          <div class="field">
            <label>{{ t("team.name") }}</label>
            <input v-model="name" required />
          </div>
          <div class="field">
            <label>{{ t("team.email") }}</label>
            <input v-model="email" type="email" required />
          </div>
          <div class="field">
            <label>{{ t("team.role") }}</label>
            <select v-model="role">
              <option value="admin">{{ t("roles.admin") }}</option>
              <option value="analista">{{ t("roles.analista") }}</option>
              <option value="visor">{{ t("roles.visor") }}</option>
            </select>
          </div>
          <button class="btn btn-primary" type="submit">{{ t("team.send") }}</button>
        </form>
      </article>
    </div>
    <LoadingModal v-if="loading" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api } from "../api";
import { apiMessage, labelOf } from "../i18n";
import LoadingModal from "../components/LoadingModal.vue";

const { t, te } = useI18n();
const members = ref([]);
const invitations = ref([]);
const name = ref("");
const email = ref("");
const role = ref("analista");
const error = ref("");
const loading = ref(true);

const people = computed(() => members.value.concat(invitations.value));

function isInvited(member) {
  return member.status === "invited" || member.status === "invitado";
}

function roleLabel(roleValue) {
  return labelOf(t, te, "roles", roleValue);
}

async function refresh() {
  const res = await api("/team");
  members.value = res.members || [];
  invitations.value = res.invitations || [];
}

async function onInvite() {
  error.value = "";
  loading.value = true;
  try {
    await api("/team/invite", {
      method: "POST",
      body: { name: name.value.trim(), email: email.value.trim(), role: role.value },
    });
    name.value = "";
    email.value = "";
    await refresh();
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.team.invite_failed");
  } finally {
    loading.value = false;
  }
}

async function onRemove(id) {
  error.value = "";
  loading.value = true;
  try {
    await api("/team/" + id, { method: "DELETE" });
    await refresh();
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.team.remove_failed");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    await refresh();
  } catch (e) {
    error.value = apiMessage(t, te, e, "errors.team.load_failed");
  } finally {
    loading.value = false;
  }
});
</script>
