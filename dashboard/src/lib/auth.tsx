import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("pulse_token")
  );

  const login = (t: string) => {
    localStorage.setItem("pulse_token", t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem("pulse_token");
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Check if this is the first time (no admin account)
export async function checkSetupStatus(): Promise<boolean> {
  const res = await fetch("/api/auth/setup-status");
  if (!res.ok) return false;
  const data = await res.json();
  return data.needsSetup;
}

export async function setupAdmin(email: string, password: string): Promise<string> {
  const res = await fetch("/api/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Setup failed");
  }
  const data = await res.json();
  localStorage.setItem("pulse_email", email);
  return data.token;
}

export async function loginUser(email: string, password: string): Promise<string> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Login failed");
  }
  const data = await res.json();
  localStorage.setItem("pulse_email", email);
  return data.token;
}
