import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchEnvironments } from "@/lib/api";

interface EnvironmentContextValue {
  environment: string; // "" = all environments
  environments: string[];
  setEnvironment: (e: string) => void;
}

const EnvironmentContext = createContext<EnvironmentContextValue>({
  environment: "",
  environments: [],
  setEnvironment: () => {},
});

// Global environment filter shared by the header selector and pages.
export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState("");
  const [environments, setEnvironments] = useState<string[]>([]);

  useEffect(() => {
    fetchEnvironments().then(setEnvironments);
  }, []);

  return (
    <EnvironmentContext.Provider value={{ environment, environments, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  return useContext(EnvironmentContext);
}
