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
