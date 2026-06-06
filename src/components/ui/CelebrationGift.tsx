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
    const colors = ['#f97316', '#fbbf24', '#34d399', '#818cf8', '#ec4899', '#06b6d4', '#ffffff']
    const warmGold = ['#f97316', '#fbbf24', '#fb923c', '#fdba74', '#fcd34d']

    const timers: ReturnType<typeof setTimeout>[] = []
    function after(ms: number, fn: () => void) {
      const id = setTimeout(fn, ms)
      timers.push(id)
    }

    after(750, () => setPhase('bursting'))

    // Wave 1 — mega center explosion as lid flies
    after(880, () => {
      confetti({ particleCount: 220, spread: 130, origin: { x: 0.5, y: 0.45 }, startVelocity: 75, colors, zIndex: 9999, scalar: 1.1 })
      confetti({ particleCount: 60, spread: 90, origin: { x: 0.5, y: 0.45 }, startVelocity: 65, colors: warmGold, zIndex: 9999, shapes: ['star'], scalar: 1.6 })
    })
    // Wave 2 — side cannons
    after(1000, () => {
      confetti({ particleCount: 130, spread: 60, origin: { x: 0, y: 0.65 }, angle: 65, startVelocity: 70, colors, zIndex: 9999 })
      confetti({ particleCount: 130, spread: 60, origin: { x: 1, y: 0.65 }, angle: 115, startVelocity: 70, colors, zIndex: 9999 })
    })
    // Wave 3 — slow floaters fill the air
    after(1100, () => {
      confetti({ particleCount: 110, spread: 110, origin: { x: 0.5, y: 0.5 }, startVelocity: 40, colors, zIndex: 9999, gravity: 0.45, ticks: 300 })
    })

    after(1050, () => setPhase('revealed'))

    // Wave 4 — ticker tape from top
    after(1200, () => {
      confetti({ particleCount: 120, spread: 220, origin: { x: 0.5, y: 0 }, startVelocity: 10, colors, zIndex: 9999, gravity: 0.2, flat: true, ticks: 450 })
    })
    // Wave 5 — upper corner star cannons
    after(1400, () => {
      confetti({ particleCount: 80, spread: 80, origin: { x: 0.08, y: 0.2 }, angle: 45, startVelocity: 55, colors: warmGold, zIndex: 9999, shapes: ['star'], scalar: 1.4 })
      confetti({ particleCount: 80, spread: 80, origin: { x: 0.92, y: 0.2 }, angle: 135, startVelocity: 55, colors: warmGold, zIndex: 9999, shapes: ['star'], scalar: 1.4 })
    })
    // Wave 6 — wide double burst
    after(1700, () => {
      confetti({ particleCount: 140, spread: 120, origin: { x: 0.25, y: 0.4 }, startVelocity: 55, colors, zIndex: 9999, scalar: 0.9 })
      confetti({ particleCount: 140, spread: 120, origin: { x: 0.75, y: 0.4 }, startVelocity: 55, colors, zIndex: 9999, scalar: 0.9 })
    })
    // Wave 7 — glitter shower
    after(2100, () => {
      confetti({ particleCount: 90, spread: 360, origin: { x: 0.5, y: 0.1 }, startVelocity: 22, colors, zIndex: 9999, gravity: 0.4, scalar: 0.55, ticks: 380 })
    })
    // Wave 8 — second side cannon salvo
    after(2600, () => {
      confetti({ particleCount: 100, spread: 55, origin: { x: 0, y: 0.55 }, angle: 62, startVelocity: 62, colors, zIndex: 9999 })
      confetti({ particleCount: 100, spread: 55, origin: { x: 1, y: 0.55 }, angle: 118, startVelocity: 62, colors, zIndex: 9999 })
    })
    // Wave 9 — orbiting star ring
    after(3000, () => {
      confetti({ particleCount: 90, spread: 360, origin: { x: 0.5, y: 0.38 }, startVelocity: 30, colors: warmGold, zIndex: 9999, shapes: ['star'], scalar: 1.3, gravity: 0.55, ticks: 320 })
    })
    // Wave 10 — final sparkle burst
    after(4000, () => {
      confetti({ particleCount: 120, spread: 100, origin: { x: 0.5, y: 0.4 }, startVelocity: 50, colors, zIndex: 9999, scalar: 0.8 })
      confetti({ particleCount: 50, spread: 70, origin: { x: 0.5, y: 0.4 }, startVelocity: 55, colors: warmGold, zIndex: 9999, shapes: ['star'], scalar: 1.2 })
    })

    after(6000, () => onDismissRef.current())

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 select-none ${phase === 'revealed' ? 'cursor-pointer' : 'cursor-default'}`}
      onClick={phase === 'revealed' ? onDismiss : undefined}
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
