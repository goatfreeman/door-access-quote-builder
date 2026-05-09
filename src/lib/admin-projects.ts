export type AdminProject = {
  id: string;
  name: string;
  status: "active" | "planned";
  description: string;
  appUrl: string;
  apiBase: string;
  owner: string;
};

export const adminProjects: AdminProject[] = [
  {
    id: "quick-quote-builder",
    name: "Quick Quote Builder",
    status: "active",
    description: "Equipment, labor, template, and project quote workflow.",
    appUrl: "/",
    apiBase: "/api/v1",
    owner: "Operations",
  },
  {
    id: "future-field-app",
    name: "Future Field App",
    status: "planned",
    description: "Placeholder for a future installer/mobile workflow.",
    appUrl: "#",
    apiBase: "",
    owner: "Unassigned",
  },
];
