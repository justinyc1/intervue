import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Conversation } from '@11labs/client'
import type { Status } from '@11labs/client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { apiFetch, wsUrl } from '@/lib/api'
import type { ApiSession, ApiAgentUrl } from '@/lib/apiTypes'

function useCountdown(totalSecs: number) {
  const [seconds, setSeconds] = useState(totalSecs)
  useEffect(() => {
    if (totalSecs > 0) {
      const id = setTimeout(() => setSeconds(totalSecs), 0)
      return () => clearTimeout(id)
    }
  }, [totalSecs])
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function Waveform({ speaking }: { speaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)
  const tRef = useRef(0)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height, BARS = 48
    const BAR_W = (W - (BARS - 1) * 2) / BARS
    const draw = () => {
      tRef.current += speaking ? 0.07 : 0.015
      const t = tRef.current
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < BARS; i++) {
        const norm = i / BARS
        const baseAmp = speaking
          ? 0.15 + 0.7 * Math.abs(Math.sin(norm * 8 + t * 2.5) * Math.sin(t * 1.3 + norm * 4))
          : 0.04 + 0.08 * Math.abs(Math.sin(norm * 3 + t))
        const h = Math.max(2, baseAmp * H)
        const x = i * (BAR_W + 2), y = (H - h) / 2
        const alpha = speaking ? 0.7 + 0.3 * (h / H) : 0.25
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`
        ctx.beginPath()
        ctx.roundRect(x, y, BAR_W, h, 2)
        ctx.fill()
      }
      frameRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [speaking])
  return <canvas ref={canvasRef} width={480} height={80} className="w-full max-w-lg" />
}

interface TranscriptLine { speaker: 'ai' | 'user'; text: string }

export function BehavioralInterview() {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [session, setSession] = useState<ApiSession | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(true)

  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false)
  const [userSpeaking, setUserSpeaking] = useState(false)
  const [muted, setMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [ending, setEnding] = useState(false)

  const convRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null)
  const audioWsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const totalSecs = (session?.duration_minutes ?? 45) * 60
  const timeStr = useCountdown(totalSecs)

  // Load session + start ElevenLabs conversation
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    async function start() {
      try {
        const token = await getToken()
        if (!token) return

        const [sess, agentUrl] = await Promise.all([
          apiFetch<ApiSession>(`/api/interviews/${sessionId}`, token),
          apiFetch<ApiAgentUrl>(`/api/interviews/${sessionId}/agent-url`, token),
        ])
        if (cancelled) return
        setSession(sess)

        // Mark session active
        if (sess.status === 'pending') {
          await apiFetch(`/api/interviews/${sessionId}`, token, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'active' }),
          })
        }

        const wsProtocolUrl = wsUrl(`/ws/interviews/${sessionId}/audio?token=${token}`)
        const audioWs = new WebSocket(wsProtocolUrl)
        audioWsRef.current = audioWs

        const conversation = await Conversation.startSession({
          signedUrl: agentUrl.signed_url,
          onMessage: ({ message, source }: { message: string; source: 'ai' | 'user' }) => {
            setTranscript((t) => [...t, { speaker: source, text: message }])
          },
          onModeChange: ({ mode }: { mode: 'speaking' | 'listening' }) => {
            setInterviewerSpeaking(mode === 'speaking')
            setUserSpeaking(mode === 'listening')
          },
          onStatusChange: ({ status }: { status: Status }) => {
            if (status === 'connected') setConnecting(false)
          },
          onError: (message: string, context?: unknown) => {
            console.error('ElevenLabs error', message, context)
          },
        })

        if (cancelled) {
          await conversation.endSession()
          return
        }

        convRef.current = conversation

        // tap into ElevenLabs' internal AudioContext to record both user + AI audio
        type VoiceConversationWithAudio = typeof conversation & {
          output?: {
            context: AudioContext
            gain: AudioNode
          }
          input?: {
            inputStream: MediaStream
          }
        }
        const voiceConv = conversation as VoiceConversationWithAudio
        if (voiceConv.output && voiceConv.input) {
          try {
            const ctx: AudioContext = voiceConv.output.context
            const recordingDest = ctx.createMediaStreamDestination()
            // Connect AI audio (gain → speakers already set up; this adds a second output)
            voiceConv.output.gain.connect(recordingDest)
            // Import user mic into the same AudioContext so we can mix it
            const micSrc = ctx.createMediaStreamSource(voiceConv.input.inputStream as MediaStream)
            micSrc.connect(recordingDest)
            const doRecord = () => {
              const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm'
              const mr = new MediaRecorder(recordingDest.stream, { mimeType })
              mediaRecorderRef.current = mr
              mr.ondataavailable = (e) => {
                if (e.data.size > 0 && audioWs.readyState === WebSocket.OPEN) {
                  audioWs.send(e.data)
                }
              }
              mr.start(1000)
            }
            if (audioWs.readyState === WebSocket.OPEN) doRecord()
            else audioWs.onopen = doRecord
          } catch (err) {
            console.error('Failed to set up mixed recording:', err)
          }
        }

        const convId = conversation.getId()

        if (convId) {
          const t = await getToken()
          if (t) {
            await apiFetch(`/api/interviews/${sessionId}`, t, {
              method: 'PATCH',
              body: JSON.stringify({ elevenlabs_conversation_id: convId }),
            })
          }
        }

        setConnecting(false)
      } catch (err) {
        if (!cancelled) {
          setLoadError('Failed to start interview session.')
          setConnecting(false)
        }
        console.error(err)
      }
    }

    start()
    return () => {
      cancelled = true
      mediaRecorderRef.current?.stop()
      audioWsRef.current?.close()
      convRef.current?.endSession().catch(() => {})
    }
  }, [sessionId, getToken])

  const handleEnd = async () => {
    if (ending) return
    setEnding(true)
    try {
      mediaRecorderRef.current?.stop()
      audioWsRef.current?.close()
      await convRef.current?.endSession()
      const token = await getToken()
      if (token) {
        await apiFetch(`/api/interviews/${sessionId}`, token, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed' }),
        })
      }
    } catch (err) {
      console.error('End session failed', err)
    }
    navigate(`/feedback/${sessionId}`)
  }

  const speakingLabel = interviewerSpeaking ? 'Interviewer is speaking' : userSpeaking ? "You're speaking" : 'Listening...'
  const speakingColor = interviewerSpeaking ? 'text-paper-dim' : userSpeaking ? 'text-ember' : 'text-paper-faint'

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <p className="font-mono text-xs text-crimson">{loadError}</p>
      </div>
    )
  }

  const persona = session?.behavioral_persona ?? 'supportive'
  const personaInitial = persona.charAt(0).toUpperCase()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex h-screen flex-col bg-ink-950 overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-ink-700/60 bg-ink-900 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-ember">◆</span>
          <span className="font-display text-sm font-semibold text-paper">Intervue</span>
          <span className="font-mono text-xs text-paper-faint ml-2">
            Behavioral{session?.company ? ` · ${session.company}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-paper-faint">{timeStr}</span>
          <button
            onClick={handleEnd}
            disabled={ending}
            className="font-mono text-xs uppercase tracking-widest text-paper-faint hover:text-crimson transition-colors border border-ink-700/60 px-3 py-1 rounded-sm hover:border-crimson/40 disabled:opacity-50"
          >
            {ending ? 'Ending...' : 'End session'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main centered content */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          {connecting ? (
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-paper-faint animate-pulse">Connecting to interviewer...</p>
            </div>
          ) : (
            <>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6 font-mono text-xs uppercase tracking-widest text-paper-faint"
              >
                Interview in progress
              </motion.p>

              <div className="mb-6 flex flex-col items-center gap-4">
                <Waveform speaking={userSpeaking || interviewerSpeaking} />
                <div className="flex items-center gap-2">
                  {(userSpeaking || interviewerSpeaking) && (
                    <div className={cn('h-2 w-2 animate-pulse rounded-full', userSpeaking ? 'bg-ember' : 'bg-paper-dim')} />
                  )}
                  <span className={cn('font-mono text-xs', speakingColor)}>{speakingLabel}</span>
                </div>
              </div>

              {/* Interviewer persona card */}
              <div className="mb-8 flex items-center gap-3 rounded-md border border-ink-700/60 bg-ink-900 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 font-display text-sm font-semibold text-paper border border-ink-700/80">
                  {personaInitial}
                </div>
                <div>
                  <p className="text-sm font-medium text-paper">AI Interviewer</p>
                  <p className="font-mono text-[10px] text-paper-faint capitalize">{persona}</p>
                </div>
                {interviewerSpeaking && (
                  <div className="ml-3 flex items-center gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ scaleY: [1, 2.5, 1] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                        className="h-3 w-0.5 rounded-full bg-ember origin-bottom"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const newMuted = !muted
                    setMuted(newMuted)
                    try { convRef.current?.setMicMuted(newMuted) } catch (e) { console.error('Error setting mic muted', e) }
                  }}
                  className={cn(
                    'rounded-sm border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all duration-200',
                    muted
                      ? 'border-crimson/40 bg-crimson/10 text-crimson'
                      : 'border-ink-700/60 text-paper-faint hover:border-paper-faint/30 hover:text-paper-dim'
                  )}
                >
                  {muted ? '⊘ Muted' : '⊙ Mute'}
                </button>
                <button
                  onClick={handleEnd}
                  disabled={ending}
                  className="rounded-sm border border-crimson/30 px-4 py-2 font-mono text-xs uppercase tracking-widest text-crimson/70 hover:text-crimson hover:border-crimson/60 transition-all duration-200 disabled:opacity-50"
                >
                  End interview
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: transcript drawer */}
        <div className="flex w-[280px] shrink-0 flex-col border-l border-ink-700/60 bg-ink-900">
          <div className="flex items-center gap-2 border-b border-ink-700/60 p-3">
            <span className="font-mono text-xs uppercase tracking-widest text-paper">Transcript</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {transcript.map((seg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-2"
                >
                  <span className={cn(
                    'mt-0.5 shrink-0 font-mono text-[9px] font-medium uppercase',
                    seg.speaker === 'ai' ? 'text-paper-faint' : 'text-ember'
                  )}>
                    {seg.speaker === 'ai' ? 'INT' : 'YOU'}
                  </span>
                  <p className="text-xs leading-relaxed text-paper-dim">{seg.text}</p>
                </motion.div>
              ))}
              {transcript.length === 0 && (
                <p className="font-mono text-xs text-paper-faint/40">
                  {connecting ? 'Connecting...' : 'Transcript will appear here...'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
