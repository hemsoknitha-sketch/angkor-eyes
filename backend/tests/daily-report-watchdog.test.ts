import test from 'node:test';
import assert from 'node:assert/strict';

import { DailyExecutiveReportEngine } from '../src/audit/daily-executive-report.js';
import { SelfHealingWatchdog } from '../src/safety/self-healing-watchdog.js';
import { CambodiaMacroIntelligence } from '../src/cambodia/macro-intelligence.js';

test('1. DailyExecutiveReportEngine - Compiles Master Report for Super Admin', () => {
  const digest = DailyExecutiveReportEngine.generateDailyReport();

  assert.ok(digest.reportId.startsWith('AER-'));
  assert.equal(typeof digest.date, 'string');
  assert.ok(digest.systemHealth.activeAgentsCount > 0);
  assert.ok(digest.formattedKhmerReport.includes('របាយការណ៍សង្ខេបប្រតិបត្តិការប្រចាំថ្ងៃ'));
  assert.ok(digest.formattedKhmerReport.includes('មាត្រា ៥១'));
  assert.ok(digest.formattedKhmerReport.includes('ច្បាប់ស្តីពីការប្រឆាំងអំពើពុករលួយ'));
  assert.ok(digest.formattedKhmerReport.endsWith(' ៕'));
});

test('2. SelfHealingWatchdog - Autonomous Cycle & Stale Recovery', async () => {
  const cycleResult = await SelfHealingWatchdog.runSelfHealingCycle();

  assert.equal(typeof cycleResult.staleTasksHealed, 'number');
  assert.equal(typeof cycleResult.offlineRunnersDetected, 'number');
  assert.equal(typeof cycleResult.circuitsRecovered, 'number');
  assert.ok(cycleResult.timestamp.length > 0);
});

test('3. CambodiaMacroIntelligence - National Economic & Financial Indicators', () => {
  const ind = CambodiaMacroIntelligence.getMacroIndicators();

  assert.ok(ind.exchangeRateUsdKhr >= 4000 && ind.exchangeRateUsdKhr <= 4200);
  assert.ok(ind.annualInflationPct > 0);
  assert.ok(ind.centralBankReservesUsdBillion > 10);
  assert.ok(ind.csxIndex > 0);

  const formatted = CambodiaMacroIntelligence.getFormattedMacroBriefing();
  assert.ok(formatted.includes('NBC Benchmark'));
  assert.ok(formatted.includes('រៀល'));
});
