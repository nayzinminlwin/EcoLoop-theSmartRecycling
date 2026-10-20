// =============================================================================
// AdminShell.tsx — Standalone responsive admin navigation and layout shell
// Phase 6 — Sticky sidebar rail, drawer, header search, breadcrumbs & subscriptions
// =============================================================================

import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { services, useObservableQuery } from "./services.ts";
import type { AdminIdentity, DashboardSummary } from "../contracts/admin.ts";
import { Icon, Brand, type IconName } from "../ui/primitives.tsx";

const ADMIN_NAV = [
  { path: "/overview", label: "Overview", icon: "grid" },
  { path: "/bins", label: "Smart Bins", icon: "bin" },
  { path: "/alerts", label: "Capacity Alerts", icon: "alert" },
  { path: "/verification", label: "Deposit Verification", icon: "camera" },
  { path: "/vouchers", label: "Rewards & Vouchers", icon: "gift" },
  { path: "/settings", label: "Settings", icon: "settings" }
] as const;

export function AdminShell(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile drawer state
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Reactive subscriptions
  const identityQuery = useObservableQuery<AdminIdentity | null>("auth.identity", () =>
    services.repositories.auth.watchIdentity()
  );
  const summaryQuery = useObservableQuery<DashboardSummary>("dashboard.summary", () =>
    services.repositories.dashboard.watchSummary()
  );

  const identity = identityQuery.data;
  const activeAlerts = summaryQuery.data?.activeAlerts ?? 0;

  const initials = identity?.fullName
    ? identity.fullName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";


  // Close drawer on route change
  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close drawer on Escape key
  React.useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const handleLogout = () => {
    navigate("/login?intent=logout");
  };

  return (
    <div className={`admin-shell${menuOpen ? " menu-open" : ""}`}>
      {menuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <aside>
        <div className="side-top">
          <Brand />
          <button
            type="button"
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav aria-label="Main Navigation">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon as IconName} size={18} />
              <span>{item.label}</span>
              {item.path === "/alerts" && activeAlerts > 0 && (
                <i aria-label={`${activeAlerts} active alerts`}>{activeAlerts}</i>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="admin-user">
          <div className="avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="admin-user-info">
            <strong>{identity?.fullName ?? "Admin"}</strong>
            <small>{identity?.email ?? "admin@ecoloop.demo"}</small>
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header>
          <button
            type="button"
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Icon name="menu" size={20} />
          </button>



          <NavLink
            to="/alerts"
            className="notification"
            aria-label={`Capacity alerts (${activeAlerts} active)`}
          >
            <Icon name="bell" size={18} />
            {activeAlerts > 0 && <i aria-hidden="true" />}
          </NavLink>
        </header>

        <main className="admin-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
