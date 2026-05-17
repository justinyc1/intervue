import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'
import { companies } from '@/lib/mock/companies'
import { personas, behavioralPersonas } from '@/lib/mock/personas'
import { apiFetch, API_BASE } from '@/lib/api'
import type { ApiSession } from '@/lib/apiTypes'
import type { Difficulty, InterviewerPersona, BehavioralPersona } from '@/lib/types'

// ── Types ────────────────────────────────────────────────
type InterviewType = 'behavioral' | 'technical' | 'resume' | ''

interface SetupState {
  interviewType: InterviewType
  behavioralPersona: BehavioralPersona | ''
  role: string
  company: string
  difficulty: Difficulty | ''
  technicalPersona: InterviewerPersona | ''
  durationMinutes: number | undefined
  resumeFile: File | null
  resumeText: string
  resumeS3Url: string
  problemId: string | undefined
}

// ── Static data ──────────────────────────────────────────
const ROLES = [
  { id: 'intern',    label: 'Software Engineer Intern', hint: 'Data structures, algorithms, behavioral' },
  { id: 'new-grad',  label: 'New Grad SWE',             hint: 'Core SWE loop, system design intro' },
  { id: 'mid',       label: 'Mid-Level SWE',            hint: 'System design, technical depth, ownership' },
  { id: 'senior',    label: 'Senior SWE',               hint: 'System design, leadership, execution' },
]

const DIFFICULTIES = [
  { id: 'easy'   as Difficulty, label: 'Easy',   hint: 'Fundamentals, warm-up' },
  { id: 'medium' as Difficulty, label: 'Medium', hint: 'Standard FAANG screen' },
  { id: 'hard'   as Difficulty, label: 'Hard',   hint: 'Senior / staff level depth' },
]

const DURATIONS = [
  { mins: 20, label: '20 min', hint: 'Quick warm-up' },
  { mins: 30, label: '30 min', hint: 'Short screen' },
  { mins: 45, label: '45 min', hint: 'Standard session' },
  { mins: 60, label: '60 min', hint: 'Full loop round' },
]

const INTERVIEW_TYPES = [
  { id: 'behavioral'  as InterviewType, k: '01', label: 'Behavioral',      hint: 'STAR questions + adaptive follow-ups' },
  { id: 'technical'   as InterviewType, k: '02', label: 'Technical',        hint: 'LeetCode-style coding with voice interviewer' },
  { id: 'resume'      as InterviewType, k: '03', label: 'Resume Deep Dive', hint: 'Questions tailored to your CV' },
]

// Persona accent colors
const PERSONA_COLORS: Record<string, string> = {
  friendly:   '#22c55e',
  neutral:    '#5B5BD6',
  intense:    '#22c55e',
  skeptical:  '#f87171',
  supportive: '#22c55e',
  corporate:  '#5B5BD6',
  pressure:   '#22c55e',
  probing:    '#f87171',
}

const PERSONA_TONE_LABELS: Record<string, string> = {
  friendly:   'Friendly',
  neutral:    'Neutral',
  intense:    'Intense',
  skeptical:  'Skeptical',
  supportive: 'Supportive',
  corporate:  'Corporate',
  pressure:   'Pressure',
  probing:    'Probing',
}

// ── Step helpers ─────────────────────────────────────────
function totalSteps(interviewType: InterviewType): number {
  if (interviewType === 'behavioral') return 3
  if (interviewType === 'technical')  return 6
  if (interviewType === 'resume')     return 4
  return 1
}

function stepLabel(step: number, interviewType: InterviewType): { eyebrow: string; title: string; subtitle: string } {
  if (step === 1) return { eyebrow: 'STEP 01 — FORMAT', title: 'What kind of interview?', subtitle: 'Pick the format you want to practice today.' }

  if (interviewType === 'behavioral') {
    if (step === 2) return { eyebrow: 'STEP 02 — DURATION', title: 'How long do you have?', subtitle: 'We\'ll pace the questions to fit your window.' }
    if (step === 3) return { eyebrow: 'STEP 03 — INTERVIEWER', title: "Interviewer", subtitle: 'Pick a persona. Each has a different pace and follow-up style.' }
  }

  if (interviewType === 'resume') {
    if (step === 2) return { eyebrow: 'STEP 02 — RESUME', title: 'Upload your resume', subtitle: 'We\'ll tailor every question to your specific experience.' }
    if (step === 3) return { eyebrow: 'STEP 03 — DURATION', title: 'How long do you have?', subtitle: 'We\'ll pace the questions to fit your window.' }
    if (step === 4) return { eyebrow: 'STEP 04 — INTERVIEWER', title: "Interviewer", subtitle: 'Pick a persona. Each has a different pace and follow-up style.' }
  }

  if (interviewType === 'technical') {
    if (step === 2) return { eyebrow: 'STEP 02 — ROLE', title: 'What level are you targeting?', subtitle: 'We\'ll calibrate question depth and expectations.' }
    if (step === 3) return { eyebrow: 'STEP 03 — COMPANY', title: 'Which company should we tailor for?', subtitle: 'We\'ll adapt the style and focus areas to match their loop.' }
    if (step === 4) return { eyebrow: 'STEP 04 — DIFFICULTY', title: 'How hard should we push?', subtitle: 'This sets the problem tier and follow-up depth.' }
    if (step === 5) return { eyebrow: 'STEP 05 — DURATION', title: 'How long do you have?', subtitle: 'We\'ll pace the problem to fit your window.' }
    if (step === 6) return { eyebrow: 'STEP 06 ', title: "Interviewer", subtitle: 'Pick a persona. Each has a different pace and follow-up style.' }
  }

  return { eyebrow: '', title: '', subtitle: '' }
}

// ── OptionCard ───────────────────────────────────────────
function OptionCard({
  selected, onClick, label, hint, tag,
}: {
  selected: boolean; onClick: () => void; label: string; hint?: string; tag?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full rounded-2xl border p-5 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2',
        selected
          ? 'border-ember/60 bg-ember/[0.06] shadow-[0_10px_30px_-16px_rgba(34,197,94,0.30)]'
          : 'border-white/[0.07] bg-ink-900 shadow-card hover:border-white/[0.15] hover:shadow-card-hover'
      )}
    >
      {tag && (
        <p className={cn('mb-2 font-mono text-[10px] uppercase tracking-widest', selected ? 'text-ember' : 'text-paper-faint')}>
          {tag}
        </p>
      )}
      <p
        className={cn('text-base font-semibold', selected ? 'text-paper' : 'text-paper-dim group-hover:text-paper')}
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
      >
        {label}
      </p>
      {hint && <p className="mt-1.5 text-sm leading-relaxed text-paper-faint">{hint}</p>}
    </button>
  )
}

// ── PersonaCard ──────────────────────────────────────────
function PersonaCard({
  id, name, description, selected, onClick,
}: {
  id: string; name: string; description: string; selected: boolean; onClick: () => void
}) {
  const color = PERSONA_COLORS[id] ?? '#6B6B72'
  const tone  = PERSONA_TONE_LABELS[id] ?? id

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full rounded-2xl border p-[22px] text-left transition-all duration-200 hover:scale-[1.01] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember focus-visible:outline-offset-2',
        selected
          ? 'border-ember/60 bg-ember/[0.06] shadow-[0_10px_30px_-16px_rgba(34,197,94,0.30)]'
          : 'border-white/[0.07] bg-ink-900 shadow-card hover:border-white/[0.15]'
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white text-base font-semibold"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)`, fontFamily: 'var(--font-display)' }}
        >
          {name[0]}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-paper" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
            {name}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint mt-0.5">{tone}</p>
        </div>

        {selected && (
          <span className="shrink-0 rounded-full bg-ember text-ink-950 px-2.5 py-1 font-mono text-[10px] font-semibold">
            SELECTED
          </span>
        )}
      </div>

      <p className="text-[13.5px] leading-relaxed text-paper-dim">{description}</p>
    </button>
  )
}

// ── Slide animation ──────────────────────────────────────
const slideVariants = {
  enter:  { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0,  transition: { duration: 0.35, ease: 'easeOut' as const } },
  exit:   { opacity: 0, x: -24, transition: { duration: 0.2 } },
}

// ── Main component ───────────────────────────────────────
export function Setup() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [searchParams] = useSearchParams()

  const presetType       = (searchParams.get('type')       ?? '') as InterviewType
  const presetRole       =  searchParams.get('role')       ?? ''
  const presetCompany    =  searchParams.get('company')    ?? ''
  const presetDifficulty = (searchParams.get('difficulty') ?? '') as Difficulty | ''
  const presetProblemId  =  searchParams.get('problem_id') ?? ''
  const hasPreset = presetType === 'technical' && !!presetRole && !!presetCompany && !!presetDifficulty && !!presetProblemId

  const [step, setStep]       = useState(hasPreset ? 5 : 1)
  const [loading, setLoading] = useState(false)
  const fileInputRef          = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [state, setState] = useState<SetupState>({
    interviewType:     presetType,
    behavioralPersona: '',
    role:              presetRole,
    company:           presetCompany,
    difficulty:        presetDifficulty,
    technicalPersona:  '',
    durationMinutes:   hasPreset ? 45 : undefined,
    resumeFile:        null,
    resumeText:        '',
    resumeS3Url:       '',
    problemId:         presetProblemId || undefined,
  })

  const total       = totalSteps(state.interviewType)
  const isFinalStep = step === total
  const progressPct = total > 1 ? ((step - 1) / (total - 1)) * 100 : 0

  const canAdvance = (): boolean => {
    if (step === 1) return !!state.interviewType
    if (state.interviewType === 'behavioral') {
      if (step === 2) return !!state.durationMinutes
      if (step === 3) return !!state.behavioralPersona
    }
    if (state.interviewType === 'resume') {
      if (step === 2) return !!state.resumeFile && !!state.resumeText
      if (step === 3) return !!state.durationMinutes
      if (step === 4) return !!state.behavioralPersona
    }
    if (state.interviewType === 'technical') {
      if (step === 2) return !!state.role
      if (step === 3) return !!state.company
      if (step === 4) return !!state.difficulty
      if (step === 5) return !!state.durationMinutes
      if (step === 6) return !!state.technicalPersona
    }
    return false
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are supported.'); return }
    setIsUploading(true)
    setState(s => ({ ...s, resumeFile: file }))
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE}/api/upload/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      })
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      setState(s => ({ ...s, resumeText: data.text, resumeS3Url: data.s3_url }))
      toast.success('Resume parsed successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to parse resume.')
      setState(s => ({ ...s, resumeFile: null, resumeText: '', resumeS3Url: '' }))
    } finally {
      setIsUploading(false)
    }
  }

  const handleStart = async () => {
    if (loading) return
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      let session: ApiSession

      if (state.interviewType === 'behavioral') {
        session = await apiFetch<ApiSession>('/api/interviews/behavioral', token, {
          method: 'POST',
          body: JSON.stringify({ duration_minutes: state.durationMinutes, behavioral_persona: state.behavioralPersona }),
        })
      } else if (state.interviewType === 'resume') {
        session = await apiFetch<ApiSession>('/api/interviews', token, {
          method: 'POST',
          body: JSON.stringify({
            mode: 'resume',
            duration_minutes: state.durationMinutes,
            behavioral_persona: state.behavioralPersona,
            role: 'Software Engineer',
            resume_text: state.resumeText,
            resume_s3_url: state.resumeS3Url,
          }),
        })
      } else {
        const roleLabel    = ROLES.find(r => r.id === state.role)?.label ?? state.role
        const companyName  = companies.find(c => c.id === state.company)?.name ?? state.company
        session = await apiFetch<ApiSession>('/api/interviews', token, {
          method: 'POST',
          body: JSON.stringify({
            mode: 'technical',
            role: roleLabel,
            company: companyName,
            difficulty: state.difficulty,
            duration_minutes: state.durationMinutes,
            interviewer_tone: state.technicalPersona,
            ...(state.problemId ? { problem_id: state.problemId } : {}),
          }),
        })
      }

      navigate(`/interview/${session.id}/${session.mode === 'behavioral' || session.mode === 'resume' ? 'behavioral' : 'technical'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('generate-tests') || msg.includes('no test cases')) {
        toast.error('Problem not ready — test cases still generating. Try again in a moment.')
      } else {
        toast.error('Failed to create session')
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Summary rail data
  let summaryRows: { label: string; value: string | null | undefined }[] = []
  if (state.interviewType === 'behavioral') {
    summaryRows = [
      { label: 'Type',        value: 'Behavioral' },
      { label: 'Duration',    value: state.durationMinutes ? `${state.durationMinutes} min` : null },
      { label: 'Interviewer', value: state.behavioralPersona ? behavioralPersonas.find(p => p.id === state.behavioralPersona)?.name : null },
    ]
  } else if (state.interviewType === 'resume') {
    summaryRows = [
      { label: 'Type',        value: 'Resume Deep Dive' },
      { label: 'Resume',      value: state.resumeFile ? state.resumeFile.name : null },
      { label: 'Duration',    value: state.durationMinutes ? `${state.durationMinutes} min` : null },
      { label: 'Interviewer', value: state.behavioralPersona ? behavioralPersonas.find(p => p.id === state.behavioralPersona)?.name : null },
    ]
  } else {
    summaryRows = [
      { label: 'Type',        value: state.interviewType ? 'Technical' : null },
      { label: 'Role',        value: state.role       ? ROLES.find(r => r.id === state.role)?.label : null },
      { label: 'Company',     value: state.company    ? companies.find(c => c.id === state.company)?.name : null },
      { label: 'Difficulty',  value: state.difficulty ? state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1) : null },
      { label: 'Duration',    value: state.durationMinutes ? `${state.durationMinutes} min` : null },
      { label: 'Interviewer', value: state.technicalPersona ? personas.find(p => p.id === state.technicalPersona)?.name : null },
    ]
  }

  // Persona warning tip
  const activePersonaId = state.technicalPersona || state.behavioralPersona
  const personaWarnings: Record<string, string> = {
    intense:  'Adam will interrupt within 30s of silence. Have your mic ready.',
    pressure: 'Fin cuts off rambling. Keep answers tight — aim for under 90s.',
    skeptical:'Callum will challenge every claim. Prepare to back up tradeoffs.',
    probing:  'Clyde questions every detail. Have specific examples ready.',
  }
  const headsUp = activePersonaId ? personaWarnings[activePersonaId] : null

  const { eyebrow, title, subtitle } = stepLabel(step, state.interviewType)
  const stepNumLabel = String(step).padStart(2, '0')
  const totalLabel   = String(total).padStart(2, '0')

  return (
    <div className="min-h-screen bg-ink-950">

      {/* ── Top bar ── */}
      <div className="bg-ink-950 border-b border-white/[0.06]" style={{ padding: '18px 36px' }}>
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          {/* Logo + step label */}
          <div className="flex items-center gap-3 shrink-0">
          </div>

          <span className="font-mono text-[11px] uppercase tracking-widest text-paper-faint ml-4">
            Session setup · {stepNumLabel} / {totalLabel}
          </span>

          {/* Progress bar */}
          <div className="flex-1 mx-4 h-[3px] rounded-full overflow-hidden bg-ink-700/60">
            <motion.div
              className="h-full rounded-full bg-ember"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <button
            onClick={() => navigate('/')}
            className="font-mono text-[11px] text-paper-faint hover:text-paper transition-colors"
          >
            ✕ Cancel
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">

          {/* Main content */}
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {/* Step eyebrow */}
                <p className="font-mono text-[11px] uppercase tracking-widest text-ember mb-2">
                  {eyebrow}
                </p>

                {/* Heading */}
                <h1
                  className="font-semibold text-paper mb-3"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,4vw,3.25rem)', letterSpacing: '-0.03em', lineHeight: 1 }}
                >
                  {title}
                </h1>
                <p className="text-[15px] text-paper-dim mb-10 max-w-[520px] leading-relaxed">{subtitle}</p>

                {/* ─── Step 1: Interview type ─── */}
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {INTERVIEW_TYPES.map(t => (
                      <OptionCard
                        key={t.id}
                        selected={state.interviewType === t.id}
                        onClick={() => setState(s => ({ ...s, interviewType: t.id }))}
                        label={t.label}
                        hint={t.hint}
                        tag={t.k}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Resume: upload ─── */}
                {state.interviewType === 'resume' && step === 2 && (
                  <div>
                    <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    <div
                      onClick={() => !state.resumeFile && fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.1] bg-ink-900 p-16 text-center transition-colors hover:border-ember/40 hover:bg-ember/[0.03] cursor-pointer"
                    >
                      <div className="mb-5 rounded-full bg-ink-800 p-4 text-paper-faint">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="12 12 12 18" /><polyline points="9 15 12 18 15 15" />
                        </svg>
                      </div>
                      {state.resumeFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <p className="font-semibold text-paper" style={{ fontFamily: 'var(--font-display)' }}>{state.resumeFile.name}</p>
                          {isUploading
                            ? <p className="text-sm text-ember animate-pulse">Parsing and uploading…</p>
                            : <p className="text-sm text-moss font-medium">✓ Ready</p>
                          }
                          <button
                            onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                            className="mt-3 font-mono text-xs text-paper-faint underline hover:text-paper"
                          >
                            Choose a different file
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold text-paper mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Drop your resume PDF here</p>
                          <p className="text-sm text-paper-faint mb-6">or click to browse — PDF only</p>
                          <button
                            onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                            className="btn-primary text-sm"
                          >
                            <span className="btn-dot" />Browse files<span className="btn-arrow">→</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Duration ─── */}
                {((state.interviewType === 'behavioral' && step === 2) || (state.interviewType === 'resume' && step === 3) || (state.interviewType === 'technical' && step === 5)) && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {DURATIONS.map(d => (
                      <OptionCard
                        key={d.mins}
                        selected={state.durationMinutes === d.mins}
                        onClick={() => setState(s => ({ ...s, durationMinutes: d.mins }))}
                        label={d.label}
                        hint={d.hint}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Behavioral / Resume personas ─── */}
                {((state.interviewType === 'behavioral' && step === 3) || (state.interviewType === 'resume' && step === 4)) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {behavioralPersonas.map(p => (
                      <PersonaCard
                        key={p.id} id={p.id} name={p.name} description={p.description}
                        selected={state.behavioralPersona === p.id}
                        onClick={() => setState(s => ({ ...s, behavioralPersona: p.id as BehavioralPersona }))}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Technical: role ─── */}
                {state.interviewType === 'technical' && step === 2 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {ROLES.map(r => (
                      <OptionCard key={r.id} selected={state.role === r.id}
                        onClick={() => setState(s => ({ ...s, role: r.id }))} label={r.label} hint={r.hint} />
                    ))}
                  </div>
                )}

                {/* ─── Technical: company ─── */}
                {state.interviewType === 'technical' && step === 3 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {companies.map(c => (
                      <OptionCard key={c.id} selected={state.company === c.id}
                        onClick={() => setState(s => ({ ...s, company: c.id }))}
                        label={c.name} hint={c.behavioralThemes.slice(0, 2).join(' · ')} />
                    ))}
                  </div>
                )}

                {/* ─── Technical: difficulty ─── */}
                {state.interviewType === 'technical' && step === 4 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {DIFFICULTIES.map(d => (
                      <OptionCard key={d.id} selected={state.difficulty === d.id}
                        onClick={() => setState(s => ({ ...s, difficulty: d.id }))} label={d.label} hint={d.hint} />
                    ))}
                  </div>
                )}

                {/* ─── Technical: personas ─── */}
                {state.interviewType === 'technical' && step === 6 && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {personas.map(p => (
                      <PersonaCard
                        key={p.id} id={p.id} name={p.name} description={p.description}
                        selected={state.technicalPersona === p.id}
                        onClick={() => setState(s => ({ ...s, technicalPersona: p.id as InterviewerPersona }))}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ─── Navigation ─── */}
            <div className="mt-10 flex items-center gap-4">
              {step > 1 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="font-mono text-xs text-paper-faint hover:text-paper transition-colors"
                >
                  ← Back
                </button>
              )}
              <div className="flex-1" />

              {!isFinalStep ? (
                <button
                  onClick={() => canAdvance() && setStep(s => s + 1)}
                  disabled={!canAdvance() || isUploading}
                  className={cn(
                    'btn-primary',
                    (!canAdvance() || isUploading) && 'opacity-40 cursor-not-allowed'
                  )}
                  style={{ fontSize: 15 }}
                >
                  <span className="btn-dot" />
                  Continue
                  <span className="btn-arrow">→</span>
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={!canAdvance() || loading || isUploading}
                  className={cn(
                    'btn-primary',
                    (!canAdvance() || loading || isUploading) && 'opacity-40 cursor-not-allowed'
                  )}
                  style={{ fontSize: 15 }}
                >
                  <span className="btn-dot" />
                  {loading ? 'Creating session…' : 'Start interview'}
                  <span className="btn-arrow">→</span>
                </button>
              )}
            </div>
          </div>

          {/* ─── Summary rail ─── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-white/[0.07] bg-ink-900 shadow-card overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-white/[0.05]">
                <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">Your session</p>
              </div>
              <div className="px-6 py-2">
                {summaryRows.map(({ label, value }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className={cn('flex items-center justify-between py-[10px]', i < summaryRows.length - 1 && 'border-b border-dashed border-white/[0.06]')}
                  >
                    <span className="font-mono text-[12px] text-paper-faint">{label}</span>
                    <span className={cn('text-[13px] font-medium', value ? 'text-paper' : 'text-paper-faint/30')}>
                      {value ?? '—'}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* HEADS UP box */}
              {headsUp && (
                <div className="mx-4 mb-4 mt-1 rounded-xl bg-ink-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-[6px] h-[6px] rounded-full bg-ember shrink-0" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-paper">Heads up</span>
                  </div>
                  <p className="text-[12.5px] text-paper-dim leading-relaxed">{headsUp}</p>
                </div>
              )}

              {/* Empty state */}
              {summaryRows.every(r => !r.value) && !headsUp && (
                <div className="px-6 pb-5">
                  <p className="text-[12px] text-paper-faint leading-relaxed">
                    Your choices will appear here as you go.
                  </p>
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>
    </div>
  )
}
