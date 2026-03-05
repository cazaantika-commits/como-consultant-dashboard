import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type PhaseDurations, DEFAULT_DURATIONS } from "@/lib/cashFlowEngine";

interface CashFlowState {
  // Shared durations
  durations: PhaseDurations;
  setDurations: React.Dispatch<React.SetStateAction<PhaseDurations>>;

  // Investor table overrides & shifts
  investorOverrides: Record<string, { [month: number]: number }>;
  setInvestorOverrides: React.Dispatch<React.SetStateAction<Record<string, { [month: number]: number }>>>;
  investorShifts: Record<string, number>;
  setInvestorShifts: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Escrow table overrides & shifts
  escrowOverrides: Record<string, { [month: number]: number }>;
  setEscrowOverrides: React.Dispatch<React.SetStateAction<Record<string, { [month: number]: number }>>>;
  escrowShifts: Record<string, number>;
  setEscrowShifts: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Escrow revenue data
  revenueData: { [month: number]: number };
  setRevenueData: React.Dispatch<React.SetStateAction<{ [month: number]: number }>>;

  // Selected project
  selectedProjectId: number | null;
  setSelectedProjectId: React.Dispatch<React.SetStateAction<number | null>>;

  // Reset all
  resetAll: () => void;

  // Check if anything changed
  hasChanges: boolean;
}

const CashFlowContext = createContext<CashFlowState | null>(null);

export function CashFlowProvider({ children }: { children: ReactNode }) {
  const [durations, setDurations] = useState<PhaseDurations>({ ...DEFAULT_DURATIONS });
  const [investorOverrides, setInvestorOverrides] = useState<Record<string, { [month: number]: number }>>({});
  const [investorShifts, setInvestorShifts] = useState<Record<string, number>>({});
  const [escrowOverrides, setEscrowOverrides] = useState<Record<string, { [month: number]: number }>>({});
  const [escrowShifts, setEscrowShifts] = useState<Record<string, number>>({});
  const [revenueData, setRevenueData] = useState<{ [month: number]: number }>({});
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const resetAll = useCallback(() => {
    setDurations({ ...DEFAULT_DURATIONS });
    setInvestorOverrides({});
    setInvestorShifts({});
    setEscrowOverrides({});
    setEscrowShifts({});
    setRevenueData({});
  }, []);

  const hasChanges = 
    JSON.stringify(durations) !== JSON.stringify(DEFAULT_DURATIONS) ||
    Object.keys(investorOverrides).length > 0 ||
    Object.keys(investorShifts).length > 0 ||
    Object.keys(escrowOverrides).length > 0 ||
    Object.keys(escrowShifts).length > 0 ||
    Object.keys(revenueData).length > 0;

  return (
    <CashFlowContext.Provider value={{
      durations, setDurations,
      investorOverrides, setInvestorOverrides,
      investorShifts, setInvestorShifts,
      escrowOverrides, setEscrowOverrides,
      escrowShifts, setEscrowShifts,
      revenueData, setRevenueData,
      selectedProjectId, setSelectedProjectId,
      resetAll,
      hasChanges,
    }}>
      {children}
    </CashFlowContext.Provider>
  );
}

export function useCashFlow() {
  const ctx = useContext(CashFlowContext);
  if (!ctx) throw new Error("useCashFlow must be used within CashFlowProvider");
  return ctx;
}
