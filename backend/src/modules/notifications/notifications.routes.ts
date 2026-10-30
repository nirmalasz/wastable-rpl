import { and, count, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../db/client.js';
import { notifications } from '../../db/schema.js';
import { HttpError } from '../../lib/http-error.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';

/** UC15 | FR-11 */
export const notificationsRouter = Router();

notificationsRouter.get('/notifications', requireAuth, async (_req, res) => {
  const me = currentUser(res);
  const db = getDb();
  const items = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), eq(notifications.isRead, false)));
  res.json({ notifications: items, unreadCount: unread?.n ?? 0 });
});

notificationsRouter.post('/notifications/read-all', requireAuth, async (_req, res) => {
  await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, currentUser(res).id), eq(notifications.isRead, false)));
  res.json({ ok: true });
});

notificationsRouter.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = z.object({ id: z.uuid() }).parse(req.params);
  const [row] = await getDb()
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, currentUser(res).id)))
    .returning();
  if (!row) throw HttpError.notFound('Notification not found');
  res.json({ notification: row });
});
