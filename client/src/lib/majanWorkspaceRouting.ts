export function isMajanFinanceProject(projectId: number | null | undefined, plotNumber: unknown, isTest = false): boolean {
  return !isTest && projectId === 1 && String(plotNumber ?? '') === '6457956';
}
export function getMajanWorkspaceView(tab: string, isMajan: boolean, showLegacy = false): 'inputs' | 'reports' | null {
  if (!isMajan || showLegacy) return null;
  if (['cashflows', 'feasibility'].includes(tab)) return 'reports';
  if (['general', 'units', 'mall', 'construction', 'settings', 'timeline'].includes(tab)) return 'inputs';
  return null;
}
