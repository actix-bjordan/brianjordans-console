export interface NavItem {
  label: string;
  to: string;
  icon: string;
  /** Page title shown in the topbar. */
  title: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const overview: NavSection = {
  label: "Overview",
  items: [
    { label: "Dashboard", to: "/dashboard", icon: "◧", title: "Dashboard" },
    { label: "Reports", to: "/reports", icon: "▤", title: "Reports" },
  ],
};

const administration: NavSection = {
  label: "Administration",
  items: [{ label: "Users", to: "/users", icon: "◍", title: "Users" }],
};

export function navSectionsFor(isAdmin: boolean): NavSection[] {
  return isAdmin ? [overview, administration] : [overview];
}
