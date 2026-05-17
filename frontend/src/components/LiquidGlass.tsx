import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

interface LiquidGlassProps {
  children: React.ReactNode
  className?: string
}

export function LiquidGlass({ children, className = '' }: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--mx', `${x}%`)
      el.style.setProperty('--my', `${y}%`)
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      style={{ '--mx': '50%', '--my': '50%' } as React.CSSProperties}
      className={[
        'relative overflow-hidden rounded-2xl',
        'bg-white',
        'border border-black/[0.07]',
        'shadow-[0_1px_2px_rgba(11,11,14,0.04),0_8px_24px_-12px_rgba(11,11,14,0.10)]',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]',
        'before:bg-[radial-gradient(circle_at_var(--mx)_var(--my),rgba(245,97,43,0.06)_0%,transparent_60%)]',
        'before:transition-opacity before:duration-300',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function LiquidGlassDemo() {
  return (
    <section className="relative py-20 bg-[#FAFAF7]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-1/4 h-64 w-64 rounded-full bg-[#F5612B]/8 blur-[80px]" />
        <div className="absolute bottom-10 right-1/4 h-80 w-80 rounded-full bg-[#15A874]/6 blur-[100px]" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { num: '01', title: 'Live voice AI', body: 'Speaks, interrupts, and adapts. Move your cursor over this card.' },
            { num: '02', title: 'Real code', body: 'Monaco editor, multi-language, real test execution.' },
            { num: '03', title: 'Feedback', body: 'Every score tied to a transcript moment.' },
          ].map(({ num, title, body }, i) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <LiquidGlass className="p-8">
                <p className="mb-3 font-mono text-xs tracking-widest text-[#F5612B]">{num}</p>
                <h3 className="mb-2 text-xl font-bold text-[#0B0B0E]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
                <p className="text-sm leading-relaxed text-[#6B6B72]">{body}</p>
              </LiquidGlass>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
