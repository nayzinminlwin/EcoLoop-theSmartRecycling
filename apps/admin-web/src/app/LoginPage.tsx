// =============================================================================
// LoginPage.tsx — Admin login entry screen
// Phase 6 — Mock credentials, session initialization and logout intent handler
// =============================================================================

import * as React from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { services, useObservableQuery, useMutation } from "./services.ts";
import type { AuthState } from "../contracts/shared.ts";
import { Brand, Button, TextInput, AsyncState, Feedback } from "../ui/primitives.tsx";

const KNOWN_ADMIN_PATHS = [
  "/overview",
  "/bins",
  "/alerts",
  "/verification",
  "/vouchers",
  "/settings"
];

function getSafeRedirect(raw: string | null): string {
  if (!raw) return "/overview";
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("://")) {
    const pathOnly = raw.split("?")[0];
    if (KNOWN_ADMIN_PATHS.includes(pathOnly)) {
      return raw;
    }
  }
  return "/overview";
}

export function LoginPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isLogoutIntent = searchParams.get("intent") === "logout";
  const rawRedirect = searchParams.get("redirect");
  const safeRedirect = getSafeRedirect(rawRedirect);

  // Form input state
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);

  // Mutations & Subscriptions
  const loginMutation = useMutation();
  const authState = useObservableQuery<AuthState>("auth.state", () =>
    services.repositories.auth.watchAuthState()
  );

  // Logout intent lifecycle
  const [logoutPending, setLogoutPending] = React.useState(isLogoutIntent);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);
  const logoutTriggeredRef = React.useRef(false);

  const performLogout = React.useCallback(async () => {
    setLogoutPending(true);
    setLogoutError(null);
    try {
      await services.repositories.auth.logout();
      setLogoutPending(false);
      navigate("/login", { replace: true });
    } catch (err) {
      setLogoutPending(false);
      setLogoutError(err instanceof Error ? err.message : String(err));
    }
  }, [navigate]);

  React.useEffect(() => {
    if (isLogoutIntent && !logoutTriggeredRef.current) {
      logoutTriggeredRef.current = true;
      performLogout();
    }
  }, [isLogoutIntent, performLogout]);

  // If already signed in as admin and not logging out or submitting, redirect to safe destination
  if (!isLogoutIntent && !loginMutation.pending && authState.data?.isSignedIn && authState.data.role === "admin") {
    return <Navigate to={safeRedirect} replace />;
  }

  // Handle logout intent view
  if (isLogoutIntent) {
    if (logoutPending) {
      return (
        <div className="login-page-wrap">
          <div className="login-card" style={{ alignItems: "center", textAlign: "center" }}>
            <AsyncState kind="loading" title="Signing out..." description="Terminating admin session." />
          </div>
        </div>
      );
    }

    if (logoutError) {
      return (
        <div className="login-page-wrap">
          <div className="login-card" style={{ alignItems: "center", textAlign: "center" }}>
            <AsyncState
              kind="error"
              title="Sign Out Failed"
              description={logoutError}
              onRetry={performLogout}
            />
          </div>
        </div>
      );
    }
  }

  const handleFillDemoCredentials = async () => {
    try {
      setClientError(null);
      loginMutation.clearError();
      const creds = await services.repositories.auth.getDemoCredentials();
      setEmail(creds.email);
      setPassword(creds.password);
    } catch (err) {
      setClientError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    loginMutation.clearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setClientError("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setClientError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setClientError("Password is required.");
      return;
    }

    const session = await loginMutation.run(() =>
      services.repositories.auth.login({ email: trimmedEmail, password })
    );

    if (session) {
      navigate(safeRedirect, { replace: true });
    }
  };

  const displayError = clientError || loginMutation.error;

  return (
    <div className="login-page-wrap">
      <div className="login-card">
        <div className="login-header">
          <Brand />
          <h1 style={{ fontSize: "22px", margin: "8px 0 0" }}>Admin Portal Sign In</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            Manage the smart bin fleet, alerts, and verification tickets.
          </p>
        </div>

        <div className="login-demo-notice">
          <strong>Standalone admin demo</strong>
          <br />
          In-memory data resets on page refresh.
        </div>

        {displayError && (
          <Feedback kind="error" onDismiss={() => { setClientError(null); loginMutation.clearError(); }}>
            {displayError}
          </Feedback>
        )}

        <form onSubmit={handleLoginSubmit} className="login-form">
          <TextInput
            id="admin-login-email"
            type="email"
            label="Email Address"
            placeholder="admin@ecoloop.demo"
            value={email}
            onChange={(val) => setEmail(val)}
            required
            disabled={loginMutation.pending}
          />

          <TextInput
            id="admin-login-password"
            type="password"
            label="Password"
            placeholder="••••••••••••"
            value={password}
            onChange={(val) => setPassword(val)}
            required
            disabled={loginMutation.pending}
          />

          <div className="login-actions">
            <Button
              type="submit"
              variant="primary"
              busy={loginMutation.pending}
            >
              Sign In
            </Button>

            {services.mode !== "firebase" && (
              <Button
                type="button"
                variant="secondary"
                disabled={loginMutation.pending}
                onClick={handleFillDemoCredentials}
              >
                Use demo credentials
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
