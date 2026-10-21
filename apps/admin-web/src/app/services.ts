// =============================================================================
// services.ts — App-scoped service container and React hooks
// Phase 3 — Singleton mock bundle and reactive query / mutation hooks
// =============================================================================

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import type { Observable, AdminRepositories, MockBundle } from "../data/repositories.ts";
import { createMockRepositories } from "../data/mockRepositories.ts";
import { firebaseConfig, type BackendMode } from "../core/firebase/config.ts";
import { getFirebaseServices } from "../core/firebase/app.ts";
import { initAppCheck } from "../core/firebase/appCheck.ts";
import { FirebaseCommandClient } from "../core/firebase/commandClient.ts";
import { FirebaseAuthRepository } from "../data/firebase/firebaseAuthRepository.ts";

export interface AdminServiceBundle {
  readonly repositories: AdminRepositories;
  readonly controls?: MockBundle["controls"];
  readonly mode: BackendMode;
  readonly commandClient?: FirebaseCommandClient;
  subscribe(listener: () => void): () => void;
  getRevision(): number;
}

function createAdminServiceBundle(): AdminServiceBundle {
  if (firebaseConfig.mode === "mock") {
    const mock = createMockRepositories();
    return {
      repositories: mock.repositories,
      controls: mock.controls,
      mode: "mock",
      subscribe: mock.subscribe,
      getRevision: mock.getRevision,
    };
  }

  // Live or emulator mode
  const { app, auth, functions } = getFirebaseServices(firebaseConfig);
  initAppCheck(app);

  const commandClient = new FirebaseCommandClient(functions);
  const authRepo = new FirebaseAuthRepository(auth, functions);

  // For domain repositories not yet activated (bins, alerts, rewards, settings),
  // retain baseline mock repositories until their respective phases (AB-03 to AB-08)
  const fallbackMock = createMockRepositories();

  let revision = 1;
  const listeners = new Set<() => void>();

  function notify() {
    revision += 1;
    listeners.forEach((l) => l());
  }

  // When auth changes, notify subscribers to refresh views
  authRepo.watchAuthState().subscribe({
    next: () => notify(),
    error: () => notify(),
  });

  const repositories: AdminRepositories = {
    ...fallbackMock.repositories,
    auth: authRepo,
  };

  return {
    repositories,
    mode: firebaseConfig.mode,
    commandClient,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getRevision: () => revision,
  };
}

export const services: AdminServiceBundle = createAdminServiceBundle();

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
}

export interface MutationState {
  pending: boolean;
  error: string | null;
  run<T>(operation: () => Promise<T>): Promise<T | null>;
  clearError(): void;
}

export function useRepositoryRevision(): number {
  return useSyncExternalStore(
    services.subscribe,
    services.getRevision,
    services.getRevision
  );
}

export function useQuery<T>(key: string, loader: () => Promise<T>): QueryState<T> {
  const revision = useRepositoryRevision();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const currentKeyRef = useRef(key);
  currentKeyRef.current = key;

  const reload = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const activeKey = key;

    if (data === null) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }
    setError(null);

    loaderRef.current()
      .then((result) => {
        if (!isCurrent || currentKeyRef.current !== activeKey) return;
        setData(result);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        if (!isCurrent || currentKeyRef.current !== activeKey) return;
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err.code === "unauthenticated" || err.code === "permissionDenied")
        ) {
          setData(null);
        }
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [key, revision, retryCount]);

  return { data, loading, refreshing, error, reload };
}

export function useObservableQuery<T>(key: string, source: () => Observable<T>): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  const sourceRef = useRef(source);
  sourceRef.current = source;

  const currentKeyRef = useRef(key);
  currentKeyRef.current = key;

  const reload = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const activeKey = key;

    if (data === null) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }
    setError(null);

    const observable = sourceRef.current();
    const unsubscribe = observable.subscribe({
      next(val: T) {
        if (!isCurrent || currentKeyRef.current !== activeKey) return;
        setData(val);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      },
      error(failure) {
        if (!isCurrent || currentKeyRef.current !== activeKey) return;
        if (failure.code === "unauthenticated" || failure.code === "permissionDenied") {
          setData(null);
        }
        setError(failure.message);
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [key, retryCount]);

  return { data, loading, refreshing, error, reload };
}

export function useMutation(): MutationState {
  const [pending, setPending] = useState<boolean>(false);
  const [, setError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => {
    errorRef.current = null;
    if (isMountedRef.current) {
      setError(null);
    }
  }, []);

  const run = useCallback(async <T>(operation: () => Promise<T>): Promise<T | null> => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    errorRef.current = null;
    setPending(true);
    setError(null);

    try {
      const result = await operation();
      if (isMountedRef.current) {
        setPending(false);
      }
      inFlightRef.current = false;
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errorRef.current = msg;
      if (isMountedRef.current) {
        setError(msg);
        setPending(false);
      }
      inFlightRef.current = false;
      return null;
    }
  }, []);

  return {
    pending,
    get error() {
      return errorRef.current;
    },
    run,
    clearError
  };
}
