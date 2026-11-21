import test from 'node:test';
import assert from 'node:assert/strict';

import { CambodiaSocialDebateRadar } from '../src/cambodia/social-debate-radar.js';
import { CrisisMomentumDetector } from '../src/cambodia/crisis-velocity-detector.js';
import { AutonomousCitizenCommentResponder } from '../src/cambodia/autonomous-citizen-responder.js';

test('1. CambodiaSocialDebateRadar - Anti-Corruption & Nepotism Classification', () => {
  const result = CambodiaSocialDebateRadar.analyzeDebate(
    'ផ្ទុះការវែកញ៉ែកអំពីការទារលុយសំណូក និងបក្ខពួកនិយម',
    'ប្រជាពលរដ្ឋសម្តែងការខឹងសម្បារចំពោះមន្ត្រីដែលកេងប្រវ័ញ្ច និងស៊ីសំណូកខុសច្បាប់'
  );

  assert.equal(result.category, 'CORRUPTION_NEPOTISM');
  assert.equal(result.responsibleAgentCommand, '/acu');
  assert.ok(result.responsibleMinistryKhmer.includes('អង្គភាពប្រឆាំងអំពើពុករលួយ'));
  assert.ok(result.viralScore >= 45);
  assert.equal(result.isViral, true);
  assert.ok(result.citedArticles.length > 0);
  assert.ok(result.actionBriefKhmer.endsWith(' ៕'));
});

test('2. CambodiaSocialDebateRadar - Land Dispute & Constitutional Democracy', () => {
  // Land Dispute
  const landResult = CambodiaSocialDebateRadar.analyzeDebate(
    'ជម្លោះដីធ្លី និងការស្វែងរកយុត្តិធម៌សង្គម',
    'ពលរដ្ឋសំណូមពរដល់អាជ្ញាធរជួយដោះស្រាយអយុត្តិធម៌ដីធ្លី និងការពារសិទ្ធិមនុស្ស'
  );
  assert.equal(landResult.category, 'LAND_DISPUTE_RIGHTS');
  assert.equal(landResult.responsibleAgentCommand, '/mlmupc');

  // Constitutional Democracy
  const demoResult = CambodiaSocialDebateRadar.analyzeDebate(
    'ការលើកកម្ពស់នីតិរដ្ឋ និងលទ្ធិប្រជាធិបតេយ្យសេរីពហុបក្ស',
    'រដ្ឋធម្មនុញ្ញកំណត់អំណាចជារបស់ប្រជាពលរដ្ឋ'
  );
  assert.equal(demoResult.category, 'CONSTITUTIONAL_DEMOCRACY');
  assert.equal(demoResult.responsibleAgentCommand, '/ocm');
  assert.ok(demoResult.legalAnchor.includes('មាត្រា ៥១'));
});

test('3. CrisisMomentumDetector - Hawkes Branching Factor & Viral Explosion', () => {
  // Low momentum
  const low = CrisisMomentumDetector.evaluateCrisis({
    topicId: 'T1',
    topicTitle: 'សេចក្តីជូនដំណឹងធម្មតា',
    elapsedMinutes: 120,
    likes: 10,
    comments: 2,
    shares: 0
  });
  assert.equal(low.classification, 'LOW_MOMENTUM');
  assert.equal(low.urgentClarificationRequired, false);

  // Viral explosion with high Hawkes branching (shares ratio >= 0.3)
  const viral = CrisisMomentumDetector.evaluateCrisis({
    topicId: 'T2',
    topicTitle: 'ករណីគ្រោះថ្នាក់ចរាចរណ៍បង្កការភ្ញាក់ផ្អើលទូទាំងប្រទេស',
    elapsedMinutes: 20,
    likes: 2000,
    comments: 800,
    shares: 1200,
    views: 80000
  });

  assert.equal(viral.classification, 'VIRAL_EXPLOSION');
  assert.equal(viral.urgentClarificationRequired, true);
  assert.equal(viral.recommendedResponseWindowMinutes, 30);
  assert.ok(viral.sharesRatio >= 0.30);
  assert.ok(viral.pressClarificationDraftKhmer.includes('សេចក្តីប្រកាសព័ត៌មាន និងបំភ្លឺជាបន្ទាន់'));
  assert.ok(viral.pressClarificationDraftKhmer.endsWith(' ៕'));
});

test('4. AutonomousCitizenCommentResponder - Public Service & Anti-Corruption Inquiries', () => {
  // Public Service Inquiry (ID Card)
  const idInquiry = AutonomousCitizenCommentResponder.processCitizenComment({
    commentId: 'C1',
    citizenName: 'សុខា',
    messageText: 'ខ្ញុំបាទចង់ដឹងអំពីការធ្វើអត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ តើត្រូវទៅណា?'
  });
  assert.equal(idInquiry.intent, 'PUBLIC_SERVICE_INQUIRY');
  assert.equal(idInquiry.targetAgencyCommand, '/interior');
  assert.ok(idInquiry.ticketId?.startsWith('TK-SVC-'));
  assert.ok(idInquiry.officialPublicReplyKhmer.includes('អត្តសញ្ញាណកម្ម'));
  assert.equal(idInquiry.isSpamShieldQuarantined, false);

  // Corruption Allegation
  const corruptionReport = AutonomousCitizenCommentResponder.processCitizenComment({
    commentId: 'C2',
    citizenName: 'វណ្ណា',
    messageText: 'មានមន្ត្រីទារលុយស៊ីសំណូកពេលខ្ញុំទៅសុំឯកសារ'
  });
  assert.equal(corruptionReport.intent, 'CORRUPTION_OR_BRIBERY_REPORT');
  assert.equal(corruptionReport.targetAgencyCommand, '/acu');
  assert.ok(corruptionReport.ticketId?.startsWith('TK-ACU-'));
  assert.equal(corruptionReport.hotlineNumber, '1282');

  // Spam Shield Quarantined
  const spamComment = AutonomousCitizenCommentResponder.processCitizenComment({
    commentId: 'C3',
    citizenName: 'Bot123',
    messageText: 'ចូលលេងកាស៊ីណូអនឡាញ ឈ្នះ 100% t.me/free_crypto'
  });
  assert.equal(spamComment.intent, 'SPAM_OR_MALICIOUS');
  assert.equal(spamComment.isSpamShieldQuarantined, true);
  assert.ok(spamComment.officialPublicReplyKhmer.includes('ទប់ស្កាត់'));
});
