import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { cn } from '@/lib/cn'

function ProblemPanel({ className }: { className?: string }) {
  return (
    <div className={cn('border-r border-white/[0.06] p-5 overflow-hidden flex flex-col gap-3', className)} style={{ background: '#07090e' }}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-paper">Two Sum</span>
        <span className="font-mono text-[9px] text-moss border border-moss/30 bg-moss/10 px-1.5 py-0.5 rounded-full">Easy</span>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-paper-faint">
        Given an array of integers <span className="text-ember">nums</span> and an integer{' '}
        <span className="text-ember">target</span>, return indices of the two numbers that add up to{' '}
        <span className="text-ember">target</span>.
      </p>
      <div className="border-l-2 border-ember/30 bg-ember/[0.04] rounded-sm px-3 py-2">
        <p className="font-mono text-[9px] text-paper-faint mb-1.5 uppercase tracking-widest">Example</p>
        <p className="font-mono text-[10px] text-paper-faint">Input: <span className="text-paper">nums = [2,7,11,15], target = 9</span></p>
        <p className="font-mono text-[10px] text-moss mt-1">→ [0, 1]</p>
      </div>
      <div className="pt-2 border-t border-white/[0.06]">
        <p className="font-mono text-[9px] text-paper-faint uppercase tracking-widest mb-1.5">Constraints</p>
        <p className="font-mono text-[10px] text-paper-faint">· 2 ≤ nums.length ≤ 10⁴</p>
        <p className="font-mono text-[10px] text-paper-faint">· Each input has exactly one solution</p>
      </div>
    </div>
  )
}

type Token = { text: string; cls: string }
type CodeLine = Token[]

const kw  = (t: string): Token => ({ text: t, cls: 'text-[#c792ea]' })
const fn  = (t: string): Token => ({ text: t, cls: 'text-[#82aaff]' })
const cm  = (t: string): Token => ({ text: t, cls: 'text-ember' })
const tx  = (t: string): Token => ({ text: t, cls: 'text-paper' })
const op  = (t: string): Token => ({ text: t, cls: 'text-paper-faint' })

const CODE_LINES: CodeLine[] = [
  [kw('from'), tx(' typing '), kw('import'), tx(' List')],
  [],
  [kw('class'), tx(' '), fn('Solution'), op(':')],
  [tx('    '), kw('def'), tx(' '), fn('twoSum'), op('('), tx('self, nums: List['), fn('int'), tx('], target: '), fn('int'), op(') -> List['), fn('int'), op(']'), op(':')],
  [tx('        '), cm('# hash map: value → index')],
  [tx('        '), tx('seen'), op(': dict['), fn('int'), op(', '), fn('int'), op('] = '), op('{'), op('}')],
  [],
  [tx('        '), kw('for'), tx(' i, n '), kw('in'), tx(' '), fn('enumerate'), op('('), tx('nums'), op(')')],
  [tx('            '), tx('complement'), op(' = '), tx('target'), op(' - '), tx('n')],
  [],
  [tx('            '), kw('if'), tx(' complement '), kw('in'), tx(' seen'), op(':')],
  [tx('                '), kw('return'), tx(' '), op('['), tx('seen'), op('['), tx('complement'), op(']'), op(', '), tx('i'), op(']')],
  [],
  [tx('            '), tx('seen'), op('['), tx('n'), op('] = '), tx('i')],
]

function EditorPanel() {
  return (
    <div className="flex flex-col h-full" style={{ background: '#07090e' }}>
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-white/[0.06] shrink-0 min-w-0" style={{ background: '#0a0c12' }}>
        <span className="font-mono text-[10px] text-ember border-b border-ember/40 px-2 pb-px shrink-0">solution.py</span>
        <span className="font-mono text-[10px] text-paper-faint px-2 shrink-0 hidden sm:inline">✎ Whiteboard</span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[9px] text-paper-faint border border-white/[0.08] rounded px-1.5 py-0.5">▶ Run</span>
          <span className="font-mono text-[9px] text-ink-950 bg-ember rounded px-1.5 py-0.5 font-semibold">Submit</span>
        </div>
      </div>
      <div className="p-3 overflow-hidden">
        {CODE_LINES.map((tokens, i) => (
          <div key={i} className="flex items-start gap-3 leading-5 min-w-0">
            <span className="font-mono text-[9px] text-paper-faint w-4 text-right shrink-0 select-none mt-px">{i + 1}</span>
            <span className="font-mono text-[10px] whitespace-pre overflow-hidden truncate">
              {tokens.length === 0 ? ' ' : tokens.map((t, j) => (
                <span key={j} className={t.cls}>{t.text}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const CHAT: { role: 'ai' | 'user'; text: string }[] = [
  { role: 'ai',   text: "Walk me through your approach before you start coding." },
  { role: 'user', text: "I'll use a hash map — store each value's index as I iterate so I can check the complement in O(1)." },
  { role: 'ai',   text: "Good. What's the space complexity?" },
  { role: 'user', text: "O(n) worst case — one entry per element." },
  { role: 'ai',   text: "And what about duplicate values in the array?" },
]

function ChatPanel() {
  return (
    <div className="p-3 flex flex-col gap-2 overflow-hidden border-l border-white/[0.06]" style={{ background: '#07090e' }}>
      <div className="flex items-center gap-1.5 mb-1 shrink-0">
        <span className="live-dot w-1.5 h-1.5" />
        <span className="font-mono text-[9px] text-ember">George · AI Interviewer</span>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden">
        {CHAT.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-2.5 py-1.5 max-w-[92%] ${
              msg.role === 'ai'
                ? 'bg-ink-800 border border-white/[0.06]'
                : 'bg-ember/[0.08] border border-ember/20'
            }`}>
              <p className={`font-mono text-[9px] leading-relaxed ${
                msg.role === 'ai' ? 'text-paper-dim' : 'text-paper'
              }`}>{msg.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto shrink-0 border border-white/[0.08] rounded-lg px-2.5 py-1.5 flex items-center gap-2">
        <span className="live-dot w-1.5 h-1.5 opacity-40" />
        <span className="font-mono text-[9px] text-paper-faint">Listening…</span>
      </div>
    </div>
  )
}

export function BrowserScrollReveal() {
  const sectionRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  // Scroll timeline — animations complete by ~0.30, hold for the rest
  // 0.00 – 0.28  lid opens
  // 0.28 – 0.35  labels appear
  // 0.35 – 1.00  hold

  const lidAngle       = useTransform(scrollYProgress, [0.05, 0.30], [-178, -10])
  const shadowOpacity  = useTransform(scrollYProgress, [0.22, 0.32], [0, 0.65])
  const screenGlow     = useTransform(scrollYProgress, [0.22, 0.32], [0, 1])
  const screenBoxShadow = useTransform(
    screenGlow,
    (v) => v > 0.01
      ? `0 -12px 60px -10px rgba(34,197,94,${0.18 * v}), 0 0 0 1px rgba(34,197,94,${0.05 * v})`
      : '0 2px 0 rgba(255,255,255,0.02)',
  )

  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0])

  const labelLOpacity = useTransform(scrollYProgress, [0.32, 0.38], [0, 1])
  const labelLX       = useTransform(scrollYProgress, [0.32, 0.38], [-14, 0])
  const labelTOpacity = useTransform(scrollYProgress, [0.33, 0.39], [0, 1])
  const labelTY       = useTransform(scrollYProgress, [0.33, 0.39], [-12, 0])
  const labelROpacity = useTransform(scrollYProgress, [0.34, 0.40], [0, 1])
  const labelRX       = useTransform(scrollYProgress, [0.34, 0.40], [14, 0])

  return (
    /* Very tall section — ~65% is hold time after animation completes */
    <section ref={sectionRef} className="relative bg-ink-950" style={{ minHeight: '600vh' }}>

      {/* Sticky viewport — content stays centered while user scrolls */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Ambient background glow */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 70%, rgba(34,197,94,0.05) 0%, transparent 60%)' }}
        />

        {/* ── Headline ── */}
        <div className="text-center mb-16 px-6 relative z-10">
          <p className="mono-eyebrow mb-5">▶ watch it in action</p>
          <h2
            className="text-4xl font-bold text-paper md:text-5xl"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
          >
            Simulate the interview. Not just the code.
          </h2>
          <p className="mt-4 text-paper-faint text-base max-w-sm mx-auto leading-relaxed">
            Problem, code, and a live AI interviewer in one flow.
          </p>
        </div>

        {/* ── Laptop + labels ── */}
        <div className="relative w-full px-4 lg:px-20">
          <div className="relative mx-auto" style={{ maxWidth: 1080 }}>

            {/* Label — left */}
            <motion.div
              style={{ opacity: labelLOpacity, x: labelLX }}
              className="absolute left-0 top-[38%] -translate-y-1/2 z-10 hidden lg:flex items-center gap-2"
            >
              <span className="font-mono text-[10px] text-ember border border-ember/30 bg-ember/[0.08] rounded px-2.5 py-1 whitespace-nowrap">
                Problem statement
              </span>
              <div className="w-5 h-px bg-ember/30" />
            </motion.div>

            {/* Label — top center */}
            <motion.div
              style={{ opacity: labelTOpacity, y: labelTY }}
              className="absolute left-1/2 -translate-x-1/2 -top-8 z-10 hidden lg:block"
            >
              <span className="mono-eyebrow border border-white/[0.1] bg-ink-800 rounded px-2.5 py-1 whitespace-nowrap">
                Monaco editor
              </span>
            </motion.div>

            {/* Label — right */}
            <motion.div
              style={{ opacity: labelROpacity, x: labelRX }}
              className="absolute right-0 top-[38%] -translate-y-1/2 z-10 hidden lg:flex items-center gap-2"
            >
              <div className="w-5 h-px bg-ember/30" />
              <span className="font-mono text-[10px] text-ember border border-ember/30 bg-ember/[0.08] rounded px-2.5 py-1 whitespace-nowrap">
                AI interviewer
              </span>
            </motion.div>

            {/* ── 3-D Laptop ── */}
            <div
              className="relative"
              style={{ perspective: '1400px', perspectiveOrigin: '50% 25%' }}
            >
              {/* Laptop group — elevated 3/4 view so base is clearly visible */}
              <div
                style={{
                  transformStyle: 'preserve-3d',
                  transform: 'rotateX(26deg)',
                }}
              >
                {/* ── LID (scroll-driven, card-flip technique) ── */}
                <motion.div
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'bottom center',
                    rotateX: lidAngle,
                    position: 'relative',
                    zIndex: 2,
                    willChange: 'transform',
                  }}
                >
                  {/* ── BACK FACE: metal lid (visible when closed) ── */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%', height: '100%',
                      background: 'linear-gradient(170deg, #1c1f2d 0%, #12141d 100%)',
                      borderRadius: '14px 14px 0 0',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderBottom: 'none',
                      transform: 'rotateX(180deg)',
                      backfaceVisibility: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Subtle brand mark */}
                    <div style={{
                      width: 18, height: 22,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 3,
                      border: '1px solid rgba(255,255,255,0.04)',
                    }} />
                  </div>

                  {/* ── FRONT FACE: screen (visible when open) ── */}
                  <motion.div
                    style={{
                      background: 'linear-gradient(165deg, #1e2231 0%, #181c27 100%)',
                      borderRadius: '14px 14px 0 0',
                      border: '1px solid rgba(255,255,255,0.09)',
                      borderBottom: 'none',
                      padding: '12px 12px 0',
                      boxShadow: screenBoxShadow,
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    {/* Webcam dot */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle at 35% 35%, #2e3244, #0c0e18)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.9)',
                        }}
                      />
                    </div>

                    {/* Screen glass */}
                    <div
                      style={{
                        borderRadius: '5px 5px 0 0',
                        overflow: 'hidden',
                        background: '#05070b',
                      }}
                    >
                      {/* Browser chrome bar */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          background: '#0a0c12',
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', flexShrink: 0 }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E', flexShrink: 0 }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840', flexShrink: 0 }} />
                        <div
                          style={{
                            flex: 1,
                            marginLeft: 8,
                            marginRight: 8,
                            height: 22,
                            background: '#0c0e14',
                            borderRadius: 4,
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a5568' }}>
                            intervue.app / session · Two Sum
                          </span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#22c55e', flexShrink: 0 }}>● LIVE</span>
                      </div>

                      {/* Three-panel layout */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '160px 1fr 155px',
                          minHeight: 290,
                          overflow: 'hidden',
                        }}
                      >
                        <ProblemPanel />
                        <div style={{ minWidth: 0, overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                          <EditorPanel />
                        </div>
                        <ChatPanel />
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* ── BASE ── */}
                <div
                  style={{
                    background: 'linear-gradient(180deg, #1b1e2c 0%, #141620 100%)',
                    borderRadius: '0 0 14px 14px',
                    height: 58,
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderTop: '2px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                    position: 'relative',
                    zIndex: 1,
                    overflow: 'hidden',
                  }}
                >
                  {/* Hinge bar */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '28%',
                      right: '28%',
                      height: 4,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '0 0 6px 6px',
                    }}
                  />
                  {/* Keyboard row hint */}
                  <div style={{ display: 'flex', gap: 3, opacity: 0.16 }}>
                    {Array.from({ length: 13 }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: i === 0 || i === 12 ? 26 : 18,
                          height: 13,
                          background: 'rgba(255,255,255,0.85)',
                          borderRadius: 3,
                        }}
                      />
                    ))}
                  </div>
                  {/* Trackpad */}
                  <div
                    style={{
                      width: 86,
                      height: 20,
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  />
                </div>
              </div>

              {/* Ground shadow */}
              <motion.div
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: -28,
                  left: '12%',
                  right: '12%',
                  height: 36,
                  background: 'radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 72%)',
                  filter: 'blur(14px)',
                  opacity: shadowOpacity,
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Green screen glow beneath */}
            <motion.div
              aria-hidden
              style={{ opacity: screenGlow, width: '55%' }}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <div
                style={{
                  height: 12,
                  background: 'radial-gradient(ellipse, rgba(34,197,94,0.25) 0%, transparent 70%)',
                  filter: 'blur(12px)',
                }}
              />
            </motion.div>
          </div>
        </div>

        {/* Scroll hint — fades out once user starts scrolling */}
        <motion.div
          style={{ opacity: scrollHintOpacity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="font-mono text-[9px] text-paper-faint uppercase tracking-widest">scroll to reveal</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            className="w-px h-6 bg-gradient-to-b from-paper-faint to-transparent"
          />
        </motion.div>

      </div>
    </section>
  )
}
