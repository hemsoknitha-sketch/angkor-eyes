/**
 * Load test — ANGKOR EYES (k6).
 *
 * Target: 100 concurrent users against the backend API.
 * Run:  k6 run tests/load/k6-script.js
 *        (or: npm run test:load  — from tests/)
 * Requires the backend running at BASE_URL (default http://localhost:3000).
 * Auth: set API_KEY to a scoped test key (tasks:read + tasks:write).
 *        Never use a production key here.
 *
 * Thresholds (must pass):
 *   - p95 latency of GET /api/v1/tasks < 500 ms
 *   - p95 latency of POST /api/v1/tasks < 1000 ms
 *   - error rate < 1%
 *   - no run should be created without auth (checked in the
 *     unauthenticated scenario below — expected 401, counted separately)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

const errorRate = new Rate('errors');
const taskCreateLatency = new Trend('task_create_latency');

export const options = {
  scenarios: {
    // 100 concurrent virtual users doing the normal owner journey.
    owner_journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // ramp to 50
        { duration: '1m', target: 100 }, // ramp to 100 concurrent users
        { duration: '2m', target: 100 }, // sustain 100
        { duration: '30s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '30s',
    },
    // A small unauthenticated probe running in parallel — must stay 401.
    unauthenticated_probe: {
      executor: 'constant-vus',
      vus: 2,
      duration: '4m',
      exec: 'unauthenticated',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.01'],
    task_create_latency: ['p(95)<1000'],
  },
};

function headers() {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
  };
}

export default function ownerJourney() {
  // 1. Health (cheap, unauthenticated).
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health is 200': (r) => r.status === 200 });

  // 2. List tasks.
  const list = http.get(`${BASE_URL}/api/v1/tasks?limit=20`, headers());
  const listOk = check(list, {
    'list tasks is 200': (r) => r.status === 200,
    'list tasks p95 < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!listOk);

  // 3. Create a low-risk task (read/summarise — no approval needed).
  const create = http.post(
    `${BASE_URL}/api/v1/tasks`,
    JSON.stringify({
      title: `k6 load task ${__VU}-${__ITER}`,
      prompt: 'Summarise the project README in one paragraph.',
      source: 'k6-load-test',
    }),
    headers(),
  );
  taskCreateLatency.add(create.timings.duration);
  const createOk = check(create, {
    'create task is 201': (r) => r.status === 201,
    'create task returns id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!createOk);

  // 4. Poll the created task once (read-after-write).
  if (create.status === 201) {
    let id;
    try {
      id = JSON.parse(create.body).id;
    } catch {
      id = null;
    }
    if (id) {
      const get = http.get(`${BASE_URL}/api/v1/tasks/${id}`, headers());
      const getOk = check(get, { 'get task is 200': (r) => r.status === 200 });
      errorRate.add(!getOk);
    }
  }

  sleep(1);
}

export function unauthenticated() {
  const r = http.get(`${BASE_URL}/api/v1/tasks`);
  check(r, { 'unauthenticated list is 401': (res) => res.status === 401 });
  sleep(5);
}
