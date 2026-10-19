// =============================================================================
// router.tsx — Standalone admin web routing & authentication boundary
// Phase 6 — Full route vocabulary, protected layout, lazy placeholders & router
// =============================================================================

import * as React from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  NavLink,
  useLocation
} from "react-router-dom";
import { services, useObservableQuery } from "./services.ts";
import type { AuthState } from "../contracts/shared.ts";
import { AdminShell } from "./AdminShell.tsx";
import { LoginPage } from "./LoginPage.tsx";
import { AdminPageHeader, Button, AsyncState } from "../ui/primitives.tsx";

// ---------------------------------------------------------------------------
// 1. Exported Route Paths Constant
// ---------------------------------------------------------------------------

export const ADMIN_PATHS = {
  login: "/login",
  overview: "/overview",
  bins: "/bins",
  alerts: "/alerts",
  verification: "/verification",
  vouchers: "/vouchers",
  settings: "/settings"
} as const;

// ---------------------------------------------------------------------------
// 2. Private Helper Components
// ---------------------------------------------------------------------------

function RootRedirect(): React.ReactElement {
  const authState = useObservableQuery<AuthState>("auth.state", () =>
    services.repositories.auth.watchAuthState()
  );

  if (authState.loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <AsyncState kind="loading" title="Initializing session..." />
      </div>
    );
  }

  if (authState.error) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <AsyncState
          kind="error"
          title="Session Verification Failed"
          description={authState.error}
          onRetry={authState.reload}
        />
      </div>
    );
  }

  if (authState.data?.isSignedIn && authState.data.role === "admin") {
    return <Navigate to={ADMIN_PATHS.overview} replace />;
  }

  return <Navigate to={ADMIN_PATHS.login} replace />;
}

function ProtectedAdminLayout(): React.ReactElement {
  const location = useLocation();
  const authState = useObservableQuery<AuthState>("auth.state", () =>
    services.repositories.auth.watchAuthState()
  );

  if (authState.loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <AsyncState kind="loading" title="Verifying authorization..." />
      </div>
    );
  }

  if (authState.error) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <AsyncState
          kind="error"
          title="Authorization Check Failed"
          description={authState.error}
          onRetry={authState.reload}
        />
      </div>
    );
  }

  if (!authState.data?.isSignedIn) {
    const fullPath = location.pathname + location.search;
    const redirectParam = encodeURIComponent(fullPath);
    return <Navigate to={`${ADMIN_PATHS.login}?redirect=${redirectParam}`} replace />;
  }

  if (authState.data.role !== "admin") {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "24px" }}>
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <AsyncState
            kind="error"
            title="Permission Denied"
            description="Your signed-in account does not hold administrator claims."
          />
          <div style={{ marginTop: "16px" }}>
            <Button
              variant="primary"
              onClick={() => {
                services.repositories.auth.logout();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminShell />;
}

function PendingFeaturePage({ title }: { title: string }): React.ReactElement {
  return (
    <div>
      <AdminPageHeader
        eyebrow="UPCOMING FEATURE"
        title={title}
        description="This admin screen will be converted in subsequent phases according to the implementation plan."
      />
      <div
        style={{
          marginTop: "24px",
          background: "white",
          borderRadius: "16px",
          padding: "48px 24px",
          border: "1px solid var(--line)",
          textAlign: "center"
        }}
      >
        <AsyncState
          kind="empty"
          title={`${title} is pending implementation`}
          description="The route and navigation shell are registered and ready for conversion in Phases 7–9."
        />
      </div>
    </div>
  );
}

function RouteNotFound(): React.ReactElement {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: "420px", textAlign: "center" }}>
        <AsyncState
          kind="empty"
          title="Page Not Found"
          description="The URL you navigated to does not exist in the EcoLoop Admin Portal."
        />
        <div style={{ marginTop: "20px" }}>
          <NavLink to={ADMIN_PATHS.overview}>
            <Button variant="primary">Return to Overview</Button>
          </NavLink>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Router Factory & Component
// ---------------------------------------------------------------------------

export function createAdminRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter([
    {
      path: "/",
      element: <RootRedirect />
    },
    {
      path: ADMIN_PATHS.login,
      element: <LoginPage />
    },
    {
      element: <ProtectedAdminLayout />,
      children: [
        {
          path: ADMIN_PATHS.overview,
          element: <PendingFeaturePage title="Overview" />
        },
        {
          path: ADMIN_PATHS.bins,
          element: <PendingFeaturePage title="Smart Bins" />
        },
        {
          path: ADMIN_PATHS.alerts,
          element: <PendingFeaturePage title="Capacity Alerts" />
        },
        {
          path: ADMIN_PATHS.verification,
          element: <PendingFeaturePage title="Deposit Verification" />
        },
        {
          path: ADMIN_PATHS.vouchers,
          element: <PendingFeaturePage title="Rewards & Vouchers" />
        },
        {
          path: ADMIN_PATHS.settings,
          element: <PendingFeaturePage title="Settings" />
        }
      ]
    },
    {
      path: "*",
      element: <RouteNotFound />
    }
  ]);
}

export function AdminRouter(): React.ReactElement {
  const router = React.useMemo(() => createAdminRouter(), []);
  return <RouterProvider router={router} />;
}
