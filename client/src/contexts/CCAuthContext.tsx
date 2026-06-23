import React, { createContext, useContext, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export type CCMember = {
  id: number;
  name: string;
  nameAr: string;
  role: "admin" | "executive";
  memberId: string;
  greeting: string;
  avatarUrl: string | null;
};

type CCAuthState = {
  ccMember: CCMember | null;
  ccLoading: boolean;
  isOwner: boolean;   // memberId === "abdulrahman"
  isCCAuth: boolean;  // logged in via cc_token (not Manus OAuth)
};

const CCAuthContext = createContext<CCAuthState>({
  ccMember: null,
  ccLoading: false,
  isOwner: false,
  isCCAuth: false,
});

export function CCAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("cc_token");
    setToken(t);
    // Listen for storage changes (e.g., login from command center)
    const handler = () => setToken(localStorage.getItem("cc_token"));
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const verifyQuery = trpc.commandCenter.verifyAccess.useQuery(
    { token: token ?? "" },
    {
      enabled: Boolean(token),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  const ccMember = verifyQuery.data ?? null;
  const ccLoading = Boolean(token) && verifyQuery.isLoading;
  const isOwner = ccMember?.memberId === "abdulrahman";
  const isCCAuth = Boolean(ccMember);

  return (
    <CCAuthContext.Provider value={{ ccMember, ccLoading, isOwner, isCCAuth }}>
      {children}
    </CCAuthContext.Provider>
  );
}

export function useCCAuth() {
  return useContext(CCAuthContext);
}
