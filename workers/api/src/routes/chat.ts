import { Hono } from 'hono'
import type { Env, Variables } from '../types'

const chat = new Hono<{ Bindings: Env; Variables: Variables }>()

// ---- Room access helpers ----

export function dmRoomId(uid1: string, uid2: string): string {
  return `dm:${[uid1, uid2].sort().join(':')}`
}

async function authorizeRoom(
  roomId: string,
  userId: string,
  db: D1Database,
): Promise<boolean> {
  if (roomId.startsWith('dm:')) {
    const parts = roomId.slice(3).split(':')
    return parts.length === 2 && parts.includes(userId)
  }
  if (roomId.startsWith('group:')) {
    const groupId = roomId.slice(6)
    const row = await db
      .prepare('SELECT 1 FROM chat_group_members WHERE group_id = ? AND user_id = ?')
      .bind(groupId, userId)
      .first()
    return row !== null
  }
  if (roomId.startsWith('notify:')) {
    return roomId === `notify:${userId}`
  }
  return false
}

async function notifyGroupChange(userId: string, env: Env) {
  try {
    const id = env.CHAT_ROOM.idFromName(`notify:${userId}`)
    const room = env.CHAT_ROOM.get(id)
    await room.fetch(new Request('http://do/broadcast', {
      method: 'POST',
      body: JSON.stringify({ type: 'groups_changed' }),
    }))
  } catch { /* no-op if no sessions connected */ }
}

// ---- Group management ----

chat.post('/groups', async (c) => {
  const userId = c.get('userId')
  const { name, memberIds } = await c.req.json<{ name?: string; memberIds: string[] }>()

  if (!Array.isArray(memberIds)) return c.json({ error: 'memberIds is required' }, 400)

  const allMembers = [...new Set([userId, ...memberIds])]
  if (allMembers.length < 3) return c.json({ error: 'Group chats require at least 3 members' }, 400)

  const placeholders = allMembers.map(() => '?').join(', ')
  const existing = await c.env.DB.prepare(`
    SELECT m1.group_id
    FROM chat_group_members m1
    WHERE m1.user_id IN (${placeholders})
    GROUP BY m1.group_id
    HAVING COUNT(DISTINCT m1.user_id) = ?
      AND (SELECT COUNT(*) FROM chat_group_members WHERE group_id = m1.group_id) = ?
  `).bind(...allMembers, allMembers.length, allMembers.length).first<{ group_id: string }>()

  if (existing) return c.json({ id: existing.group_id, existing: true }, 200)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const groupName = name?.trim() || 'Group Chat'

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO chat_groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, groupName, userId, now),
    ...allMembers.map(uid =>
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO chat_group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)'
      ).bind(id, uid, now)
    ),
  ])

  await Promise.allSettled(allMembers.map(uid => notifyGroupChange(uid, c.env)))

  return c.json({ id, existing: false }, 201)
})

chat.get('/groups', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.DB.prepare(`
    SELECT g.id, g.name, g.created_by, g.created_at,
           GROUP_CONCAT(m.user_id) AS member_ids
    FROM chat_groups g
    JOIN chat_group_members m ON g.id = m.group_id
    WHERE g.id IN (
      SELECT group_id FROM chat_group_members WHERE user_id = ?
    )
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).bind(userId).all<{ id: string; name: string; created_by: string; created_at: string; member_ids: string }>()

  return c.json(results.map(r => ({
    id: r.id,
    name: r.name,
    createdBy: r.created_by,
    memberIds: r.member_ids ? r.member_ids.split(',') : [],
  })))
})

chat.post('/groups/:groupId/members', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const body = await c.req.json<{ userIds?: string[]; userId?: string }>()

  // Accept both batch userIds[] and legacy single userId
  const newMemberIds = body.userIds ?? (body.userId ? [body.userId] : [])
  if (newMemberIds.length === 0) return c.json({ error: 'userIds is required' }, 400)

  const isMember = await c.env.DB
    .prepare('SELECT 1 FROM chat_group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId)
    .first()
  if (!isMember) return c.json({ error: 'Forbidden' }, 403)

  const { results: currentMembers } = await c.env.DB
    .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
    .bind(groupId)
    .all<{ user_id: string }>()

  const now = new Date().toISOString()
  await c.env.DB.batch(
    newMemberIds.map(uid =>
      c.env.DB.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)')
        .bind(groupId, uid, now)
    )
  )

  // Notify everyone: current members see the updated member list, new members see the new group
  const allToNotify = [...new Set([...currentMembers.map(m => m.user_id), ...newMemberIds])]
  await Promise.allSettled(allToNotify.map(uid => notifyGroupChange(uid, c.env)))

  return c.json({ ok: true })
})

chat.patch('/groups/:groupId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const { name } = await c.req.json<{ name?: string }>()
  if (!name?.trim()) return c.json({ error: 'name is required' }, 400)

  const group = await c.env.DB
    .prepare('SELECT created_by FROM chat_groups WHERE id = ?')
    .bind(groupId)
    .first<{ created_by: string }>()
  if (!group) return c.json({ error: 'Not found' }, 404)
  if (group.created_by !== userId) return c.json({ error: 'Only the creator can rename this group' }, 403)

  await c.env.DB
    .prepare('UPDATE chat_groups SET name = ? WHERE id = ?')
    .bind(name.trim(), groupId)
    .run()

  const { results: members } = await c.env.DB
    .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
    .bind(groupId)
    .all<{ user_id: string }>()

  await Promise.allSettled(members.map(m => notifyGroupChange(m.user_id, c.env)))

  return c.json({ ok: true })
})

chat.delete('/groups/:groupId/members/:memberId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')
  const memberId = c.req.param('memberId')

  const group = await c.env.DB
    .prepare('SELECT created_by FROM chat_groups WHERE id = ?')
    .bind(groupId)
    .first<{ created_by: string }>()
  if (!group) return c.json({ error: 'Not found' }, 404)
  if (group.created_by !== userId) return c.json({ error: 'Only the creator can remove members' }, 403)
  if (memberId === userId) return c.json({ error: 'Cannot remove yourself' }, 400)

  const { results: members } = await c.env.DB
    .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
    .bind(groupId)
    .all<{ user_id: string }>()

  await c.env.DB
    .prepare('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, memberId)
    .run()

  await Promise.allSettled(members.map(m => notifyGroupChange(m.user_id, c.env)))

  return c.json({ ok: true })
})

chat.delete('/groups/:groupId', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')

  const group = await c.env.DB
    .prepare('SELECT created_by FROM chat_groups WHERE id = ?')
    .bind(groupId)
    .first<{ created_by: string }>()
  if (!group) return c.json({ error: 'Not found' }, 404)
  if (group.created_by !== userId) return c.json({ error: 'Only the creator can delete this group' }, 403)

  const { results: members } = await c.env.DB
    .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
    .bind(groupId)
    .all<{ user_id: string }>()

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM chat_group_members WHERE group_id = ?').bind(groupId),
    c.env.DB.prepare('DELETE FROM chat_groups WHERE id = ?').bind(groupId),
  ])

  await Promise.allSettled(members.map(m => notifyGroupChange(m.user_id, c.env)))

  return c.json({ ok: true })
})

chat.post('/groups/:groupId/leave', async (c) => {
  const userId = c.get('userId')
  const groupId = c.req.param('groupId')

  const isMember = await c.env.DB
    .prepare('SELECT 1 FROM chat_group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId)
    .first()
  if (!isMember) return c.json({ error: 'Not a member' }, 403)

  const { results: members } = await c.env.DB
    .prepare('SELECT user_id FROM chat_group_members WHERE group_id = ?')
    .bind(groupId)
    .all<{ user_id: string }>()

  await c.env.DB
    .prepare('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId)
    .run()

  await Promise.allSettled(members.map(m => notifyGroupChange(m.user_id, c.env)))

  return c.json({ ok: true })
})

// ---- Room summaries ----

chat.post('/rooms/summaries', async (c) => {
  const userId = c.get('userId')
  const { roomIds } = await c.req.json<{ roomIds: string[] }>()
  if (!Array.isArray(roomIds) || roomIds.length === 0) return c.json({})

  const result: Record<string, { id: string; userId: string; text: string; sentAt: string } | null> = {}

  await Promise.allSettled(
    roomIds.map(async (roomId) => {
      const allowed = await authorizeRoom(roomId, userId, c.env.DB)
      if (!allowed) return
      try {
        const doId = c.env.CHAT_ROOM.idFromName(roomId)
        const room = c.env.CHAT_ROOM.get(doId)
        const res = await room.fetch(new Request('http://do/last-message'))
        result[roomId] = res.ok ? await res.json() : null
      } catch {
        result[roomId] = null
      }
    })
  )

  return c.json(result)
})

// ---- WebSocket + history ----

chat.get('/:roomId/ws', async (c) => {
  const roomId = c.req.param('roomId')
  const userId = c.get('userId')

  const allowed = await authorizeRoom(roomId, userId, c.env.DB)
  if (!allowed) return c.json({ error: 'Forbidden' }, 403)

  const id = c.env.CHAT_ROOM.idFromName(roomId)
  const room = c.env.CHAT_ROOM.get(id)

  const url = new URL(c.req.url)
  url.searchParams.set('userId', userId)
  return room.fetch(new Request(url.toString(), c.req.raw))
})

chat.get('/:roomId/history', async (c) => {
  const roomId = c.req.param('roomId')
  const userId = c.get('userId')

  const allowed = await authorizeRoom(roomId, userId, c.env.DB)
  if (!allowed) return c.json({ error: 'Forbidden' }, 403)

  const id = c.env.CHAT_ROOM.idFromName(roomId)
  const room = c.env.CHAT_ROOM.get(id)
  return room.fetch(new Request('http://do/history'))
})

export default chat
