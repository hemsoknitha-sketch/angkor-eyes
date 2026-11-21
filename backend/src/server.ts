import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config/index.js';
import { HttpApiServer } from './api/http-api.js';
import { runnerHub } from './runner-hub/hub.js';
import { TelegramBotEngine } from './bot/telegram-bot.js';
import { CrashRecoveryManager } from './tasks/crash-recovery.js';
import { CronScheduler } from './scheduler/cron-scheduler.js';

async function bootstrap() {
  console.log('--------------------------------------------------');
  console.log('🇰🇭 ANGKOR EYES - AUTONOMOUS AGI AGENTS PLATFORM');
  console.log('--------------------------------------------------');

  // 1. Run crash recovery scan on startup
  const recovery = CrashRecoveryManager.runStartupRecovery();
  console.log(`[Startup] Crash recovery check: ${recovery.recoveredCount} resumed, ${recovery.failedCount} marked failed.`);

  // 2. Create HTTP server
  const server = http.createServer((req, res) => {
    HttpApiServer.handleHttpRequest(req, res);
  });

  // 3. Create WebSockets with route multiplexing
  const wssMiniWeb = new WebSocketServer({ noServer: true });
  const wssRunner = new WebSocketServer({ noServer: true });

  HttpApiServer.setupWebSocket(wssMiniWeb);
  runnerHub.initialize(wssRunner);

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/ws') {
      wssMiniWeb.handleUpgrade(req, socket, head, (ws) => {
        wssMiniWeb.emit('connection', ws, req);
      });
    } else if (pathname === '/runner-ws') {
      wssRunner.handleUpgrade(req, socket, head, (ws) => {
        wssRunner.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // 4. Start HTTP Server
  server.listen(config.port, config.host, () => {
    console.log(`[Server] Orchestrator Backend running at http://${config.host}:${config.port}`);
    console.log(`[Server] Mini Web WebSocket on ws://${config.host}:${config.port}/ws`);
    console.log(`[Server] Local Runner WebSocket on ws://${config.host}:${config.port}/runner-ws`);
  });

  // 5. Initialize Telegram Bot & Cron Scheduler
  TelegramBotEngine.initialize();
  CronScheduler.initialize();

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Shutdown] Stopping ANGKOR EYES Backend cleanly...');
    server.close(() => {
      console.log('[Shutdown] Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(err => {
  console.error('[Fatal] Failed to bootstrap ANGKOR EYES backend:', err);
  process.exit(1);
});
