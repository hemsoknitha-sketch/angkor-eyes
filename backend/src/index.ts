import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { env, isProduction } from './config';
import { logger } from './lib/logger';
import { dbHealth, closeDb } from './lib/db';
import { redis, closeRedis } from './lib/redis';
import { registerErrorHandler } from './lib/http';
import { isStopAll } from './lib/auth';
import { projectRoutes } from './routes/projects';
import { agentRoutes } from './routes/agents';
import { roomRoutes } from './routes/rooms';
import { taskRoutes } from './routes/tasks';
import { approvalRoutes } from './routes/approvals';
import { memoryRoutes } from './routes/memory';
import { awayRoutes } from './routes/away';
import { usageRoutes } from './routes/usage';
import { auditRoutes } from './routes/audit';
import { webhookRoutes } from './routes/webhooks';
import { apiKeyRoutes } from './routes/api-keys';
import { startScheduler } from './services/scheduler';
import { relayOutbox } from './services/outbox';

export async function buildApp(): Promise<FastifyInstance> {
  // Fastify creates its own pino logger from this config; src/lib/logger.ts
  // is the shared logger used by services (same level, same redaction).
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });
  registerErrorHandler(app);
  await app.register(websocket);

  // Health — no auth (load balancer / uptime checks).
  app.get('/health', async () => ({
    ok: true,
    db: await dbHealth(),
    redis: redis.status === 'ready',
    stopAll: isStopAll(),
    version: '0.1.0',
  }));

  // Kill switch: when STOP_ALL=true, refuse all agent execution.
  app.addHook('onRequest', async (req, reply) => {
    if (isStopAll() && req.url.startsWith('/api/') && !req.url.startsWith('/api/health')) {
      // Allow reads of status; block mutations. Keep it simple: block task/room writes.
      if (req.method !== 'GET') {
        void reply.code(503).send({ error: 'stop_all', message: 'Kill switch STOP_ALL is active — all agent execution halted' });
      }
    }
  });

  // WebSocket: live agent_status / agent_queue events per room.
  // The bot and Mini Web subscribe: ws /ws/rooms/:roomId
  app.register(async (wsApp) => {
    wsApp.get('/ws/rooms/:roomId', { websocket: true }, (socket, req) => {
      const roomId = (req.params as { roomId: string }).roomId;
      const sub = redis.duplicate();
      void sub.subscribe(`room:${roomId}:agent_status`, `room:${roomId}:agent_queue`);
      sub.on('message', (_channel, message) => socket.send(message));
      socket.on('close', () => { void sub.quit(); });
      socket.send(JSON.stringify({ type: 'connected', roomId }));
    });
  });

  // API routes (all Telegram-initData authenticated except webhooks).
  // Each route module already defines its full path (e.g. /projects, /tasks),
  // so register each once under the /api prefix — no nested prefixes.
  await app.register(projectRoutes, { prefix: '/api' });
  await app.register(agentRoutes, { prefix: '/api' });
  await app.register(roomRoutes, { prefix: '/api' });
  await app.register(taskRoutes, { prefix: '/api' });
  await app.register(approvalRoutes, { prefix: '/api' });
  await app.register(memoryRoutes, { prefix: '/api' });
  await app.register(awayRoutes, { prefix: '/api' });
  await app.register(usageRoutes, { prefix: '/api' });
  await app.register(auditRoutes, { prefix: '/api' });
  await app.register(apiKeyRoutes, { prefix: '/api' });
  await app.register(webhookRoutes); // webhookRoutes defines /webhooks/* itself

  // Background relays (outbox + scheduler tick via BullMQ repeatable job).
  const relayTimer = setInterval(() => {
    void relayOutbox(100).catch((err) => logger.error({ err }, 'outbox relay tick failed'));
  }, 5000);
  relayTimer.unref();

  return app;
}

async function main(): Promise<void> {
  const app = await buildApp();
  // Scheduler registration needs Redis; never let it block boot — if Redis
  // is down the job simply isn't registered and the next deploy retries it.
  void startScheduler().catch((err) => logger.warn({ err }, 'scheduler registration failed — continuing without cron ticks'));
  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'ANGKOR EYES backend listening');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'graceful shutdown started');
    try { await app.close(); } catch (err) { logger.error({ err }, 'fastify close failed'); }
    await closeDb().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (require.main === module) {
  main().catch((err) => {
    logger.fatal({ err }, 'failed to start backend');
    process.exit(1);
  });
}
export { isProduction };
