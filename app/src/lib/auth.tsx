import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface ConsoleUser {
  name: string;
  email: string;
}

interface AuthState {
  user: ConsoleUser | null;
  signInWithGoogle: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const SESSION_KEY = "bj-console-preview-session";

/**
 * Placeholder session handling.
 *
 * No identity provider is wired up yet, so "signing in" only records a
 * local marker that lets the shell render. Replace the body of
 * signInWithGoogle/signOut with the Cognito Hosted UI redirect and token
 * exchange, and read the real identity here. Nothing sensitive belongs in
 * this console until that swap happens.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ConsoleUser | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? (JSON.parse(stored) as ConsoleUser) : null;
  });

  const signInWithGoogle = useCallback(() => {
    const previewUser: ConsoleUser = {
      name: "Brian Jordan",
      email: "contact@brianjordans.com",
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(previewUser));
    setUser(previewUser);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, signInWithGoogle, signOut }),
    [user, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
