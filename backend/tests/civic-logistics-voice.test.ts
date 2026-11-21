import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CivicGeocodingAndHotzoneRadar,
  ZeroClickPredictiveGovernor,
  CAMBODIA_GEO_BENCHMARKS
} from '../src/cambodia/civic-logistics.js';
import { VoiceVisionInspector } from '../src/safety/voice-vision-inspector.js';

test('1. CivicGeocodingAndHotzoneRadar - Haversine Distance Calculation', () => {
  const pp = CAMBODIA_GEO_BENCHMARKS['phnom_penh'];
  const sr = CAMBODIA_GEO_BENCHMARKS['siem_reap'];

  const distKm = CivicGeocodingAndHotzoneRadar.haversineDistanceKm(pp.lat, pp.lng, sr.lat, sr.lng);
  assert.ok(distKm > 200 && distKm < 260, `Distance between PP and Siem Reap should be ~234km, got ${distKm}`);

  const dp = CAMBODIA_GEO_BENCHMARKS['daun_penh'];
  const cm = CAMBODIA_GEO_BENCHMARKS['chamkarmon'];
  const distUrban = CivicGeocodingAndHotzoneRadar.haversineDistanceKm(dp.lat, dp.lng, cm.lat, cm.lng);
  assert.ok(distUrban > 1 && distUrban < 6, `Urban distance in Phnom Penh should be ~3.2km, got ${distUrban}`);
});

test('2. CivicGeocodingAndHotzoneRadar - Location Resolution & Hotzone Clustering', () => {
  const loc1 = CivicGeocodingAndHotzoneRadar.resolveLocation('រាយការណ៍ពីខណ្ឌដូនពេញ ជិតផ្សារធំថ្មី');
  assert.ok(loc1.name.includes('ដូនពេញ'));

  const loc2 = CivicGeocodingAndHotzoneRadar.resolveLocation('បញ្ហាផ្លូវនៅ Battambang');
  assert.ok(loc2.name.includes('បាត់ដំបង'));

  // Test clustering with multiple reports in Daun Penh
  const reports = [
    { locationText: 'ដូនពេញ ភ្នំពេញ', topic: 'ការកកស្ទះចរាចរណ៍' },
    { locationText: 'Daun Penh Khan', topic: 'ការរំលោភចិញ្ចើមផ្លូវ' },
    { locationText: 'ខេត្តសៀមរាប', topic: 'ទេសចរណ៍' }
  ];

  const cluster = CivicGeocodingAndHotzoneRadar.clusterHotzones(reports);
  assert.equal(cluster.hotzoneFound, true);
  assert.ok(cluster.primaryZoneName.includes('ដូនពេញ'));
  assert.equal(cluster.reportCount, 2);
  assert.ok(cluster.khmerAlertMessage.includes('ការជូនដំណឹងអំពីចង្កោមបញ្ហាក្តៅ'));
  assert.ok(cluster.khmerAlertMessage.endsWith(' ៕'));

  // Test empty reports
  const emptyCluster = CivicGeocodingAndHotzoneRadar.clusterHotzones([]);
  assert.equal(emptyCluster.hotzoneFound, false);
});

test('3. ZeroClickPredictiveGovernor - High Confidence & Anti-Spam Cooldown', () => {
  const alertKey = `test_alert_${Date.now()}`;

  // 1. Low confidence rejection (< 90%)
  const lowConf = ZeroClickPredictiveGovernor.evaluateAlert({
    alertKey,
    confidencePct: 82.5,
    title: 'ការសង្ស័យមានការកកស្ទះ'
  });
  assert.equal(lowConf.shouldDispatch, false);
  assert.ok(lowConf.reason.includes('< 90.0%'));

  // 2. High confidence approval (>= 90%)
  const highConf = ZeroClickPredictiveGovernor.evaluateAlert({
    alertKey,
    confidencePct: 94.8,
    title: 'ករណីកកស្ទះផ្លូវជាតិលេខ ៤',
    cooldownMs: 5000
  });
  assert.equal(highConf.shouldDispatch, true);
  assert.ok(highConf.reason.includes('បានអនុម័ត'));

  // 3. Immediate duplicate rejected by cooldown
  const duplicate = ZeroClickPredictiveGovernor.evaluateAlert({
    alertKey,
    confidencePct: 98.0,
    title: 'ករណីកកស្ទះផ្លូវជាតិលេខ ៤',
    cooldownMs: 5000
  });
  assert.equal(duplicate.shouldDispatch, false);
  assert.ok(duplicate.reason.includes('Cooldown'));
});

test('4. VoiceVisionInspector - Voice Note Speech-to-Text Transcription', async () => {
  const result = await VoiceVisionInspector.transcribeVoice('MOCK_AUDIO_BASE64_DATA');
  assert.ok(result.text.length > 0, 'Transcription must return text');
  assert.equal(result.language, 'km', 'Transcribed language must be Khmer (km)');
  assert.ok(result.durationSec > 0);
});

test('5. VoiceVisionInspector - AI e-KYC & ID Card Verification', async () => {
  // 1. Missing document rejected
  const missingKyc = await VoiceVisionInspector.verifyCitizenKyc({});
  assert.equal(missingKyc.status, 'rejected');
  assert.equal(missingKyc.isRealPhysicalPhoto, false);
  assert.ok(missingKyc.reason.includes('ខ្វះរូបថត'));

  // 2. Valid document approved
  const validKyc = await VoiceVisionInspector.verifyCitizenKyc({
    idCardPhotoBase64: 'base64_sample_valid_khmer_national_id_card'
  });
  assert.equal(validKyc.status, 'approved');
  assert.equal(validKyc.isRealPhysicalPhoto, true);
  assert.equal(validKyc.faceMatch, true);
  assert.ok(validKyc.documentId?.startsWith('ID-KHM-'));
});

test('6. VoiceVisionInspector - Citizen Grievance Empathy Mediation', () => {
  // Neutral message
  const neutral = VoiceVisionInspector.mediateCitizenFrustration('ខ្ញុំចង់សួរអំពីម៉ោងធ្វើការរបស់រដ្ឋបាល');
  assert.equal(neutral.isHighGrievance, false);
  assert.equal(neutral.empathyResponseKhmer, undefined);

  // Distressed / Angry message
  const angry = VoiceVisionInspector.mediateCitizenFrustration('មន្ត្រីធ្វើការយឺតណាស់ អយុត្តិធម៌ណាស់ ខ្ញុំខឹងខ្លាំងណាស់');
  assert.equal(angry.isHighGrievance, true);
  assert.ok(angry.empathyResponseKhmer, 'Must generate empathy calming response');
  assert.ok(angry.empathyResponseKhmer.includes('ចូលរួមសម្តែងការសោកស្តាយ'));
  assert.ok(angry.empathyResponseKhmer.endsWith(' ៕'), 'Must terminate with institutional ៕');
});
