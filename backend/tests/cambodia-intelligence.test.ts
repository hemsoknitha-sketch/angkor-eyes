import test from 'node:test';
import assert from 'node:assert/strict';

import { khmerLegalEngine } from '../src/cambodia/legal-engine.js';
import { NationalIngestionRegistry } from '../src/cambodia/ingestion-registry.js';
import { KhmerLanguageAuditor } from '../src/cambodia/khmer-auditor.js';
import { NewsCredibilityEngine } from '../src/cambodia/credibility-engine.js';
import { PublicSentimentRadar } from '../src/cambodia/sentiment-radar.js';
import { InstitutionalSpokespersonOrchestrator } from '../src/cambodia/spokesperson-orchestrator.js';

test('1. KhmerLegalEngine - Indexing & Anti-Corruption/Ethics Retrieval', () => {
  const antiCorruption = khmerLegalEngine.getAntiCorruptionArticles();
  assert.ok(antiCorruption.length > 0, 'Should load Anti-Corruption Law articles');
  assert.ok(antiCorruption[0].code_name.includes('ប្រឆាំងអំពើពុករលួយ'));

  const antiNepotism = khmerLegalEngine.getAntiNepotismAndEthicsArticles();
  assert.ok(antiNepotism.length > 0, 'Should load Civil Service Ethics & Anti-Nepotism articles');

  const democracy = khmerLegalEngine.getDemocraticGovernanceArticles();
  assert.ok(democracy.length > 0, 'Should load Article 51 / Multiparty Democracy articles');

  const searchResults = khmerLegalEngine.searchRelevantLaws('ពុករលួយ និងសំណូកក្នុងវិស័យរដ្ឋបាល');
  assert.ok(searchResults.length > 0, 'Must match anti-corruption laws on query');
});

test('2. NationalIngestionRegistry - Feeds & Agency Mapping', async () => {
  const interiorFeeds = NationalIngestionRegistry.getFeedsForAgent('/interior');
  assert.ok(interiorFeeds.length > 0, 'Must find feeds for /interior');
  assert.ok(interiorFeeds[0].url.includes('interior.gov.kh'));

  const briefings = await NationalIngestionRegistry.getLatestBriefings('/interior');
  assert.ok(briefings.length > 0, 'Must provide latest institutional briefings');
});

test('3. KhmerLanguageAuditor - Chuon Nath Orthography & Purity', () => {
  const draftWithTypos = 'ព័ត៏មាន ពី ឯកឧត្តមរដ្ឋមន្ត្រី៖ រដ្ឋធម្មនុញ្ញ័ និងការការពារ ប្រជាធិបតេយ្យ៍។ <p>extra tag</p>';
  const { cleanText, fixesAppliedCount } = KhmerLanguageAuditor.auditAndPurify(draftWithTypos);

  assert.ok(!cleanText.includes('ព័ត៏មាន'), 'Should fix ព័ត៏មាន to ព័ត៌មាន');
  assert.ok(cleanText.includes('ព័ត៌មាន'), 'Correct spelling must be present');
  assert.ok(!cleanText.includes('រដ្ឋធម្មនុញ្ញ័'), 'Should fix រដ្ឋធម្មនុញ្ញ័ to រដ្ឋធម្មនុញ្ញ');
  assert.ok(cleanText.includes('រដ្ឋធម្មនុញ្ញ'), 'Correct spelling must be present');
  assert.ok(!cleanText.includes('<p>'), 'HTML must be stripped');
  assert.ok(cleanText.endsWith(' ៕'), 'Must terminate with institutional ៕');
  assert.ok(fixesAppliedCount > 0);
});

test('4. NewsCredibilityEngine - Fact-Checking & Credibility Score', () => {
  const officialClaim = NewsCredibilityEngine.evaluateCredibility(
    'សេចក្តីប្រកាសព័ត៌មានផ្លូវការរបស់ក្រសួងមហាផ្ទៃ',
    'យោងតាម មាត្រា ៥១ នៃរដ្ឋធម្មនុញ្ញ និងច្បាប់រដ្ឋបាលសាធារណៈ...',
    'Ministry of Interior'
  );

  assert.ok(officialClaim.score >= 95, 'Official ministry statement must score >= 95%');
  assert.equal(officialClaim.level, 'OFFICIAL_VERIFIED');
  assert.ok(officialClaim.badge.includes('ភាពជឿជាក់ផ្លូវការ'));
});

test('5. PublicSentimentRadar - PII Scrubber & Urgency Evaluator', () => {
  const rawCitizenComplaint = 'ខ្ញុំឈ្មោះ @sok_dara លេខទូរស័ព្ទ 012-345-678 សូមស្នើសុំដំណោះស្រាយបន្ទាន់ ចំពោះបញ្ហាអយុត្តិធម៌ដីធ្លី និងការបក្ខពួកនិយម!';
  const result = PublicSentimentRadar.evaluatePublicConcern(rawCitizenComplaint);

  assert.ok(!result.sanitizedSummary.includes('012-345-678'), 'Phone number must be scrubbed');
  assert.ok(!result.sanitizedSummary.includes('@sok_dara'), 'Telegram handle must be scrubbed');
  assert.ok(result.isUrgentCivicIssue, 'Must classify as urgent civic issue');
  assert.ok(result.concernPct > 0, 'Must detect citizen concern');
});

test('6. InstitutionalSpokespersonOrchestrator - Sovereign Representative Output', async () => {
  const res = await InstitutionalSpokespersonOrchestrator.generateSpokespersonResponse({
    agentCommand: '/interior',
    agentName: 'AGI ក្រសួងមហាផ្ទៃ',
    institutionTitle: 'ក្រសួងមហាផ្ទៃនៃព្រះរាជាណាចក្រកម្ពុជា',
    userQuery: 'តើក្រសួងមានវិធានការបែបណាចំពោះការប្រយុទ្ធប្រឆាំងអំពើពុករលួយ និងពង្រឹងយុត្តិធម៌សង្គម?'
  });

  assert.ok(res.officialContent.length > 0, 'Must produce spokesperson content');
  assert.ok(res.citedLaws.length > 0, 'Must cite Cambodian laws');
  assert.ok(res.credibilityBadge, 'Must include credibility badge');
});

test('7. InterMinisterialDebateEngine - 50+ Watchdog Desks, Cross-Agent Direct Replies & Zero Hotlines', async () => {
  const { InterMinisterialDebateEngine } = await import('../src/cambodia/debate-engine.js');
  const { DailyMasterReportEngine } = await import('../src/cambodia/daily-master-report-engine.js');

  const result = await InterMinisterialDebateEngine.deliberateOnTopic({
    topic: 'គម្រោងព្រែកជីកហ្វូណនតេជោ និងខ្សែច្រវាក់ភស្តុភារកម្មផ្លូវទឹកជាតិ ផលប៉ះពាល់បរិស្ថាន សេដ្ឋកិច្ច និងសង្គម',
    initiatedBy: '/mpwt (តុឃ្លាំមើលវិស័យសាធារណការ និងដឹកជញ្ជូន)'
  });

  // 1. Over 50+ participating agents (52 selected + 2 scanner statements = 54 total)
  assert.ok(result.participatingAgents.length >= 50, `Participating agents must be >= 50, got ${result.participatingAgents.length}`);
  assert.ok(result.statements.length >= 52, `Statements count must be >= 52, got ${result.statements.length}`);

  // 2. First and last statement are from /angkor-eyes master scanner
  assert.equal(result.statements[0].agentCommand, '/angkor-eyes');
  assert.ok(result.statements[0].statement.includes('ម៉ាស៊ីនស្គែនមេ ANGKOR EYES'));

  const finalStmt = result.statements[result.statements.length - 1];
  assert.equal(finalStmt.agentCommand, '/angkor-eyes');
  assert.ok(finalStmt.statement.includes('ម៉ាស៊ីនស្គែនមេ ANGKOR EYES'));
  assert.ok(finalStmt.statement.includes('ម៉ោង ៥:០០ ល្ងាច'), 'Must announce 5:00 PM Master Report');

  // 3. Statements must have cross-agent reply anchors and ZERO hotlines or phone numbers
  let crossReplyCount = 0;
  for (let i = 1; i < result.statements.length - 1; i++) {
    const s = result.statements[i];
    assert.ok(!s.statement.includes('Hotline'), `Statement from ${s.agentCommand} must NOT contain Hotline`);
    assert.ok(!s.statement.includes('1282') && !s.statement.includes('117'), `Must NOT contain phone numbers`);
    if (s.statement.includes('ឆ្លើយតបទៅនឹង') || s.statement.includes('យល់ស្របជាមួយ') || s.statement.includes('គាំទ្រយ៉ាងពេញទំហឹងនូវ')) {
      crossReplyCount++;
    }
  }
  assert.ok(crossReplyCount > 40, `Most agents (>40) must directly cross-reply to prior agents, got ${crossReplyCount}`);

  // 4. Daily Master Report Engine Verification
  const masterReport = DailyMasterReportEngine.compileDailyMasterReport();
  assert.ok(masterReport.includes('AGI AGENTS របាយការណ៍សរុបបញ្ហាជាក់ស្តែងប្រចាំថ្ងៃ'), 'Must include Master Daily Report header');
  assert.ok(masterReport.includes('ប្រមុខដឹកនាំកំពូល (Super Admin & Leadership)'), 'Addressed neutrally to Super Admin & Leadership');
  assert.ok(masterReport.includes('សំយោគប្រធានបទក្តៅ'), 'Must contain Section I');
  assert.ok(masterReport.includes('ការរកឃើញគន្លឹះជាក់ស្តែង'), 'Must contain Section II');
  assert.ok(masterReport.includes('ផែនការសកម្មភាពអន្តរស្ថាប័នជាយុទ្ធសាស្ត្រចំពោះមុខ'), 'Must contain Section III');
  assert.ok(masterReport.includes('យោបល់គោរពស្នើសុំការសម្រេច'), 'Must contain Section IV');
  assert.ok(!masterReport.includes('សម្តេច'), 'Must NOT contain royal or politician titles');
});
