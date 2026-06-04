import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  fromName: string
  onDismiss: () => void
}

const MESSAGES = [
  "keep up the great work!",
  "you showed up today — that's everything!",
  "making progress one step at a time!",
  "the grind is paying off!",
  "keep that momentum going!",
  "every rep counts — you're doing it!",
  "stay the course — you've got this!",
  "progress over perfection!",
]

type Phase = 'launching' | 'revealed'

export default function CelebrationFireworks({ fromName, onDismiss }: Props) {
  const [phase, setPhase] = useState<Phase>('launching')
  const message = useRef(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]).current
  const onDismissRef = useRef(onDismiss)
  useEffect(() => { onDismissRef.current = onDismiss })

  useEffect(() => {
    const colors = ['#f97316', '#fbbf24', '#34d399', '#818cf8', '#ec4899', '#06b6d4', '#ffffff']

    function burst(x: number, y: number, count = 80) {
      confetti({ particleCount: count, startVelocity: 42, spread: 360, origin: { x, y }, colors, gravity: 0.75, ticks: 260, zIndex: 9999 })
    }

    const t1 = setTimeout(() => burst(0.5, 0.35, 100), 0)
    const t2 = setTimeout(() => burst(0.2, 0.5, 70), 280)
    const t3 = setTimeout(() => burst(0.8, 0.45, 70), 480)
    const t4 = setTimeout(() => burst(0.5, 0.22, 90), 700)
    const t5 = setTimeout(() => burst(0.35, 0.4, 60), 880)
    const t6 = setTimeout(() => burst(0.68, 0.3, 60), 1020)
    const t7 = setTimeout(() => setPhase('revealed'), 1150)
    const t8 = setTimeout(() => onDismissRef.current(), 6000)

    return () => { [t1, t2, t3, t4, t5, t6, t7, t8].forEach(clearTimeout) }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 select-none ${phase === 'revealed' ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={phase === 'revealed' ? onDismiss : undefined}
    >
      {phase === 'revealed' && (
        <div className="text-center celebration-reveal px-6">
          <p className="text-4xl font-extrabold text-white tracking-tight mb-3">Keep Going! 🎆</p>
          <p className="text-sky-300 text-xl font-medium">{fromName}, {message}</p>
          <p className="text-gray-500 text-sm mt-8">Tap to dismiss</p>
        </div>
      )}
    </div>
  )
}
