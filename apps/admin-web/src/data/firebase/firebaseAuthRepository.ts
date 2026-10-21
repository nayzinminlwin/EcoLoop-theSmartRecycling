// =============================================================================
// firebaseAuthRepository.ts — Authoritative Firebase Auth Repository
// Phase AB-02 — Direct Firebase Auth, custom claims, and enabled account guard
// =============================================================================

import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  type Auth,
  type User,
} from "firebase/auth";
import { httpsCallable, type Functions } from "firebase/functions";
import type { AuthState } from "../../contracts/shared.ts";
import type {
  AdminIdentity,
  AdminSession,
  AdminLoginRequest,
} from "../../contracts/admin.ts";
import {
  type AuthRepository,
  type Observable,
  type Observer,
  type Unsubscribe,
  RepositoryError,
} from "../repositories.ts";
import { firebaseConfig } from "../../core/firebase/config.ts";

interface AdminContextResponse {
  schemaVersion: "admin.v1";
  uid: string;
  email: string;
  displayName: string | null;
  role: "admin";
  enabled: boolean;
  environment: {
    projectId: string;
    database: string;
    region: string;
    backendMode: string;
  };
  serverTime: string;
}

export class FirebaseAuthRepository implements AuthRepository {
  private currentIdentity: AdminIdentity | null = null;
  private readonly auth: Auth;
  private readonly functions: Functions;

  constructor(auth: Auth, functions: Functions) {
    this.auth = auth;
    this.functions = functions;
  }

  async getAuthState(): Promise<AuthState> {
    const user = this.auth.currentUser;
    if (!user) {
      return { uid: null, role: null, isSignedIn: false };
    }

    const tokenResult = await user.getIdTokenResult();
    const roleClaim = tokenResult.claims.role ?? (tokenResult.claims.admin === true ? "admin" : null);
    const role = roleClaim === "admin" ? "admin" : "user";

    return {
      uid: user.uid,
      role,
      isSignedIn: true,
    };
  }

  watchAuthState(): Observable<AuthState> {
    return {
      subscribe: (observer: Observer<AuthState>): Unsubscribe => {
        let isSubscribed = true;

        const unsubscribe = onIdTokenChanged(
          this.auth,
          async (user: User | null) => {
            if (!isSubscribed) return;

            if (!user) {
              this.currentIdentity = null;
              observer.next({ uid: null, role: null, isSignedIn: false });
              return;
            }

            try {
              const tokenResult = await user.getIdTokenResult();
              const roleClaim =
                tokenResult.claims.role ??
                (tokenResult.claims.admin === true ? "admin" : null);
              const role = roleClaim === "admin" ? "admin" : "user";

              if (role === "admin") {
                this.currentIdentity = {
                  id: user.uid,
                  fullName: user.displayName || "Administrator",
                  email: user.email || "",
                };
              } else {
                this.currentIdentity = null;
              }

              observer.next({
                uid: user.uid,
                role,
                isSignedIn: true,
              });
            } catch (err) {
              observer.error({
                code: "unavailable",
                message: err instanceof Error ? err.message : String(err),
                fieldErrors: {},
              });
            }
          },
          (err) => {
            observer.error({
              code: "unavailable",
              message: err.message,
              fieldErrors: {},
            });
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribe();
        };
      },
    };
  }

  async getSession(): Promise<AdminSession> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new RepositoryError({
        code: "unauthenticated",
        message: "No active admin session",
        fieldErrors: {},
      });
    }

    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.role !== "admin" && tokenResult.claims.admin !== true) {
      throw new RepositoryError({
        code: "permissionDenied",
        message: "Active account lacks administrator role",
        fieldErrors: {},
      });
    }

    return {
      id: `session-${user.uid}`,
      adminId: user.uid,
      isSignedIn: true,
      startedAt: user.metadata.lastSignInTime
        ? new Date(user.metadata.lastSignInTime).toISOString()
        : new Date().toISOString(),
    };
  }

  watchSession(): Observable<AdminSession> {
    return {
      subscribe: (observer: Observer<AdminSession>): Unsubscribe => {
        const authObservable = this.watchAuthState();
        return authObservable.subscribe({
          next: async (state) => {
            if (!state.isSignedIn || state.role !== "admin") {
              observer.error({
                code: "unauthenticated",
                message: "No active admin session",
                fieldErrors: {},
              });
              return;
            }
            try {
              const session = await this.getSession();
              observer.next(session);
            } catch (err) {
              if (err instanceof RepositoryError) {
                observer.error(err.failure);
              } else {
                observer.error({
                  code: "unavailable",
                  message: err instanceof Error ? err.message : String(err),
                  fieldErrors: {},
                });
              }
            }
          },
          error: (failure) => observer.error(failure),
        });
      },
    };
  }

  async getIdentity(): Promise<AdminIdentity> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new RepositoryError({
        code: "unauthenticated",
        message: "No authenticated administrator",
        fieldErrors: {},
      });
    }

    try {
      const getContextCallable = httpsCallable<void, AdminContextResponse>(
        this.functions,
        "getAdminContext"
      );
      const res = await getContextCallable();
      const ctx = res.data;

      this.currentIdentity = {
        id: ctx.uid,
        fullName: ctx.displayName || "Administrator",
        email: ctx.email,
      };
      return this.currentIdentity;
    } catch {
      // Fallback to local auth profile if callable fails or in offline state
      this.currentIdentity = {
        id: user.uid,
        fullName: user.displayName || "Administrator",
        email: user.email || "",
      };
      return this.currentIdentity;
    }
  }

  watchIdentity(): Observable<AdminIdentity | null> {
    return {
      subscribe: (observer: Observer<AdminIdentity | null>): Unsubscribe => {
        const authObs = this.watchAuthState();
        return authObs.subscribe({
          next: async (state) => {
            if (!state.isSignedIn || state.role !== "admin") {
              observer.next(null);
              return;
            }
            try {
              const id = await this.getIdentity();
              observer.next(id);
            } catch {
              observer.next(null);
            }
          },
          error: () => observer.next(null),
        });
      },
    };
  }

  async getDemoCredentials(): Promise<AdminLoginRequest> {
    if (firebaseConfig.mode === "firebase") {
      throw new RepositoryError({
        code: "unavailable",
        message: "Demo credentials are not available in production live environment.",
        fieldErrors: {},
      });
    }
    return {
      email: "admin@ecoloop.test",
      password: "Password123!",
    };
  }

  async login(input: AdminLoginRequest): Promise<AdminSession> {
    try {
      const cred = await signInWithEmailAndPassword(
        this.auth,
        input.email,
        input.password
      );

      // Verify custom claims
      const tokenResult = await cred.user.getIdTokenResult(true);
      const roleClaim =
        tokenResult.claims.role ??
        (tokenResult.claims.admin === true ? "admin" : null);

      if (roleClaim !== "admin") {
        await signOut(this.auth);
        throw new RepositoryError({
          code: "permissionDenied",
          message: "Signed-in account does not possess administrator credentials.",
          fieldErrors: {},
        });
      }

      // Verify backend enabled state via getAdminContext
      try {
        const getContext = httpsCallable<void, AdminContextResponse>(
          this.functions,
          "getAdminContext"
        );
        const res = await getContext();
        if (res.data.enabled !== true) {
          await signOut(this.auth);
          throw new RepositoryError({
            code: "permissionDenied",
            message: "Administrator account is currently disabled.",
            fieldErrors: {},
          });
        }
      } catch (err) {
        if (err instanceof RepositoryError) throw err;
        // If callable returned permission-denied or error, sign out
        await signOut(this.auth);
        throw new RepositoryError({
          code: "permissionDenied",
          message: "Administrator account is not enabled in backend.",
          fieldErrors: {},
        });
      }

      return {
        id: `session-${cred.user.uid}`,
        adminId: cred.user.uid,
        isSignedIn: true,
        startedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      if (err instanceof RepositoryError) throw err;
      const fbErr = err as { code?: string; message?: string };
      const code = fbErr.code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        throw new RepositoryError({
          code: "validation",
          message: "Invalid administrator email or password.",
          fieldErrors: { password: "Invalid credentials" },
        });
      }
      throw new RepositoryError({
        code: "unavailable",
        message: fbErr.message ?? "Authentication failed",
        fieldErrors: {},
      });
    }
  }

  async logout(): Promise<void> {
    this.currentIdentity = null;
    await signOut(this.auth);
  }
}
