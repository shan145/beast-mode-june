import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { UserProfile } from '@/types'
import { auth } from '@/lib/firebase'
import { useChat, type ChatMessage } from '@/hooks/useChat'

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, '') ?? ''

// ── Constants ─────────────────────────────────────────────────────────────────

const LAST_READ_KEY = 'chat_last_read'

function getLastRead(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_READ_KEY) ?? '{}') } catch { return {} }
}

function persistLastRead(roomId: string) {
  const map = getLastRead()
  map[roomId] = new Date().toISOString()
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(map))
}

function computeRoomUnread(
  roomId: string,
  messages: ChatMessage[],
  lastRead: Record<string, string>,
  summary: SummaryInfo | null | undefined,
): number {
  const lastReadAt = lastRead[roomId]
  if (messages.length > 0) {
    return lastReadAt ? messages.filter(m => m.sentAt > lastReadAt).length : messages.length
  }
  return summary && (!lastReadAt || summary.sentAt > lastReadAt) ? 1 : 0
}

// ── Room helpers ──────────────────────────────────────────────────────────────

function dmRoomId(a: string, b: string) {
  return `dm:${[a, b].sort().join(':')}`
}

interface SummaryInfo {
  id: string
  userId: string
  text: string
  sentAt: string
}

interface Room {
  id: string
  name: string
  kind: 'dm' | 'group'
  otherUserId?: string
  memberIds?: string[]
  createdBy?: string
}

interface GroupInfo {
  id: string
  name: string
  memberIds: string[]
  createdBy: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingBubble({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="flex items-end gap-2 mb-1">
      <div className="w-7 flex-shrink-0" />
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
        <span className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

function MessageBubble({
  msg,
  isMe,
  user,
  showHeader,
  showTime,
}: {
  msg: ChatMessage
  isMe: boolean
  user?: UserProfile
  showHeader: boolean
  showTime: boolean
}) {
  const time = new Date(msg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (isMe) {
    return (
      <div className="flex flex-col items-end mb-0.5">
        <div className="max-w-[75%] bg-orange-500 text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm leading-relaxed">
          {msg.text}
        </div>
        {showTime && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 mr-1">{time}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 mb-0.5">
      <div className="w-7 flex-shrink-0" />
      <div className="max-w-[75%]">
        {showHeader && (
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 ml-1 mb-0.5">
            {user?.displayName ?? 'Unknown'}
          </p>
        )}
        <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-relaxed">
          {msg.text}
        </div>
        {showTime && <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ml-1">{time}</span>}
      </div>
    </div>
  )
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="flex-1 h-px bg-orange-400/40" />
      <span className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider">New messages</span>
      <div className="flex-1 h-px bg-orange-400/40" />
    </div>
  )
}

// ── Create group modal ────────────────────────────────────────────────────────

function CreateGroupModal({
  users,
  currentUserId,
  onClose,
  onCreated,
}: {
  users: UserProfile[]
  currentUserId: string
  onClose: () => void
  onCreated: (groupId: string) => void
}) {
  const [groupName, setGroupName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherUsers = useMemo(() => users.filter(u => u.uid !== currentUserId), [users, currentUserId])
  const canCreate = groupName.trim().length > 0 && selected.size >= 2

  const toggle = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  async function create() {
    if (!canCreate || creating) return
    setCreating(true)
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) { setError('Not authenticated'); return }

      const res = await fetch(`${WORKER_URL}/api/chat/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: groupName.trim(), memberIds: [...selected] }),
      })
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to create group')
        return
      }
      const { id } = (await res.json()) as { id: string }
      onCreated(id)
    } catch {
      setError('Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="absolute inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New Group Chat</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Group name"
            maxLength={60}
            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-orange-500/30 mb-3"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Select at least 2 people · {selected.size} selected
          </p>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {otherUsers.map(u => (
              <button
                key={u.uid}
                onClick={() => toggle(u.uid)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                  selected.has(u.uid)
                    ? 'bg-orange-50 dark:bg-orange-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                  selected.has(u.uid)
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selected.has(u.uid) && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-900 dark:text-white truncate">{u.displayName ?? u.email}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="px-4 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={create}
            disabled={!canCreate || creating}
            className="w-full py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-400 transition"
          >
            {creating ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add members modal ─────────────────────────────────────────────────────────

function AddMembersModal({
  room,
  users,
  currentUserId,
  onClose,
  onAdded,
}: {
  room: Room
  users: UserProfile[]
  currentUserId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const existingIds = new Set(room.memberIds ?? [])
  const addableUsers = useMemo(
    () => users.filter(u => u.uid !== currentUserId && !existingIds.has(u.uid)),
    [users, currentUserId, existingIds], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const toggle = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  async function add() {
    if (selected.size === 0 || adding) return
    setAdding(true)
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) { setError('Not authenticated'); return }

      const groupId = room.id.slice(6)
      const res = await fetch(`${WORKER_URL}/api/chat/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds: [...selected] }),
      })
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to add members')
        return
      }
      onAdded()
    } catch {
      setError('Something went wrong')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="absolute inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add People</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          {addableUsers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">Everyone is already in this group.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {selected.size === 0 ? 'Select people to add' : `${selected.size} selected`}
              </p>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {addableUsers.map(u => (
                  <button
                    key={u.uid}
                    onClick={() => toggle(u.uid)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition ${
                      selected.has(u.uid)
                        ? 'bg-orange-50 dark:bg-orange-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                      selected.has(u.uid)
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selected.has(u.uid) && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-gray-900 dark:text-white truncate">{u.displayName ?? u.email}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="px-4 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        {addableUsers.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={add}
              disabled={selected.size === 0 || adding}
              className="w-full py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-400 transition"
            >
              {adding ? 'Adding…' : `Add ${selected.size > 0 ? `${selected.size} ` : ''}${selected.size === 1 ? 'Person' : 'People'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Manage group modal ────────────────────────────────────────────────────────

function ManageGroupModal({
  room,
  users,
  currentUserId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  room: Room
  users: UserProfile[]
  currentUserId: string
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}) {
  const groupId = room.id.slice(6)
  const [name, setName] = useState(room.name)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameChanged = name.trim() !== room.name && name.trim().length > 0

  async function saveName() {
    if (!nameChanged || saving) return
    setSaving(true)
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) { setError('Not authenticated'); return }
      const res = await fetch(`${WORKER_URL}/api/chat/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to rename group')
        return
      }
      onUpdated()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function removeMember(memberId: string) {
    setRemovingId(memberId)
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const res = await fetch(`${WORKER_URL}/api/chat/groups/${groupId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to remove member')
        return
      }
      setConfirmRemoveId(null)
      onUpdated()
    } catch {
      setError('Something went wrong')
    } finally {
      setRemovingId(null)
    }
  }

  async function deleteGroup() {
    setError(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const res = await fetch(`${WORKER_URL}/api/chat/groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const { error: msg } = (await res.json()) as { error: string }
        setError(msg ?? 'Failed to delete group')
        return
      }
      onDeleted()
    } catch {
      setError('Something went wrong')
    }
  }

  const memberIds = room.memberIds ?? []

  return (
    <div className="absolute inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Manage Group</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Name */}
          <div className="px-4 pt-4 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Group Name</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                maxLength={60}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl px-3 py-2 text-[16px] outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <button
                onClick={saveName}
                disabled={!nameChanged || saving}
                className="px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-400 transition flex-shrink-0"
              >
                {saving ? '…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Members */}
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              Members · {memberIds.length}
            </p>
            <div className="space-y-1">
              {memberIds.map(uid => {
                const member = users.find(u => u.uid === uid)
                const isYou = uid === currentUserId
                const isCreator = uid === room.createdBy
                const confirming = confirmRemoveId === uid
                const removing = removingId === uid

                return (
                  <div key={uid} className="flex items-center gap-3 px-2 py-2 rounded-xl">
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
                      {member?.displayName?.slice(0, 1).toUpperCase() ?? '?'}
                    </div>
                    <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                      {member?.displayName ?? member?.email ?? 'Unknown'}
                      {isYou && <span className="text-gray-400 dark:text-gray-500"> (you)</span>}
                      {isCreator && <span className="text-gray-400 dark:text-gray-500"> · owner</span>}
                    </span>
                    {!isCreator && !isYou && (
                      confirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => removeMember(uid)}
                            disabled={removing}
                            className="text-[11px] font-semibold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          >
                            {removing ? '…' : 'Remove'}
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(uid)}
                          className="text-[11px] text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                          Remove
                        </button>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer — delete */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          {error && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">Delete this group?</span>
              <button onClick={deleteGroup} className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              Delete Group
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Room list ─────────────────────────────────────────────────────────────────

function RoomList({
  rooms,
  selectedId,
  onSelect,
  messages,
  summaries,
  lastRead,
  onCreateGroup,
}: {
  rooms: Room[]
  selectedId: string | null
  onSelect: (room: Room) => void
  messages: Record<string, ChatMessage[]>
  summaries: Record<string, SummaryInfo | null>
  lastRead: Record<string, string>
  onCreateGroup: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Messages</h2>
        <button
          onClick={onCreateGroup}
          className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-400 transition"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Group
        </button>
      </div>

      <div className="overflow-y-auto flex-1 py-2">
        {rooms.map(room => {
          const roomMsgs = messages[room.id] ?? []
          const lastMsg: { text: string; sentAt: string } | null = roomMsgs[roomMsgs.length - 1] ?? summaries[room.id] ?? null
          const unread = computeRoomUnread(room.id, roomMsgs, lastRead, summaries[room.id])

          return (
            <button
              key={room.id}
              onClick={() => onSelect(room)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-100 dark:hover:bg-gray-800/60 ${
                selectedId === room.id ? 'bg-gray-100 dark:bg-gray-800' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                room.kind === 'group'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {room.kind === 'group' ? '👥' : room.name.slice(0, 1).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                    {room.name}
                  </span>
                  {lastMsg && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {new Date(lastMsg.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {lastMsg && (
                  <p className={`text-xs truncate mt-0.5 ${unread > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    {lastMsg.text}
                  </p>
                )}
              </div>

              {unread > 0 && (
                <div className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? '99+' : unread}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  currentUserId: string
  users: UserProfile[]
  onUnreadChange?: (count: number) => void
}

type ConfirmAction = 'leave' | 'delete' | null

export default function ChatView({ currentUserId, users, onUnreadChange }: Props) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [mobileView, setMobileView] = useState<'rooms' | 'messages'>('rooms')
  const [roomMessages, setRoomMessages] = useState<Record<string, ChatMessage[]>>({})
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [roomSummaries, setRoomSummaries] = useState<Record<string, SummaryInfo | null>>({})
  const [lastRead, setLastRead] = useState<Record<string, string>>(() => getLastRead())
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [showManageGroup, setShowManageGroup] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const pendingGroupIdRef = useRef<string | null>(null)

  const otherUsers = useMemo(
    () => users.filter(u => u.uid !== currentUserId),
    [users, currentUserId],
  )

  const rooms = useMemo<Room[]>(() => [
    ...groups.map(g => ({
      id: `group:${g.id}`,
      name: g.name,
      kind: 'group' as const,
      memberIds: g.memberIds,
      createdBy: g.createdBy,
    })),
    ...otherUsers.map(u => ({
      id: dmRoomId(currentUserId, u.uid),
      name: u.displayName ?? u.email ?? 'Unknown',
      kind: 'dm' as const,
      otherUserId: u.uid,
    })),
  ], [groups, currentUserId, otherUsers])

  // Sort rooms: unreads first, then by most recent message
  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => {
    const aUnread = computeRoomUnread(a.id, roomMessages[a.id] ?? [], lastRead, roomSummaries[a.id])
    const bUnread = computeRoomUnread(b.id, roomMessages[b.id] ?? [], lastRead, roomSummaries[b.id])
    if (aUnread > 0 && bUnread === 0) return -1
    if (aUnread === 0 && bUnread > 0) return 1
    const aMsgs = roomMessages[a.id] ?? []
    const bMsgs = roomMessages[b.id] ?? []
    const aTime = aMsgs[aMsgs.length - 1]?.sentAt ?? roomSummaries[a.id]?.sentAt ?? ''
    const bTime = bMsgs[bMsgs.length - 1]?.sentAt ?? roomSummaries[b.id]?.sentAt ?? ''
    return bTime.localeCompare(aTime)
  }), [rooms, roomMessages, roomSummaries, lastRead])

  // Always reflects latest rooms state (memberIds update after add/leave)
  const liveRoom = selectedRoom ? (rooms.find(r => r.id === selectedRoom.id) ?? selectedRoom) : null

  const markRoomRead = useCallback((roomId: string) => {
    persistLastRead(roomId)
    setLastRead(getLastRead())
  }, [])

  const fetchGroups = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    try {
      const res = await fetch(`${WORKER_URL}/api/chat/groups`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setGroups(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  // Poll groups every 15s (fallback if notify WS misses an event)
  useEffect(() => {
    const t = setInterval(fetchGroups, 15_000)
    return () => clearInterval(t)
  }, [fetchGroups])

  // Subscribe to notify:{currentUserId} for instant group change events
  useEffect(() => {
    let ws: WebSocket | null = null
    let destroyed = false
    let reconnectTimer: ReturnType<typeof setTimeout>

    async function connect() {
      if (destroyed) return
      const token = await auth.currentUser?.getIdToken()
      if (!token || destroyed) return
      const wsUrl = WORKER_URL.replace(/^http/, 'ws')
      ws = new WebSocket(`${wsUrl}/api/chat/${encodeURIComponent(`notify:${currentUserId}`)}/ws?token=${token}`)
      ws.onmessage = (e) => {
        if (destroyed) return
        try {
          const ev = JSON.parse(e.data) as { type: string }
          if (ev.type === 'groups_changed') fetchGroups()
        } catch { /* ignore */ }
      }
      ws.onclose = () => {
        if (!destroyed) reconnectTimer = setTimeout(connect, 5000)
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      destroyed = true
      clearTimeout(reconnectTimer)
      ws?.close()
      ws = null
    }
  }, [currentUserId, fetchGroups])

  // Fetch room summaries (last message per room) for unread counts + preview text
  const fetchSummaries = useCallback(async () => {
    if (rooms.length === 0) return
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    try {
      const res = await fetch(`${WORKER_URL}/api/chat/rooms/summaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomIds: rooms.map(r => r.id) }),
      })
      if (res.ok) setRoomSummaries(await res.json())
    } catch { /* ignore */ }
  }, [rooms])

  useEffect(() => { fetchSummaries() }, [fetchSummaries])

  // Poll summaries every 30s for rooms with no active WS
  useEffect(() => {
    const t = setInterval(fetchSummaries, 30_000)
    return () => clearInterval(t)
  }, [fetchSummaries])

  // If a group the user is in gets deleted/left, clear selection
  useEffect(() => {
    if (!selectedRoom) return
    if (!rooms.some(r => r.id === selectedRoom.id)) {
      setSelectedRoom(null)
      setMobileView('rooms')
    }
  }, [rooms, selectedRoom])

  // Reset transient UI state when selected room changes
  useEffect(() => {
    setConfirmAction(null)
    setShowAddMembers(false)
    setShowManageGroup(false)
  }, [selectedRoom?.id])

  // Select a pending group once rooms list includes it (after fetchGroups resolves)
  useEffect(() => {
    const pending = pendingGroupIdRef.current
    if (!pending) return
    const roomId = `group:${pending}`
    const room = rooms.find(r => r.id === roomId)
    if (room) {
      pendingGroupIdRef.current = null
      handleSelectRoom(room)
    }
  }, [rooms]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectRoom = useCallback((room: Room) => {
    setSelectedRoom(room)
    setMobileView('messages')
    markRoomRead(room.id)
  }, [markRoomRead])

  const handleGroupCreated = useCallback((groupId: string) => {
    setShowCreateGroup(false)
    pendingGroupIdRef.current = groupId
    fetchGroups()
  }, [fetchGroups])

  const handleMembersAdded = useCallback(() => {
    setShowAddMembers(false)
    fetchGroups()
  }, [fetchGroups])

  const handleGroupUpdated = useCallback(() => {
    setShowManageGroup(false)
    fetchGroups()
  }, [fetchGroups])

  const handleGroupDeleted = useCallback(() => {
    setShowManageGroup(false)
    setSelectedRoom(null)
    setMobileView('rooms')
    fetchGroups()
  }, [fetchGroups])

  const handleLeaveGroup = useCallback(async () => {
    if (!selectedRoom || selectedRoom.kind !== 'group') return
    const groupId = selectedRoom.id.slice(6)
    const token = await auth.currentUser?.getIdToken()
    if (!token) return
    try {
      const res = await fetch(`${WORKER_URL}/api/chat/groups/${groupId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setSelectedRoom(null)
        setMobileView('rooms')
        fetchGroups()
      }
    } catch { /* ignore */ }
    setConfirmAction(null)
  }, [selectedRoom, fetchGroups])

const selectedRoomId = selectedRoom?.id ?? null
  const handleMessages = useCallback(
    (msgs: ChatMessage[]) => {
      if (!selectedRoomId) return
      setRoomMessages(prev => ({ ...prev, [selectedRoomId]: msgs }))
      // Keep summary in sync with latest loaded message
      const last = msgs[msgs.length - 1]
      if (last) {
        setRoomSummaries(prev => ({ ...prev, [selectedRoomId]: last }))
      }
    },
    [selectedRoomId],
  )

  const onUnreadChangeRef = useRef(onUnreadChange)
  onUnreadChangeRef.current = onUnreadChange

  useEffect(() => {
    const total = rooms.reduce((sum, room) => {
      return sum + computeRoomUnread(room.id, roomMessages[room.id] ?? [], lastRead, roomSummaries[room.id])
    }, 0)
    onUnreadChangeRef.current?.(total)
  }, [rooms, roomMessages, roomSummaries, lastRead])

  return (
    <div className="relative flex h-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">

      {/* Room list */}
      <div className={`w-full md:w-64 md:flex flex-col border-r border-gray-200 dark:border-gray-800 flex-shrink-0 ${
        mobileView === 'messages' ? 'hidden md:flex' : 'flex'
      }`}>
        <RoomList
          rooms={sortedRooms}
          selectedId={selectedRoom?.id ?? null}
          onSelect={handleSelectRoom}
          messages={roomMessages}
          summaries={roomSummaries}
          lastRead={lastRead}
          onCreateGroup={() => setShowCreateGroup(true)}
        />
      </div>

      {/* Message area */}
      <div className={`flex-1 flex flex-col min-w-0 ${
        mobileView === 'rooms' ? 'hidden md:flex' : 'flex'
      }`}>
        {selectedRoom ? (
          <>
            {/* Room header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <button
                onClick={() => setMobileView('rooms')}
                className="md:hidden p-1 -ml-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {selectedRoom.kind === 'group' ? '👥' : selectedRoom.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                  {selectedRoom.name}
                </p>
                {selectedRoom.kind === 'group' && (liveRoom?.memberIds ?? []).length > 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug mt-0.5 line-clamp-2">
                    {(liveRoom?.memberIds ?? [])
                      .map(id => users.find(u => u.uid === id)?.displayName?.split(' ')[0] ?? '?')
                      .join(', ')}
                  </p>
                )}
              </div>

              {/* Group leave / delete actions */}
              {selectedRoom.kind === 'group' && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {confirmAction === 'leave' && (
                    <>
                      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Leave group?</span>
                      <button
                        onClick={handleLeaveGroup}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        Leave
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {confirmAction === null && (
                    <>
                      {/* Add members — only show if there's someone left to add */}
                      {users.some(u => u.uid !== currentUserId && !(liveRoom?.memberIds ?? []).includes(u.uid)) && (
                        <button
                          onClick={() => setShowAddMembers(true)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          title="Add people"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M19 8v6M22 11h-6" />
                          </svg>
                        </button>
                      )}
                      {liveRoom?.createdBy === currentUserId ? (
                        <button
                          onClick={() => setShowManageGroup(true)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          title="Manage group"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmAction('leave')}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        >
                          Leave
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <MessageAreaWithSync
              roomId={selectedRoom.id}
              isGroup={selectedRoom.kind === 'group'}
              currentUserId={currentUserId}
              users={users}
              onMessages={handleMessages}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Select a conversation</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Choose from the list to start chatting</p>
          </div>
        )}
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          users={users}
          currentUserId={currentUserId}
          onClose={() => setShowCreateGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}

      {showAddMembers && liveRoom && (
        <AddMembersModal
          room={liveRoom}
          users={users}
          currentUserId={currentUserId}
          onClose={() => setShowAddMembers(false)}
          onAdded={handleMembersAdded}
        />
      )}

      {showManageGroup && liveRoom && (
        <ManageGroupModal
          room={liveRoom}
          users={users}
          currentUserId={currentUserId}
          onClose={() => setShowManageGroup(false)}
          onUpdated={handleGroupUpdated}
          onDeleted={handleGroupDeleted}
        />
      )}
    </div>
  )
}

// ── Message area ──────────────────────────────────────────────────────────────

function MessageAreaWithSync({
  roomId,
  isGroup,
  currentUserId,
  users,
  onMessages,
}: {
  roomId: string
  isGroup: boolean
  currentUserId: string
  users: UserProfile[]
  onMessages: (msgs: ChatMessage[]) => void
}) {
  const { messages, typingUsers, connected, send, sendTyping } = useChat(roomId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const lastReadRef = useRef<string | undefined>(getLastRead()[roomId])
  const userMap = Object.fromEntries(users.map(u => [u.uid, u]))

  const onMessagesRef = useRef(onMessages)
  onMessagesRef.current = onMessages

  useEffect(() => {
    onMessagesRef.current(messages)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  useEffect(() => {
    if (messages.length > 0) persistLastRead(roomId)
  }, [roomId, messages.length])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (!isGroup) {
      sendTyping()
      clearTimeout(typingTimeout.current)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    const text = input.trim()
    if (!text || !connected) return
    send(text)
    setInput('')
  }

  const anyoneTyping = !isGroup && Object.keys(typingUsers).some(uid => uid !== currentUserId)

  let firstUnreadIdx = -1
  const unreadStart = lastReadRef.current
  if (unreadStart) {
    firstUnreadIdx = messages.findIndex(m => m.userId !== currentUserId && m.sentAt > unreadStart)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center pt-12">
            <div className="text-3xl mb-3">💬</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Be the first to say something!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.userId === currentUserId
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const sameAsPrev = prev?.userId === msg.userId
          const sameAsNext = next?.userId === msg.userId
          const showHeader = !isMe && (!sameAsPrev || isGroup)
          const showTime = !sameAsNext

          return (
            <div key={msg.id}>
              {i === firstUnreadIdx && <UnreadDivider />}
              <MessageBubble
                msg={msg}
                isMe={isMe}
                user={userMap[msg.userId]}
                showHeader={showHeader}
                showTime={showTime}
              />
            </div>
          )
        })}

        <TypingBubble show={anyoneTyping} />
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={connected ? 'Message…' : 'Connecting…'}
            disabled={!connected}
            rows={1}
            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-2xl px-4 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-orange-500/30 disabled:opacity-50 leading-relaxed"
            style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '16px' }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || !connected}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition"
          >
            <svg className="w-4 h-4 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        {!connected && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 ml-1">Reconnecting…</p>
        )}
      </div>
    </div>
  )
}
