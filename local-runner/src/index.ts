import { RunnerWsClient } from './client/ws-client.js';
import { runnerConfig } from './config/index.js';

console.log('--------------------------------------------------');
console.log('💻 ANGKOR EYES - LOCAL RUNNER DAEMON');
console.log(`ID: ${runnerConfig.runnerId}`);
console.log(`Base Worktrees: ${runnerConfig.worktreeBaseDir}`);
console.log(`Allowed Commands: ${runnerConfig.allowedCommands.join(', ')}`);
console.log('--------------------------------------------------');

const client = new RunnerWsClient();
client.start();

const shutdown = () => {
  console.log('\n[Shutdown] Stopping Local Runner cleanly...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
