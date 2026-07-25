export interface NavItem {
  label: string;
  to: string;
  icon: string;
  /** Page title shown in the topbar and page header. */
  title: string;
  description: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/dashboard",
        icon: "◧",
        title: "Dashboard",
        description: "Operational status across the environments and services I run.",
      },
      {
        label: "Reports",
        to: "/reports",
        icon: "▤",
        title: "Reports",
        description: "Scheduled and ad hoc reporting across cost, delivery, and security posture.",
      },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((section) => section.items);
