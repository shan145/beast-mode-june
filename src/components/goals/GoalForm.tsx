import { useState } from 'react'
import { createGoal, updateGoal } from '@/lib/firestore'
import type { Goal, GoalFrequency } from '@/types'

interface Props {
  userId: string
  goal?: Goal
  onClose: () => void
}

export default function GoalForm({ userId, goal, onClose }: Props) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [type, setType] = useState<'daily' | 'weekly'>(goal?.frequency.type ?? 'daily')
  const [daysPerWeek, setDaysPerWeek] = useState<string>(
    String(goal?.frequency.type === 'weekly' ? goal.frequency.daysPerWeek : 5)
  )
  const [saving, setSaving] = useState(false)

  function handleDaysPerWeekChange(raw: string) {
    setDaysPerWeek(raw)
    const val = parseInt(raw, 10)
    if (val === 7) setType('daily')
  }

  function handleTypeChange(t: 'daily' | 'weekly') {
    setType(t)
    if (t === 'weekly' && (parseInt(daysPerWeek, 10) === 7 || isNaN(parseInt(daysPerWeek, 10)))) {
      setDaysPerWeek('5')
    }
  }

  function buildFrequency(): GoalFrequency {
    if (type === 'daily') {
      return { type: 'daily', daysPerWeek: 7, totalDays: 30 }
    }
    const dpw = Math.min(7, Math.max(1, parseInt(daysPerWeek, 10) || 1))
    return { type: 'weekly', daysPerWeek: dpw, totalDays: dpw * 4 }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    const frequency = buildFrequency()
    try {
      if (goal) {
        await updateGoal(goal.id, { title: title.trim(), description: description.trim(), frequency })
      } else {
        await createGoal(userId, { title: title.trim(), description: description.trim(), frequency })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-white mb-4">
          {goal ? 'Edit goal' : 'New goal'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-1">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Run, Gym, Read 30 min"
              required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any details"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-2">Cadence</label>
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    type === t
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {t === 'daily' ? 'Every day' : 'Some days'}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-1.5">
              {type === 'daily'
                ? 'Appears on your checklist every day of June'
                : 'Set how many days per week you aim to do this'}
            </p>
          </div>

          {type === 'weekly' && (
            <div>
              <label className="block text-gray-300 text-sm mb-1">Days per week</label>
              <input
                type="number"
                min={1}
                max={7}
                value={daysPerWeek}
                onChange={e => handleDaysPerWeekChange(e.target.value)}
                onFocus={e => e.target.select()}
                onBlur={e => {
                  const val = parseInt(e.target.value, 10)
                  if (isNaN(val) || val < 1) setDaysPerWeek('1')
                  else if (val > 7) setDaysPerWeek('7')
                }}
                className="w-32 bg-gray-800 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-gray-500 text-xs mt-1.5">
                1–7 days · entering 7 switches to "Every day"
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg py-2.5 text-sm transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : goal ? 'Save changes' : 'Add goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
