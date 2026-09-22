const KEY = "mklens.client.data";

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8);
}

const seed = {
  org: {
    name: "Seguros Atlántico",
    taxId: "B12345678",
    address: "Carrer Provença 320, Barcelona",
    billingEmail: "facturacion@atlanticodemo.com",
  },
  plan: {
    id: "profesional",
    name: "Profesional",
    price: 790,
    period: "mes",
    seats: 8,
    projectsIncluded: 12,
  },
  members: [
    { id: "m1", name: "Ana Ruiz", email: "ana@atlanticodemo.com", role: "admin", status: "activo" },
    { id: "m2", name: "Marc Vidal", email: "marc@atlanticodemo.com", role: "analista", status: "activo" },
    { id: "m3", name: "Lucía Pérez", email: "lucia@atlanticodemo.com", role: "visor", status: "invitado" },
  ],
  projects: [
    {
      id: "p1",
      name: "Autos España Q3",
      market: "España",
      product: "Autos",
      status: "activo",
      updatedAt: "2026-09-12",
      coverage: 1840,
    },
    {
      id: "p2",
      name: "Hogar LATAM",
      market: "México, Colombia",
      product: "Hogar",
      status: "en captura",
      updatedAt: "2026-09-10",
      coverage: 620,
    },
    {
      id: "p3",
      name: "Salud comparadores",
      market: "Italia",
      product: "Salud",
      status: "borrador",
      updatedAt: "2026-09-04",
      coverage: 0,
    },
  ],
  invoices: [
    { id: "F-2026-009", date: "2026-09-01", amount: 790, status: "pagada", url: "#" },
    { id: "F-2026-008", date: "2026-08-01", amount: 790, status: "pagada", url: "#" },
    { id: "F-2026-007", date: "2026-07-01", amount: 790, status: "pagada", url: "#" },
  ],
  payment: {
    brand: "Visa",
    last4: "4242",
    exp: "09/28",
  },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_e) {}
  localStorage.setItem(KEY, JSON.stringify(seed));
  return JSON.parse(JSON.stringify(seed));
}

function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export function getData() {
  return load();
}

export function addProject(fields) {
  const data = load();
  const project = {
    id: uid("p"),
    name: fields.name,
    market: fields.market,
    product: fields.product,
    status: "borrador",
    updatedAt: new Date().toISOString().slice(0, 10),
    coverage: 0,
    notes: fields.notes || "",
  };
  data.projects.unshift(project);
  save(data);
  return project;
}

export function getProject(id) {
  return load().projects.find((p) => p.id === id) || null;
}

export function inviteMember({ name, email, role }) {
  const data = load();
  const member = {
    id: uid("m"),
    name,
    email,
    role: role || "visor",
    status: "invitado",
  };
  data.members.push(member);
  save(data);
  return member;
}

export function removeMember(id) {
  const data = load();
  data.members = data.members.filter((m) => m.id !== id);
  return save(data);
}

export function updateOrg(patch) {
  const data = load();
  data.org = { ...data.org, ...patch };
  return save(data);
}

export function changePlan(plan) {
  const data = load();
  data.plan = plan;
  return save(data);
}

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 290,
    period: "mes",
    seats: 3,
    projectsIncluded: 3,
    blurb: "Un mercado y un producto para empezar.",
  },
  {
    id: "profesional",
    name: "Profesional",
    price: 790,
    period: "mes",
    seats: 8,
    projectsIncluded: 12,
    blurb: "Varios mercados, equipo y facturación mensual.",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    period: "a medida",
    seats: 50,
    projectsIncluded: 99,
    blurb: "SLA, API y captura a medida.",
  },
];
