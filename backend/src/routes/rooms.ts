import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../lib/db';
import { requireTelegram, pagination } from '../lib/http';
import { turnCoordinator } from '../services/turn-coordinator';
import { audit } from '../services/audit';

const CreateRoom = z.object({
  projectId: z.string().uuid(),
  telegramChatId: z.string().min(1),
  title: z.string().max(200).optional(),
  kind: z.enum(['group', 'dm']).default('group'),
});

const SendMessage = z.object({
  role: z.enum(['user', 'agent', 'system']).default('user'),
  content: z.string().min(1).max(20000),
  agentId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(), // conversation branching: reply-to / retry-from-here
  telegramUpdateId: z.number().int().optional(),
});

export async function roomRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTelegram);

  app.post('/rooms', async (req, reply) => {
    const body = CreateRoom.parse(req.body);
    const res = await query<{ id: string }>(
      `INSERT INTO rooms (project_id, telegram_chat_id, title, kind) VALUES ($1,$2,$3,$4)
       ON CONFLICT (telegram_chat_id) DO UPDATE SET title=EXCLUDED.title RETURNING id`,
      [body.projectId, body.telegramChatId, body.title ?? null, body.kind],
    );
    return reply.code(201).send({ id: res.rows[0].id });
  });

  app.get('/rooms/:id/messages', async (req) => {
    const { limit, offset } = pagination(req);
    const res = await query(
      `SELECT * FROM messages WHERE room_id=$1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [(req.params as { id: string }).id, limit, offset],
    );
    return { messages: res.rows };
  });

  /** Post a message; user messages trigger the turn coordinator (mention routing / Lead plan). */
  app.post('/rooms/:id/messages', async (req, reply) => {
    const roomId = (req.params as { id: string }).id;
    const body = SendMessage.parse(req.body);
    const room = await query<{ project_id: string }>(`SELECT project_id FROM rooms WHERE id=$1`, [roomId]);
    if (room.rows.length === 0) return reply.code(404).send({ error: 'room_not_found' });
    const res = await query<{ id: string }>(
      `INSERT INTO messages (room_id, project_id, role, content, agent_id, parent_id, telegram_update_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [roomId, room.rows[0].project_id, body.role, body.content, body.agentId ?? null,
       body.parentId ?? null, body.telegramUpdateId ?? null],
    );
    if (body.role === 'user') {
      const result = await turnCoordinator.handleTrigger({
        roomId, projectId: room.rows[0].project_id, messageId: res.rows[0].id,
        text: body.content, mentionedAgentId: body.agentId,
        telegramUserId: req.telegramUser!.id, source: 'user_message',
      });
      await audit({ projectId: room.rows[0].project_id, roomId, userTelegramId: req.telegramUser!.id,
        eventType: 'room.message', actor: String(req.telegramUser!.id), detail: `message ${res.rows[0].id}: ${result.reason}` });
      return reply.code(201).send({ id: res.rows[0].id, turn: result });
    }
    return reply.code(201).send({ id: res.rows[0].id });
  });

  /** Conversation branching: regenerate from a message (retry from here). */
  app.post('/rooms/:id/messages/:messageId/regenerate', async (req) => {
    const { id: roomId, messageId } = req.params as { id: string; messageId: string };
    const msg = await query<{ project_id: string; content: string }>(
      `SELECT project_id, content FROM messages WHERE id=$1 AND room_id=$2`, [messageId, roomId],
    );
    if (msg.rows.length === 0) return { error: 'message_not_found' };
    const result = await turnCoordinator.handleTrigger({
      roomId, projectId: msg.rows[0].project_id, messageId,
      text: msg.rows[0].content, telegramUserId: req.telegramUser!.id, source: 'user_message',
    });
    return { regeneratedFrom: messageId, turn: result };
  });

  /** Live agent status / queue for a room (WebSocket also pushes these). */
  app.get('/rooms/:id/status', async (req) => {
    const roomId = (req.params as { id: string }).id;
    const agents = await query(`SELECT id, name, role, status FROM agents WHERE id IN (SELECT DISTINCT agent_id FROM messages WHERE room_id=$1 AND agent_id IS NOT NULL)`, [roomId]);
    return { roomId, agents: agents.rows };
  });
}
