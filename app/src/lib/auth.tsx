import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";

export type Role = "admin" | "member";

export interface ConsoleUser {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

interface AuthState {
  user: ConsoleUser | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * The session is an httpOnly cookie the server owns, so there is nothing to
 * read here. Identity comes from the server, and the server has already
 * refused to serve this bundle to anyone without a valid session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ConsoleUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .get<ConsoleUser>("/api/me")
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // The gate should have redirected already; this covers a session that
        // expired while the tab was open.
        window.location.href = "/login";
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } finally {
      window.location.href = "/login?reason=signedout";
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, isAdmin: user?.role === "admin", signOut }),
    [user, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
