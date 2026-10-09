import { describe, expect, it } from 'vitest';
import { getMajanWorkspaceView, isMajanFinanceProject } from '../client/src/lib/majanWorkspaceRouting';

describe('Majan financial workspace isolation', () => {
 it('matches only the exact official project and plot', () => {
  expect(isMajanFinanceProject(1, '6457956')).toBe(true);
  expect(isMajanFinanceProject(2, '6457956')).toBe(false);
  expect(isMajanFinanceProject(1, '6439823')).toBe(false);
  expect(isMajanFinanceProject(1, '6457956', true)).toBe(false);
  expect(isMajanFinanceProject(null, null)).toBe(false);
 });
 it('routes project input and bank report tabs to the new unified model', () => {
  for (const tab of ['general','units','mall','construction','settings','timeline']) expect(getMajanWorkspaceView(tab,true)).toBe('inputs');
  for (const tab of ['cashflows','feasibility']) expect(getMajanWorkspaceView(tab,true)).toBe('reports');
 });
 it('keeps explicit legacy access and every other project/report untouched', () => {
  expect(getMajanWorkspaceView('cashflows',true,true)).toBeNull();
  expect(getMajanWorkspaceView('general',false)).toBeNull();
  expect(getMajanWorkspaceView('construction',true,true)).toBeNull();
  expect(getMajanWorkspaceView('capital_portfolio',true)).toBeNull();
 });
});
