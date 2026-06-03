import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  fromName: string
  onDismiss: () => void
}

const MESSAGES = [
  "you're crushing all your tasks!",
  "you're a total beast today!",
  "you're absolutely on fire!",
  "nothing can stop you!",
  "you're unstoppable!",
  "machine mode — let's go!",
  "you're killing it today!",
  "beast mode activated!",
]

type Phase = 'shaking' | 'bursting' | 'revealed'

export default function CelebrationGift({ fromName, onDismiss }: Props) {
  const [phase, setPhase] = useState<Phase>('shaking')
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
  const onDismissRef = useRef(onDismiss)
  useEffect(() => { onDismissRef.current = onDismiss })

  useEffect(() => {
    const colors = ['#f97316', '#fbbf24', '#34d399', '#818cf8', '#ec4899', '#06b6d4']
    const t1 = setTimeout(() => setPhase('bursting'), 750)
    const t2 = setTimeout(() => {
      confetti({ particleCount: 150, spread: 100, origin: { x: 0.5, y: 0.45 }, startVelocity: 65, colors, zIndex: 9999 })
      setTimeout(() => confetti({ particleCount: 70, spread: 110, origin: { x: 0.2, y: 0.5 }, angle: 55, colors, zIndex: 9999 }), 130)
      setTimeout(() => confetti({ particleCount: 70, spread: 110, origin: { x: 0.8, y: 0.5 }, angle: 125, colors, zIndex: 9999 }), 260)
    }, 880)
    const t3 = setTimeout(() => setPhase('revealed'), 1050)
    const t4 = setTimeout(() => onDismissRef.current(), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 cursor-pointer select-none"
      onClick={onDismiss}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Gift box — hidden after revealed */}
        {phase !== 'revealed' && (
          <div className={phase === 'shaking' ? 'gift-shake' : ''}>
            {/* Lid */}
            <div className={`flex justify-center ${phase === 'bursting' ? 'lid-fly' : ''}`}>
              <div className="w-36 h-11 bg-orange-400 rounded-t-lg relative overflow-hidden flex items-center justify-center">
                {/* Lid ribbon */}
                <div className="absolute inset-0 flex justify-center pointer-events-none">
                  <div className="w-3 h-full bg-orange-700/30" />
                </div>
                {/* Bow */}
                <div className="relative flex items-center z-10">
                  <div
                    className="w-8 h-5 bg-orange-600 rounded-full"
                    style={{ transform: 'rotate(35deg) translateX(7px)' }}
                  />
                  <div className="w-5 h-5 bg-orange-500 rounded-full z-10 border-2 border-orange-400" />
                  <div
                    className="w-8 h-5 bg-orange-600 rounded-full"
                    style={{ transform: 'rotate(-35deg) translateX(-7px)' }}
                  />
                </div>
              </div>
            </div>

            {/* Box body */}
            <div className={`w-32 h-28 bg-orange-500 rounded-b-lg mx-auto relative overflow-hidden ${phase === 'bursting' ? 'box-pulse' : ''}`}>
              <div className="absolute inset-0 flex justify-center pointer-events-none">
                <div className="w-3 h-full bg-orange-700/30" />
              </div>
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <div className="w-full h-3 bg-orange-700/30" />
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        {phase === 'revealed' && (
          <div className="text-center celebration-reveal px-6">
            <p className="text-4xl font-extrabold text-white tracking-tight mb-3">Beast Mode!</p>
            <p className="text-orange-300 text-xl font-medium">{fromName}, {message}</p>
            <p className="text-gray-500 text-sm mt-8">Tap to dismiss</p>
          </div>
        )}
      </div>
    </div>
  )
}
