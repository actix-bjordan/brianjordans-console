import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { allNavItems, navSections } from "../lib/nav";

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const current = allNavItems.find((item) => pathname.startsWith(item.to));

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-name">Brian Jordan</span>
          <span className="sidebar-brand-sub">Management Console</span>
        </div>

        <nav className="sidebar-nav" aria-label="Console navigation">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>{user?.email}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="sidebar-toggle"
            aria-expanded={sidebarOpen}
            aria-label="Toggle navigation"
            onClick={() => setSidebarOpen((open) => !open)}
          >
            ☰
          </button>
          <span className="topbar-title">{current?.title ?? "Console"}</span>
          <div className="topbar-actions">
            <span className="badge" title="No identity provider is wired up yet">
              Preview
            </span>
            <button type="button" className="btn btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
