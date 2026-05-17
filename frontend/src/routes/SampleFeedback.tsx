import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { API_BASE } from '@/lib/api'
import type { ApiFeedbackReport } from '@/lib/apiTypes'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } } }

function categoryLabel(key: string): string {
  const map: Record<string, string> = {
    clarity: 'Clarity', confidence: 'Confidence', conciseness: 'Conciseness',
    structure: 'Structure', specificity: 'Specificity', pace: 'Pace',
    problem_solving: 'Problem Solving', code_correctness: 'Correctness',
    optimization_awareness: 'Optimization', star_structure: 'STAR',
    impact_articulation: 'Impact', ownership: 'Ownership',
  }
  return map[key] ?? key.replace(/_/g, ' ')
}

function MetricRing({ label, score }: { label: string; score: number }) {
  const pct = score / 100
  const r = 32
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  const color = pct >= 0.75 ? '#4ade80' : pct >= 0.55 ? '#f59e0b' : '#f87171'
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg className="-rotate-90" width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-medium text-paper">{score}</span>
        </div>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">{label}</p>
    </div>
  )
}

function QuestionAccordion({ qf, idx }: { qf: ApiFeedbackReport['per_question_feedback'][number]; idx: number }) {
  const [open, setOpen] = useState(idx === 0)
  const score = Math.round(qf.score * 10)
  const label = qf.question_text ?? `Question ${idx + 1}`
  return (
    <div className={cn('rounded-md border transition-all duration-200', open ? 'border-ember/20 bg-ink-900' : 'border-ink-700/60 bg-ink-900 hover:border-ink-600')}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-5 text-left">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-mono text-xs text-paper-faint shrink-0">Q{String(idx + 1).padStart(2, '0')}</span>
          <p className="text-sm font-medium text-paper line-clamp-1">{label}</p>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className={cn('font-mono text-sm font-semibold', score >= 75 ? 'text-moss' : score >= 55 ? 'text-ember' : 'text-crimson')}>{score}</span>
          <span className={cn('font-mono text-xs text-paper-faint transition-transform duration-200', open && 'rotate-180')}>▾</span>
        </div>
      </button>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}
          className="border-t border-ink-700/50 p-5 space-y-5">
          {qf.evidence.length > 0 && (
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-paper-faint">Evidence from your answer</p>
              <div className="space-y-2">
                {qf.evidence.map((e, i) => (
                  <div key={i} className="rounded-sm border-l-2 border-ember/50 bg-ember/5 px-4 py-3">
                    <p className="mb-1 text-sm text-paper italic">"{e.quote}"</p>
                    <p className="font-mono text-[10px] text-paper-faint">{e.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-moss">Strengths</p>
              <ul className="space-y-1.5">
                {qf.strengths.map((s, i) => <li key={i} className="flex gap-2 text-sm text-paper-dim"><span className="text-moss shrink-0">+</span>{s}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-crimson">Improve</p>
              <ul className="space-y-1.5">
                {qf.improvements.map((s, i) => <li key={i} className="flex gap-2 text-sm text-paper-dim"><span className="text-crimson shrink-0">△</span>{s}</li>)}
              </ul>
            </div>
          </div>
          {qf.better_answer_example && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-paper-faint">Stronger answer</p>
              <p className="rounded-sm border border-ink-700/50 bg-ink-800 px-4 py-3 text-sm leading-relaxed text-paper-dim italic">"{qf.better_answer_example}"</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

export function SampleFeedback() {
  const navigate = useNavigate()
  const [report, setReport] = useState<ApiFeedbackReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/feedback/demo`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setReport(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-widest text-paper-faint animate-pulse">Loading sample...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-xs text-crimson">Could not load sample feedback.</p>
          <button onClick={() => navigate('/')} className="mt-4 font-mono text-xs text-ember">← Back to home</button>
        </div>
      </div>
    )
  }

  const overallScore = Math.round(report.overall_score * 10)
  const scoreColor = overallScore >= 75 ? 'text-moss' : overallScore >= 55 ? 'text-ember' : 'text-crimson'

  const metrics = (Object.entries(report.category_scores) as [string, number | null][])
    .filter(([, v]) => v != null)
    .map(([k, v]) => ({ label: categoryLabel(k), score: Math.round((v ?? 0) * 10) }))

  const drills = report.targeted_drills.map((d) => d.replace(/^Practice:\s*/i, ''))

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3 rounded-sm border border-ember/20 bg-ember/5 px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ember shrink-0">Demo</span>
        <p className="font-mono text-[10px] text-paper-faint">
          This is a sample report.{' '}
          <button onClick={() => navigate('/setup')} className="text-ember hover:text-ember-soft underline underline-offset-2 transition-colors">
            Run a real session
          </button>{' '}
          to get feedback on your own interview.
        </p>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="mb-10">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-paper-faint">
            Technical · Two Sum · Sample session
          </p>
          <h1 className="font-display text-4xl font-semibold text-paper md:text-5xl">Interview Feedback</h1>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-8 rounded-md border border-ink-700/60 bg-ink-900 p-8">
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
            <div>
              <p className="mb-1 font-mono text-xs uppercase tracking-widest text-paper-faint">Overall score</p>
              <p className={cn('font-display text-7xl font-semibold leading-none', scoreColor)}>{overallScore}</p>
              <p className="mt-1 font-mono text-xs text-paper-faint">/ 100</p>
            </div>
            <div className="h-px w-full bg-ink-700/60 sm:h-20 sm:w-px" />
            <div className="flex flex-wrap gap-6">
              {metrics.map((m) => <MetricRing key={m.label} {...m} />)}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-moss/20 bg-moss/5 p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-moss">Top strengths</p>
            <ul className="space-y-2">
              {report.top_strengths.map((s, i) => <li key={i} className="flex gap-2 text-sm text-paper-dim"><span className="text-moss shrink-0">✓</span>{s}</li>)}
            </ul>
          </div>
          <div className="rounded-md border border-crimson/20 bg-crimson/5 p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-crimson">Areas to improve</p>
            <ul className="space-y-2">
              {report.top_weaknesses.map((w, i) => <li key={i} className="flex gap-2 text-sm text-paper-dim"><span className="text-crimson shrink-0">△</span>{w}</li>)}
            </ul>
          </div>
        </motion.div>

        {report.per_question_feedback.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-paper-faint">Question breakdown</p>
            <div className="space-y-3">
              {report.per_question_feedback.map((qf, i) => <QuestionAccordion key={qf.question_id} qf={qf} idx={i} />)}
            </div>
          </motion.div>
        )}

        {drills.length > 0 && (
          <motion.div variants={fadeUp} className="mb-10">
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-paper-faint">Targeted drills</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {drills.map((d, i) => (
                <div key={i} className="rounded-md border border-ink-700/60 bg-ink-900 p-5">
                  <p className="font-mono text-xs leading-relaxed text-paper-dim">{d}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4">
          <button onClick={() => navigate('/setup')}
            className="flex items-center gap-2 rounded-sm bg-ember px-5 py-2 font-mono text-xs text-ink-950 hover:bg-ember-soft transition-all duration-200">
            Try a real session →
          </button>
          <button onClick={() => navigate('/')}
            className="font-mono text-xs text-paper-faint hover:text-paper-dim transition-colors border-b border-transparent hover:border-paper-faint/30 pb-px">
            ← Back to home
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
