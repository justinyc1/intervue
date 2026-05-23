import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { apiFetch } from '@/lib/api'
import type { ApiSession, ApiSessionList, ApiFeedbackReport } from '@/lib/apiTypes'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
}

function StatCard({ label, value, sub, color = 'text-paper' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <motion.div variants={fadeUp} className="rounded-md border border-ink-700/60 bg-ink-900 p-5">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-paper-faint">{label}</p>
      <p className={cn('font-display text-3xl font-bold', color)}>{value}</p>
      {sub && <p className="mt-1 font-mono text-xs text-paper-faint">{sub}</p>}
    </motion.div>
  )
}

function ModeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs capitalize text-paper-dim">{label}</span>
        <span className="font-mono text-xs text-paper-faint">{count}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className={cn('h-1.5 rounded-full', color)}
        />
      </div>
    </div>
  )
}

function ActivityGrid({ sessions }: { sessions: ApiSession[] }) {
  const weeks = 12

  const cells = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    const map: Record<string, number> = {}
    for (const s of sessions) {
      const d = new Date(s.created_at)
      const key = d.toISOString().slice(0, 10)
      map[key] = (map[key] ?? 0) + 1
    }

    const result: { date: string; count: number }[] = []
    for (let w = weeks - 1; w >= 0; w--) {
      for (let d = 6; d >= 0; d--) {
        const date = new Date(today)
        date.setDate(date.getDate() - w * 7 - d)
        if (date > today) continue
        const key = date.toISOString().slice(0, 10)
        result.push({ date: key, count: map[key] ?? 0 })
      }
    }
    return result
  }, [sessions])

  const maxCount = Math.max(1, ...cells.map((c) => c.count))

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-paper-faint">Activity · last {weeks} weeks</p>
      <div className="flex gap-1 flex-wrap">
        {cells.map(({ date, count }) => {
          const intensity = count === 0 ? 0 : Math.ceil((count / maxCount) * 4)
          const bg = intensity === 0 ? 'bg-ink-800' : intensity === 1 ? 'bg-ember/25' : intensity === 2 ? 'bg-ember/45' : intensity === 3 ? 'bg-ember/70' : 'bg-ember'
          return (
            <div
              key={date}
              title={count > 0 ? `${date}: ${count} session${count > 1 ? 's' : ''}` : date}
              className={cn('h-3 w-3 rounded-sm transition-colors', bg)}
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[9px] text-paper-faint">Less</span>
        {[0, 1, 2, 3, 4].map((i) => {
          const bg = i === 0 ? 'bg-ink-800' : i === 1 ? 'bg-ember/25' : i === 2 ? 'bg-ember/45' : i === 3 ? 'bg-ember/70' : 'bg-ember'
          return <div key={i} className={cn('h-3 w-3 rounded-sm', bg)} />
        })}
        <span className="font-mono text-[9px] text-paper-faint">More</span>
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (!score) return <span className="font-mono text-xs text-paper-faint">—</span>
  const color = score >= 75 ? 'text-moss bg-moss/10 border-moss/20' : score >= 55 ? 'text-ember bg-ember/10 border-ember/20' : 'text-crimson bg-crimson/10 border-crimson/20'
  return <span className={cn('rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold', color)}>{score}</span>
}

export function Account() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { user } = useUser()

  const [sessions, setSessions] = useState<ApiSession[]>([])
  const [feedbackMap, setFeedbackMap] = useState<Record<string, ApiFeedbackReport>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = await getToken()
      if (!token) return
      try {
        const data = await apiFetch<ApiSessionList>('/api/interviews', token)
        if (cancelled) return
        setSessions(data.sessions)

        // Fetch feedback for completed sessions (up to 10)
        const completed = data.sessions.filter((s) => s.status === 'completed').slice(0, 10)
        const feedbackResults = await Promise.allSettled(
          completed.map((s) => apiFetch<ApiFeedbackReport>(`/api/feedback/${s.id}`, token))
        )
        if (cancelled) return
        const map: Record<string, ApiFeedbackReport> = {}
        feedbackResults.forEach((r, i) => {
          if (r.status === 'fulfilled') map[completed[i].id] = r.value
        })
        setFeedbackMap(map)
      } catch {
        // fail silently — page still renders without data
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getToken])

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed')
    const scores = completed.map((s) => feedbackMap[s.id]?.overall_score).filter(Boolean) as number[]
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisWeek = sessions.filter((s) => new Date(s.created_at) >= weekAgo).length

    const companyCounts: Record<string, number> = {}
    for (const s of sessions) {
      if (s.company) companyCounts[s.company] = (companyCounts[s.company] ?? 0) + 1
    }
    const topCompany = Object.entries(companyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const technical = sessions.filter((s) => s.mode === 'technical').length
    const behavioral = sessions.filter((s) => s.mode === 'behavioral').length
    const mixed = sessions.filter((s) => s.mode === 'mixed').length

    return { total: sessions.length, completed: completed.length, avgScore, thisWeek, topCompany, technical, behavioral, mixed }
  }, [sessions, feedbackMap])

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const recentSessions = sessions.slice(0, 6)

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <motion.div variants={stagger} initial="hidden" animate="show" className="mb-10">
        <motion.div variants={fadeUp} className="flex items-start gap-5 mb-8">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="avatar" className="h-16 w-16 rounded-full border border-ink-700/60 shrink-0" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ink-700/60 bg-ink-800 font-display text-2xl font-bold text-paper shrink-0">
              {user?.firstName?.[0] ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl font-bold text-paper">
              {user?.fullName ?? 'Your Account'}
            </h1>
            <p className="font-mono text-xs text-paper-faint mt-1">{user?.primaryEmailAddress?.emailAddress}</p>
            {memberSince && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint/50 mt-2">
                Member since {memberSince}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/setup')}
            className="shrink-0 group flex items-center gap-2 rounded-sm bg-ember px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink-950 transition-all hover:bg-ember-soft active:scale-[0.97]"
          >
            Begin session
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </motion.div>

        <motion.div variants={stagger} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total sessions" value={loading ? '—' : stats.total} sub={`${stats.thisWeek} this week`} />
          <StatCard label="Completed" value={loading ? '—' : stats.completed} sub={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% rate` : undefined} />
          <StatCard
            label="Avg score"
            value={loading ? '—' : (stats.avgScore ?? '—')}
            sub={stats.avgScore ? (stats.avgScore >= 75 ? 'Strong performance' : stats.avgScore >= 55 ? 'Room to grow' : 'Keep practicing') : 'Complete sessions for scores'}
            color={stats.avgScore ? (stats.avgScore >= 75 ? 'text-moss' : stats.avgScore >= 55 ? 'text-ember' : 'text-crimson') : 'text-paper'}
          />
          <StatCard label="Top company" value={loading ? '—' : (stats.topCompany ?? '—')} sub={stats.topCompany ? 'most practiced' : 'pick a company next session'} />
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="rounded-md border border-ink-700/60 bg-ink-900 p-6"
          >
            {loading ? (
              <div className="h-16 animate-pulse rounded-sm bg-ink-800" />
            ) : (
              <ActivityGrid sessions={sessions} />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="rounded-md border border-ink-700/60 bg-ink-900 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Recent Sessions</p>
              <button
                onClick={() => navigate('/history')}
                className="font-mono text-[10px] uppercase tracking-widest text-ember hover:text-ember-soft transition-colors"
              >
                View all →
              </button>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-sm bg-ink-800" />
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-mono text-xs text-paper-faint mb-3">No sessions yet</p>
                <button onClick={() => navigate('/setup')} className="font-mono text-xs text-ember hover:text-ember-soft transition-colors">
                  Start your first session →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((s) => {
                  const feedback = feedbackMap[s.id]
                  return (
                    <button
                      key={s.id}
                      onClick={() => s.status === 'completed' && navigate(`/feedback/${s.id}`)}
                      className={cn(
                        'group flex w-full items-center gap-4 rounded-sm border border-ink-700/50 bg-ink-800/40 px-4 py-3 text-left transition-all duration-150',
                        s.status === 'completed' ? 'hover:border-ember/20 hover:bg-ink-800 cursor-pointer' : 'cursor-default'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-paper truncate">{s.role ?? 'Session'}</p>
                        <p className="font-mono text-[10px] text-paper-faint">
                          {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {s.company && ` · ${s.company}`}
                        </p>
                      </div>
                      <span className={cn(
                        'shrink-0 rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
                        s.mode === 'technical' ? 'bg-ember/10 text-ember border border-ember/20' :
                        s.mode === 'behavioral' ? 'bg-paper/5 text-paper-dim border border-ink-700/60' :
                        'bg-moss/10 text-moss border border-moss/20'
                      )}>
                        {s.mode}
                      </span>
                      <ScoreBadge score={feedback?.overall_score} />
                      {s.status === 'completed' && (
                        <span className="shrink-0 font-mono text-[10px] text-paper-faint/50 group-hover:text-ember transition-colors">→</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="rounded-md border border-ink-700/60 bg-ink-900 p-6"
          >
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-paper-faint">Practice breakdown</p>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded-sm bg-ink-800" />)}
              </div>
            ) : stats.total === 0 ? (
              <p className="font-mono text-xs text-paper-faint">No sessions yet</p>
            ) : (
              <div className="space-y-4">
                <ModeBar label="Technical" count={stats.technical} total={stats.total} color="bg-ember" />
                <ModeBar label="Behavioral" count={stats.behavioral} total={stats.total} color="bg-paper/40" />
                <ModeBar label="Mixed" count={stats.mixed} total={stats.total} color="bg-moss" />
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-md border border-ink-700/60 bg-ink-900 p-6"
          >
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-paper-faint">Next steps</p>
            <div className="space-y-3">
              {[
                { icon: '⌨', label: 'Technical coding round', sub: 'Live editor + test runner', to: '/setup' },
                { icon: '◎', label: 'Behavioral STAR session', sub: 'Adaptive follow-ups', to: '/setup' },
                { icon: '◈', label: 'View past feedback', sub: 'Evidence-based analysis', to: '/history' },
              ].map(({ icon, label, sub, to }) => (
                <button
                  key={label}
                  onClick={() => navigate(to)}
                  className="group flex w-full items-center gap-3 rounded-sm border border-ink-700/50 bg-ink-800/40 px-3 py-2.5 text-left transition-all duration-150 hover:border-ember/20 hover:bg-ink-800"
                >
                  <span className="text-base text-ember">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-paper">{label}</p>
                    <p className="font-mono text-[10px] text-paper-faint">{sub}</p>
                  </div>
                  <span className="font-mono text-[10px] text-paper-faint/40 group-hover:text-ember transition-colors">→</span>
                </button>
              ))}
            </div>
          </motion.div>

          {!loading && stats.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-md border border-ember/20 bg-ember/5 p-5"
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-ember mb-2">Keep going</p>
              <p className="text-sm text-paper-dim leading-relaxed">
                {stats.completed === 0
                  ? 'Finish your first session to unlock your performance score.'
                  : stats.avgScore && stats.avgScore >= 75
                    ? `Avg score of ${stats.avgScore} — you're performing well. Push yourself with a harder difficulty.`
                    : stats.avgScore
                      ? `Avg score of ${stats.avgScore}. Consistent practice is the fastest way up.`
                      : `${stats.completed} completed session${stats.completed > 1 ? 's' : ''}. Keep practicing to see your trends.`}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
