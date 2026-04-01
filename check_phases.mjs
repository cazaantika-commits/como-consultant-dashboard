import { calculatePhases, legacyToNewDurations, getTotalMonths } from './server/investorCashFlow.js';

// Project 1: مجان - design=9, construction=36, handover=2
const legacyDurations = { preCon: 9, construction: 36, handover: 2 };
const durations = legacyToNewDurations(legacyDurations);
console.log('Durations:', durations);

for (const scenario of ['offplan_escrow', 'offplan_construction', 'no_offplan']) {
  const phases = calculatePhases(durations, 0, scenario);
  console.log(`\n${scenario}:`);
  for (const p of phases) {
    console.log(`  ${p.type}: start=${p.startMonth} end=${p.startMonth + p.durationMonths - 1} duration=${p.durationMonths}`);
  }
}
