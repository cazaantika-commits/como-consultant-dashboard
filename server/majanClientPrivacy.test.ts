import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Majan protected snapshot boundary', () => {
  it('does not import private defaults or the archived cost snapshot into the client', () => {
    const workspace=readFileSync(new URL('../client/src/pages/MajanFinanceWorkspace.tsx',import.meta.url),'utf8');
    expect(workspace).not.toContain('@shared/majanBaselineSnapshot');
    expect(workspace).not.toContain('@shared/majanDefaults');
    const engine=readFileSync(new URL('../shared/majanModel.ts',import.meta.url),'utf8');
    expect(engine).toContain('./majanAreaConstants');
    expect(engine).not.toContain('./majanDefaults');
    const constants=readFileSync(new URL('../shared/majanAreaConstants.ts',import.meta.url),'utf8');
    expect(constants).not.toContain('majanBaselineSnapshot');
    expect(constants).not.toContain('555794315');
  });
});
