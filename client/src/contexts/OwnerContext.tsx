import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCCAuth } from "./CCAuthContext";

interface OwnerContextValue {
  isOwner: boolean; // true = can edit everything
}

const OwnerContext = createContext<OwnerContextValue>({ isOwner: false });

export function OwnerProvider({ children }: { children: ReactNode }) {
  const { isOwner: isManusOwner } = useAuth();
  const { isOwner: isCCOwner } = useCCAuth();
  // Owner = Manus admin role OR CC owner token
  const isOwner = isManusOwner || isCCOwner;
  return (
    <OwnerContext.Provider value={{ isOwner }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner() {
  return useContext(OwnerContext);
}
