import { createRouter, createWebHistory } from "vue-router";
import { isLoggedIn } from "./store/session";

const routes = [
  { path: "/login", name: "login", component: () => import("./views/Login.vue"), meta: { public: true } },
  {
    path: "/",
    component: () => import("./layouts/AppLayout.vue"),
    children: [
      { path: "", name: "home", component: () => import("./views/Dashboard.vue") },
      { path: "estudios", name: "projects", component: () => import("./views/Projects.vue") },
      { path: "estudios/:id", name: "project-detail", component: () => import("./views/ProjectDetail.vue") },
      {
        path: "estudios/:id/ediciones/:editionId",
        name: "mission-detail",
        component: () => import("./views/MissionDetail.vue"),
      },
      { path: "proyectos", redirect: "/estudios" },
      { path: "proyectos/nuevo", redirect: "/estudios" },
      { path: "proyectos/:id", redirect: (to) => "/estudios/" + to.params.id },
      {
        path: "proyectos/:id/misiones/:missionId",
        redirect: (to) => "/estudios/" + to.params.id + "/ediciones/" + to.params.missionId,
      },
      { path: "equipo", name: "team", component: () => import("./views/Team.vue") },
      { path: "facturacion", name: "billing", component: () => import("./views/Billing.vue") },
      { path: "ajustes", name: "settings", component: () => import("./views/Settings.vue") },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  if (!isLoggedIn()) return { name: "login", query: { reason: "required" } };
  return true;
});

export default router;
