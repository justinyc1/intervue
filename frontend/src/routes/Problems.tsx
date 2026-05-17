import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { apiFetch } from '@/lib/api'
import type { ApiProblemListItem, ApiProblemListResponse, ApiProblemDetail, ApiSolvedSlugsResponse, ApiMarkSolvedResponse } from '@/lib/apiTypes'

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard'

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    easy: 'text-moss bg-moss/10 border-moss/20',
    medium: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20',
    hard: 'text-crimson bg-crimson/10 border-crimson/20',
  }
  return (
    <span className={cn('rounded-sm border px-2 py-0.5 font-mono text-xs font-semibold capitalize', styles[difficulty] ?? 'text-paper-faint border-ink-700/40')}>
      {difficulty}
    </span>
  )
}

function ProblemCard({ problem, onSelect, isSolved }: { problem: ApiProblemListItem; onSelect: () => void; isSolved: boolean }) {
  return (
    <motion.div
      variants={fadeUp}
      onClick={onSelect}
      className="group cursor-pointer rounded-sm border border-ink-700/60 bg-ink-900/40 p-4 transition-all duration-200 hover:border-paper-faint/20 hover:bg-ink-800/40"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex-1 font-sans text-sm font-medium text-paper line-clamp-2">
          {problem.title}
        </p>
        <DifficultyBadge difficulty={problem.difficulty} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {isSolved && (
          <span className="rounded-sm border border-moss/30 bg-moss/10 px-1.5 py-0.5 font-mono text-[10px] text-moss">
            ✓ solved
          </span>
        )}
        {problem.has_test_cases && (
          <span className="rounded-sm border border-moss/20 bg-moss/8 px-1.5 py-0.5 font-mono text-[10px] text-moss">
            ✓ runnable
          </span>
        )}
        {problem.topic_tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-sm border border-ink-700/40 px-1.5 py-0.5 font-mono text-[10px] text-paper-faint">
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

function DetailPanel({ slug, onClose, onPractice, isSolved, onSolve, onTestsGenerated }: {
  slug: string
  onClose: () => void
  onPractice: (difficulty: string) => void
  isSolved: boolean
  onSolve: () => void
  onTestsGenerated: () => void
}) {
  const { getToken } = useAuth()
  const [detail, setDetail] = useState<ApiProblemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingDone, setMarkingDone] = useState(false)
  const [generatingTests, setGeneratingTests] = useState(false)
  const [preparingPractice, setPreparingPractice] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setDetail(null)
      setError(null)
      try {
        const token = await getToken()
        const data = await apiFetch<ApiProblemDetail>(`/api/problems/${slug}`, token ?? '')
        if (!cancelled) setDetail(data)
      } catch {
        if (!cancelled) setError('Failed to load problem details.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, getToken])

  async function handleMarkSolved() {
    if (isSolved || markingDone) return
    setMarkingDone(true)
    try {
      const token = await getToken()
      if (!token) { setMarkingDone(false); return }
      await apiFetch<ApiMarkSolvedResponse>(`/api/problems/${slug}/solve`, token, { method: 'POST' })
      onSolve()
      setMarkingDone(false)
    } catch {
      setMarkingDone(false)
    }
  }

  async function handleGenerateTests() {
    if (generatingTests) return
    setGeneratingTests(true)
    try {
      const token = await getToken()
      if (!token) { setGeneratingTests(false); return }
      const updated = await apiFetch<ApiProblemDetail>(
        `/api/problems/${slug}/generate-tests`,
        token,
        { method: 'POST' }
      )
      setDetail(updated)
      onTestsGenerated()
    } catch {
      toast.error('Failed to generate test cases. Try again.')
      setGeneratingTests(false)
    }
  }

  async function handlePractice() {
    if (!detail || preparingPractice) return
    if (detail.source === 'leetcode' && !detail.has_test_cases) {
      setPreparingPractice(true)
      const difficulty = detail.difficulty
      try {
        const token = await getToken()
        if (!token) { setPreparingPractice(false); return }
        const updated = await apiFetch<ApiProblemDetail>(
          `/api/problems/${slug}/generate-tests`,
          token,
          { method: 'POST' }
        )
        setDetail(updated)
        onTestsGenerated()
        onPractice(difficulty)
      } catch {
        setPreparingPractice(false)
      }
    } else {
      onPractice(detail.difficulty)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-ink-700/60 bg-ink-950 shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700/60 bg-ink-950/95 px-6 py-4 backdrop-blur-md">
        <span className="font-mono text-xs uppercase tracking-widest text-paper-faint">Problem Detail</span>
        <button onClick={onClose} className="font-mono text-xs text-paper-faint hover:text-paper transition-colors">
          ✕ close
        </button>
      </div>

      <div className="px-6 py-6">
        {loading && <p className="font-mono text-xs text-paper-faint animate-pulse">Loading…</p>}
        {error && <p className="font-mono text-xs text-crimson">{error}</p>}
        {detail && (
          <div className="space-y-6">
            <div>
              <h2 className="font-sans text-xl font-bold text-paper">{detail.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={detail.difficulty} />
                {detail.has_test_cases && (
                  <span className="rounded-sm border border-moss/20 bg-moss/8 px-1.5 py-0.5 font-mono text-[10px] text-moss">
                    ✓ runnable
                  </span>
                )}
                {detail.topic_tags.map((tag) => (
                  <span key={tag} className="rounded-sm border border-ink-700/40 px-1.5 py-0.5 font-mono text-[10px] text-paper-faint">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <p className="font-sans text-sm leading-relaxed text-paper-dim whitespace-pre-wrap">
              {detail.description}
            </p>

            {detail.examples.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-paper-faint">Examples</h3>
                <div className="space-y-3">
                  {detail.examples.map((ex, i) => (
                    <div key={i} className="rounded-sm border border-ink-700/60 bg-ink-900/40 p-3 font-mono text-xs">
                      <p className="text-paper-faint">Input: <span className="text-paper">{ex.input}</span></p>
                      <p className="text-paper-faint">Output: <span className="text-paper">{ex.output}</span></p>
                      {ex.explanation && (
                        <p className="mt-1 text-paper-faint">Note: <span className="text-paper-dim">{ex.explanation}</span></p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.constraints.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-paper-faint">Constraints</h3>
                <ul className="space-y-1">
                  {detail.constraints.map((c, i) => (
                    <li key={i} className="font-mono text-xs text-paper-dim">• {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {detail.hints.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-xs uppercase tracking-widest text-paper-faint">Hints</h3>
                <ul className="space-y-1">
                  {detail.hints.map((h, i) => (
                    <li key={i} className="font-mono text-xs text-paper-dim">• {h}</li>
                  ))}
                </ul>
              </div>
            )}

            {detail.source === 'leetcode' && !detail.has_test_cases && (
              <button
                onClick={handleGenerateTests}
                disabled={generatingTests}
                className={cn(
                  'w-full rounded-sm border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200',
                  generatingTests
                    ? 'border-paper-faint/10 bg-ink-800/20 text-paper-faint cursor-wait'
                    : 'border-paper-faint/20 bg-ink-800/40 text-paper-dim hover:border-paper-faint/40 hover:text-paper'
                )}
              >
                {generatingTests ? 'Generating test cases…' : '⚡ Generate test cases'}
              </button>
            )}

            <button
              onClick={handlePractice}
              disabled={preparingPractice}
              className={cn(
                'w-full rounded-sm border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200',
                preparingPractice
                  ? 'border-ember/20 bg-ember/5 text-ember/50 cursor-wait'
                  : 'border-ember/30 bg-ember/8 text-ember hover:border-ember/60 hover:bg-ember/15'
              )}
            >
              {preparingPractice ? 'Preparing…' : 'Practice this problem →'}
            </button>

            <button
              onClick={handleMarkSolved}
              disabled={isSolved || markingDone}
              className={cn(
                'w-full rounded-sm border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-200',
                isSolved || markingDone
                  ? 'border-moss/20 bg-moss/5 text-moss/50 cursor-not-allowed'
                  : 'border-moss/30 bg-moss/8 text-moss hover:border-moss/60 hover:bg-moss/15'
              )}
            >
              {isSolved ? '✓ Marked as solved' : markingDone ? 'Saving…' : 'Mark as solved'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function Problems() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [filter, setFilter] = useState<DifficultyFilter>('all')
  const [search, setSearch] = useState('')
  const [problems, setProblems] = useState<ApiProblemListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [solvedSlugs, setSolvedSlugs] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadSolved() {
      try {
        const token = await getToken()
        if (!token) return
        const data = await apiFetch<ApiSolvedSlugsResponse>('/api/problems/solved', token)
        setSolvedSlugs(new Set(data.solved_slugs))
      } catch {
        // non-critical
      }
    }
    loadSolved()
  }, [getToken])

  const allTags = useMemo(() => {
    const set = new Set<string>()
    problems.forEach((p) => p.topic_tags.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [problems])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const token = await getToken()
        const params = new URLSearchParams({ limit: '200' })
        if (filter !== 'all') params.set('difficulty', filter)
        const data = await apiFetch<ApiProblemListResponse>(`/api/problems?${params}`, token ?? '')
        if (!cancelled) { setProblems(data.problems); setTotal(data.total) }
      } catch {
        if (!cancelled) setError('Failed to load problems.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filter, getToken])

  const displayed = useMemo(() => {
    let result = problems
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) => p.title.toLowerCase().includes(q) || p.topic_tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (selectedTags.size > 0) {
      result = result.filter((p) => [...selectedTags].every((t) => p.topic_tags.includes(t)))
    }
    return result
  }, [problems, search, selectedTags])

  const filterTabs: { label: string; value: DifficultyFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Easy', value: 'easy' },
    { label: 'Medium', value: 'medium' },
    { label: 'Hard', value: 'hard' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
        <h1 className="font-sans text-3xl font-bold tracking-tight text-paper">Problems</h1>
        <p className="mt-1 font-mono text-xs text-paper-faint">
          {loading ? 'Loading…' : `${total} problems available`}
        </p>
      </motion.div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-sm border border-ink-700/60 bg-ink-900/40 p-1">
          {filterTabs.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'rounded-sm px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-all duration-150',
                filter === value ? 'bg-ink-700/80 text-paper' : 'text-paper-faint hover:text-paper'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search problems…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-sm border border-ink-700/60 bg-ink-900/40 px-3 py-2 font-mono text-xs text-paper placeholder-paper-faint focus:border-paper-faint/30 focus:outline-none sm:w-56"
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-paper-faint">Tags:</span>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedTags((prev) => {
                    const next = new Set(prev)
                    if (next.has(tag)) next.delete(tag)
                    else next.add(tag)
                    return next
                  })
                }
                className={cn(
                  'rounded-sm border px-2 py-0.5 font-mono text-[10px] transition-all duration-150',
                  selectedTags.has(tag)
                    ? 'border-ember/50 bg-ember/15 text-ember'
                    : 'border-ink-700/40 text-paper-faint hover:border-ink-600 hover:text-paper-dim'
                )}
              >
                {tag}
              </button>
            ))}
            {selectedTags.size > 0 && (
              <button
                onClick={() => setSelectedTags(new Set())}
                className="ml-2 font-mono text-[10px] text-paper-faint hover:text-crimson transition-colors"
              >
                × clear
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mb-6 font-mono text-xs text-crimson">{error}</p>}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm border border-ink-700/60 bg-ink-900/40 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <p className="font-mono text-xs text-paper-faint">No problems match your search.</p>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((p) => (
            <ProblemCard key={p.slug} problem={p} onSelect={() => setSelectedSlug(p.slug)} isSolved={solvedSlugs.has(p.slug)} />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedSlug && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedSlug(null)}
              className="fixed inset-0 z-30 bg-ink-950/60 backdrop-blur-sm"
            />
            <DetailPanel
              slug={selectedSlug}
              onClose={() => setSelectedSlug(null)}
              onPractice={(difficulty) => navigate(
                `/setup?type=technical&difficulty=${difficulty}&problem_id=${selectedSlug}`
              )}
              isSolved={solvedSlugs.has(selectedSlug)}
              onSolve={() => setSolvedSlugs((prev) => new Set([...prev, selectedSlug]))}
              onTestsGenerated={() => {
                setProblems((prev) =>
                  prev.map((p) => p.slug === selectedSlug ? { ...p, has_test_cases: true } : p)
                )
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
