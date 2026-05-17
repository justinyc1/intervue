import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BrowserScrollReveal } from '../components/BrowserScrollReveal'

// ── Design tokens ────────────────────────────────────────
const GREEN = '#22c55e'

// ── Framer Motion variants ───────────────────────────────
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
}

// ── Animated typing code editor ─────────────────────────
type TokenColor = 'kw' | 'fn' | 'pa' | 'op' | 'cm' | 'sp'
type Token = [TokenColor, string]
type Line = Token[]

const COLORS: Record<TokenColor, string> = {
  kw: '#c792ea',  // purple
  fn: '#82aaff',  // blue
  pa: '#e2e8f4',  // light text
  op: '#4a5568',  // dimmed
  cm: '#22c55e',  // green (comments = primary accent)
  sp: '#e2e8f4',
}

const CODE_LINES: Line[] = [
  [['kw','def '],['fn','twoSum'],['op','('],['pa','nums'],['op',', '],['pa','target'],['op','):']],
  [['sp','    '],['cm','# one pass, hash by complement']],
  [['sp','    '],['pa','seen'],['op',' = {}']],
  [['sp','    '],['kw','for '],['pa','i'],['op',', '],['pa','n'],['kw',' in '],['fn','enumerate'],['op','('],['pa','nums'],['op','):']],
  [['sp','        '],['kw','if '],['op','('],['pa','target'],['op',' - '],['pa','n'],['op',') '],['kw','in '],['pa','seen'],['op',':']],
  [['sp','            '],['kw','return '],['op','['],['pa','seen'],['op','['],['pa','target'],['op',' - '],['pa','n'],['op','], '],['pa','i'],['op',']']],
  [['sp','        '],['pa','seen'],['op','['],['pa','n'],['op','] = '],['pa','i']],
]

function TypingCode({ active }: { active: boolean }) {
  const flat = CODE_LINES.map(toks => toks.map(t => t[1]).join(''))
  const total = flat.reduce((a, b) => a + b.length, 0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick(t => (t >= total + 40 ? 0 : t + 1)), 28)
    return () => {
      clearInterval(id)
      setTick(0)
    }
  }, [active, total])

  const lineOffsets = CODE_LINES.reduce<{ offs: number[]; cur: number }>(
    ({ offs, cur }, toks) => {
      const len = toks.map(t => t[1]).join('').length + 1
      return { offs: [...offs, cur], cur: cur + len }
    },
    { offs: [], cur: 0 }
  ).offs

  return (
    <div style={{
      background: '#13151c',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: '14px 16px 18px',
      fontFamily: 'var(--font-mono)',
      fontSize: 12.5,
      lineHeight: 1.75,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -8px rgba(0,0,0,0.7)',
    }}>
      {/* Chrome bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingBottom:10, borderBottom:'1px dashed rgba(255,255,255,0.06)' }}>
        <span style={{ width:9, height:9, borderRadius:99, background:'#FF5F57' }} />
        <span style={{ width:9, height:9, borderRadius:99, background:'#FEBC2E' }} />
        <span style={{ width:9, height:9, borderRadius:99, background:'#28C840' }} />
        <span style={{ marginLeft:8, fontFamily:'var(--font-mono)', fontSize:11, color:'#4a5568' }}>solution.py</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:10, color:'#4a5568' }}>● running</span>
      </div>
      {CODE_LINES.map((toks, li) => {
        const lineText = toks.map(t => t[1]).join('')
        const start = lineOffsets[li]
        const localTick = Math.max(0, Math.min(lineText.length, tick - start))
        let printed = 0
        return (
          <div key={li} style={{ display:'flex', gap:14, minHeight:'1.75em' }}>
            <span style={{ color:'#4a5568', width:14, textAlign:'right' }}>{li + 1}</span>
            <span style={{ whiteSpace:'pre' }}>
              {toks.map(([color, seg], ti) => {
                const remaining = Math.max(0, localTick - printed)
                const visible = seg.slice(0, Math.min(seg.length, remaining))
                printed += seg.length
                return <span key={ti} style={{ color: COLORS[color] }}>{visible}</span>
              })}
              {tick >= start && tick < start + lineText.length + 1 && (
                <span style={{ display:'inline-block', width:7, height:14, background: GREEN, verticalAlign:'-2px', marginLeft:1, animation:'blink 1s steps(2) infinite' }} />
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Animated transcript ──────────────────────────────────
const TRANSCRIPT_LINES = [
  { who: 'int' as const, t: 'Walk me through your approach before you write anything.' },
  { who: 'you' as const, t: 'I\'m planning on using a hash map to store complements as I iterate — O(n) time, O(n) space.' },
  { who: 'int' as const, t: 'What if the array has duplicates?' },
  { who: 'you' as const, t: "I don't think it would matter, the first match wins. The map only needs the earlier index." },
  { who: 'int' as const, t: 'Nice. Code it up.' },
]

function Transcript({ active }: { active: boolean }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!active) return
    let i = 0
    const id = setInterval(() => {
      setShown(i)
      i = i >= TRANSCRIPT_LINES.length + 3 ? 0 : i + 1
    }, 1100)
    return () => clearInterval(id)
  }, [active])

  return (
    <div style={{
      background: '#13151c',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: 16,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -8px rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 220,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
        <span className="live-dot" />
        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#e2e8f4', letterSpacing:'.06em' }}>LIVE TRANSCRIPT</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:11, color:'#4a5568' }}>00:04:21</span>
      </div>
      {TRANSCRIPT_LINES.slice(0, shown).map((l, i) => (
        <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start', animation:'msg-in .36s cubic-bezier(.2,.8,.2,1) both' }}>
          <span style={{
            fontFamily:'var(--font-mono)', fontSize:10, fontWeight:600,
            padding:'3px 7px', borderRadius:6, marginTop:2,
            background:    l.who === 'int' ? 'rgba(255,255,255,0.08)'       : 'rgba(34,197,94,0.10)',
            color:         l.who === 'int' ? '#8892a4'                      : '#22c55e',
            border: `1px solid ${l.who === 'int' ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.20)'}`,
            minWidth: 36, textAlign:'center',
          }}>
            {l.who === 'int' ? 'AI' : 'YOU'}
          </span>
          <p style={{ fontSize:13.5, lineHeight:1.55, color:'#e2e8f4' }}>{l.t}</p>
        </div>
      ))}
      <style>{`@keyframes msg-in { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:none;} }`}</style>
    </div>
  )
}

// ── Animated score dial ──────────────────────────────────
function Dial({ value, label, color, delay = 0 }: { value: number; label: string; color: string; delay?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  const r = 38, c = 2 * Math.PI * r
  const off = c * (1 - v / 100)

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      <div style={{ position:'relative', width:96, height:96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
          <circle
            cx="48" cy="48" r={r} stroke={color} strokeWidth="6" fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            style={{ transition:'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)', transform:'rotate(-90deg)', transformOrigin:'48px 48px' }}
          />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
          <span style={{ fontSize:28, fontWeight:600, letterSpacing:'-0.02em', fontFamily:'var(--font-display)', color:'#e2e8f4' }}>
            {Math.round(v)}
          </span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'#4a5568' }}>/100</span>
        </div>
      </div>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'.06em', color:'#8892a4', textTransform:'uppercase' }}>
        {label}
      </span>
    </div>
  )
}

// ── Feature index row ────────────────────────────────────
const FEATURES = [
  {
    k: 'A',
    title: 'Adaptive interruptions',
    body: 'Goes silent? It nudges. Rambling? It cuts in. Hand-wavy? It pushes back with the exact follow-up a senior would ask.',
  },
  {
    k: 'B',
    title: 'Real coding environment',
    body: 'Monaco editor, multi-language, real test runner. The interviewer reads tokens as you type and reacts in voice.',
  },
  {
    k: 'C',
    title: 'Company-tailored loops',
    body: 'Scrapes pattern signals, not exact questions. Meta-flavored vs Stripe-flavored vs early-stage flavored.',
  },
  {
    k: 'D',
    title: 'Evidence-tied feedback',
    body: 'Every score links back to the exact transcript moment. No hallucinated coaching.',
  },
]

function FeatureRow({ k, title, body }: { k: string; title: string; body: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr 1.6fr 24px',
        alignItems: 'center',
        gap: 24,
        padding: hovered ? '28px 14px' : '28px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: hovered ? 'rgba(34,197,94,0.04)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.2s, padding 0.2s',
      }}
    >
      <span style={{ fontSize:42, fontWeight:600, color: GREEN, letterSpacing:'-0.02em', fontFamily:'var(--font-display)' }}>{k}</span>
      <h3 style={{ fontSize:26, fontWeight:600, letterSpacing:'-0.02em', fontFamily:'var(--font-display)', color:'#e2e8f4' }}>{title}</h3>
      <p style={{ color:'#8892a4', fontSize:15, lineHeight:1.55 }}>{body}</p>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:18, color:'#e2e8f4' }}>↗</span>
    </div>
  )
}

// ── Companies marquee ────────────────────────────────────
const COMPANIES = ['Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Stripe', 'Netflix', 'Airbnb', 'OpenAI', 'Anthropic', 'Databricks', 'Figma']

// ── Social proof avatars ─────────────────────────────────
const AVATAR_COLORS = ['rgba(34,197,94,0.3)', 'rgba(130,170,255,0.3)', 'rgba(248,113,113,0.3)', 'rgba(251,191,36,0.3)']

// ── Main component ───────────────────────────────────────
export function Home() {
  const navigate = useNavigate()
  const [active] = useState(true)
  const scoreRef = useRef<HTMLDivElement>(null)
  const [scoresVisible, setScoresVisible] = useState(false)

  useEffect(() => {
    const el = scoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setScoresVisible(true) },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ background:'#0c0e14', minHeight:'100vh' }}>

      {/* ── Radial hero background gradient ── */}
      <div aria-hidden style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 60% 0%, rgba(34,197,94,0.06) 0%, transparent 60%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Background blob ── */}
      <div
        aria-hidden
        style={{
          position:'fixed', top:-180, right:-120, width:560, height:560,
          background:'radial-gradient(closest-side, rgba(34,197,94,0.08), transparent 70%)',
          pointerEvents:'none', zIndex:0,
        }}
      />

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section style={{ position:'relative', zIndex:1, padding:'56px 36px 40px' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            style={{ display:'grid', gridTemplateColumns:'1.1fr 1fr', gap:48, alignItems:'center' }}
            className="grid-cols-1 lg:grid-cols-[1.1fr_1fr]"
          >
            {/* Left: copy */}
            <div className="flex flex-col">
              <motion.div variants={fadeUp} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24, fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.14em', textTransform:'uppercase', color:'#8892a4' }}>
                <span style={{ width:18, height:1, background:'#e2e8f4' }} />
                The mock interview platform
              </motion.div>

              <motion.h1
                variants={fadeUp}
                style={{ fontFamily:'var(--font-display)', fontSize:'clamp(2.6rem,5.5vw,5.4rem)', fontWeight:600, lineHeight:0.96, letterSpacing:'-0.035em', color:'#e2e8f4' }}
              >
                Solve it.
                <br />
                <span style={{ position:'relative', display:'inline-block' }}>
                  Explain it.
                  <svg
                    viewBox="0 0 280 14"
                    preserveAspectRatio="none"
                    style={{ position:'absolute', left:0, right:0, bottom:-6, width:'100%', height:14, pointerEvents:'none' }}
                  >
                    <path
                      d="M2 8 C 60 1, 140 13, 278 5"
                      stroke={GREEN} strokeWidth="3" fill="none" strokeLinecap="round"
                      style={{ strokeDasharray:600, strokeDashoffset:600, animation:'underline-draw 1.2s 0.4s ease-out forwards' }}
                    />
                  </svg>
                </span>
                <br />
                <span style={{ color:'#4a5568', fontStyle:'italic' }}>Get the offer.</span>
              </motion.h1>

              <motion.p variants={fadeUp} style={{ marginTop:26, maxWidth:480, fontSize:17, lineHeight:1.55, color:'#8892a4' }}>
                A live AI interviewer that <em>actually interrupts you</em>, pushes back on hand-wavy answers, and grades you on how you sound — not just whether the tests pass.
              </motion.p>

              <motion.div variants={fadeUp} style={{ display:'flex', alignItems:'center', gap:14, marginTop:30 }}>
                <button
                  onClick={() => navigate('/setup')}
                  className="btn-primary"
                >
                  <span className="btn-dot" />
                  Run a mock interview
                  <span className="btn-arrow">→</span>
                </button>
                <button
                  onClick={() => navigate('/sample-feedback')}
                  className="btn-ghost-pill"
                >
                  ▶︎ See sample feedback
                </button>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={fadeUp} style={{ display:'flex', alignItems:'center', gap:24, marginTop:40, color:'#8892a4', fontSize:13 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ display:'inline-flex' }}>
                    {AVATAR_COLORS.map((bg, i) => (
                      <span key={i} style={{ width:24, height:24, borderRadius:99, background:bg, border:'2px solid #0c0e14', marginLeft:i?-8:0, display:'inline-block' }} />
                    ))}
                  </span>
                  <span><strong style={{ color:'#e2e8f4' }}>11,400+</strong> mocks run this week</span>
                </div>
                <div style={{ width:1, height:14, background:'rgba(255,255,255,0.1)' }} />
                <div>★★★★★ <strong style={{ color:'#e2e8f4' }}>4.9</strong> · ProductHunt #1</div>
              </motion.div>
            </div>

            {/* Right: animated artifacts */}
            <motion.div variants={fadeUp} style={{ position:'relative', height:460 }} className="hidden lg:block">
              <div style={{ position:'absolute', top:0, right:0, width:460, transform:'rotate(-1.5deg)' }}>
                <TypingCode active={active} />
              </div>
              <div style={{ position:'absolute', bottom:0, left:0, width:420, transform:'rotate(1.2deg)' }}>
                <Transcript active={active} />
              </div>
              <div style={{ position:'absolute', top:18, left:14, fontFamily:'var(--font-mono)', fontSize:11, color:'#4a5568', transform:'rotate(-4deg)' }}>
                ↘ live, every keystroke
              </div>
              <div style={{
                position:'absolute', bottom:250, right:30,
                fontFamily:'var(--font-mono)', fontSize:11, color:'#22c55e',
                transform:'rotate(4deg)',
                padding:'4px 10px', background:'rgba(34,197,94,0.10)', borderRadius:99,
                border:'1px solid rgba(34,197,94,0.25)',
              }}>
                ↑ AI interrupts here
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MARQUEE
      ════════════════════════════════════════ */}
      <section style={{ padding:'40px 0 32px', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'relative', zIndex:1, overflow:'hidden' }}>
        <p className="mono-eyebrow" style={{ textAlign:'center', marginBottom:18 }}>practice for the loop at</p>
        <div style={{ overflow:'hidden', maskImage:'linear-gradient(to right, transparent, #0c0e14 8%, #0c0e14 92%, transparent)', WebkitMaskImage:'linear-gradient(to right, transparent, #0c0e14 8%, #0c0e14 92%, transparent)' }}>
          <div style={{ display:'flex', gap:64, width:'max-content', animation:'marquee 30s linear infinite', paddingLeft:36 }}>
            {[...COMPANIES, ...COMPANIES].map((co, i) => (
              <span key={i} style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:24, color:'#4a5568', letterSpacing:'-0.02em', whiteSpace:'nowrap' }}>
                {co}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          SECTION 02 — SCORE BREAKDOWN
      ════════════════════════════════════════ */}
      <section style={{ padding:'96px 36px 24px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          {/* Section eyebrow */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mono-eyebrow"
            style={{ display:'flex', alignItems:'center', gap:14, marginBottom:36 }}
          >
            <span style={{ fontWeight:600, color:'#e2e8f4' }}>№ 02</span>
            <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }} />
            <span>scored on what actually matters</span>
          </motion.div>

          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:64, alignItems:'center' }}>
            <h2 style={{ fontSize:'clamp(2rem,4vw,4rem)', fontWeight:600, letterSpacing:'-0.035em', lineHeight:0.98, fontFamily:'var(--font-display)', color:'#e2e8f4' }}>
              We don't grade you<br />on tests passed.<br />
              <span style={{ color:'#4a5568' }}>We grade you on </span><br />
              how you{' '}
              <em style={{ color: GREEN, fontStyle:'italic' }}>sound</em>.
            </h2>

            <div
              ref={scoreRef}
              style={{
                display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:32, padding:32,
                background:'#13151c', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:20, boxShadow:'0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -8px rgba(0,0,0,0.7)',
              }}
            >
              {scoresVisible && <>
                <Dial value={84} label="Clarity"     color={GREEN}     delay={0}   />
                <Dial value={71} label="Confidence"  color="#5B5BD6"   delay={200} />
                <Dial value={92} label="Structure"   color="#15A874"   delay={400} />
                <Dial value={66} label="Conciseness" color="#E8A317"   delay={600} />
              </>}
              {!scoresVisible && (
                <div style={{ gridColumn:'1/-1', height:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span className="mono-eyebrow">scroll to reveal</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          BROWSER SCROLL REVEAL (kept component)
      ════════════════════════════════════════ */}
      <BrowserScrollReveal />

      {/* ════════════════════════════════════════
          SECTION 03 — FEATURE INDEX
      ════════════════════════════════════════ */}
      <section style={{ padding:'96px 36px 24px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mono-eyebrow"
            style={{ display:'flex', alignItems:'center', gap:14, marginBottom:36 }}
          >
            <span style={{ fontWeight:600, color:'#e2e8f4' }}>№ 03</span>
            <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }} />
            <span>built for the way real loops feel</span>
          </motion.div>

          <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)' }}>
            {FEATURES.map(f => <FeatureRow key={f.k} {...f} />)}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          BOTTOM CTA STRIP
      ════════════════════════════════════════ */}
      <section style={{ padding:'56px 36px 80px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <motion.div
            initial={{ opacity:0, y:24 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }}
            transition={{ duration:0.55 }}
            style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'36px 40px', borderRadius:24,
              background:'linear-gradient(135deg, #13151c 0%, #191d28 100%)',
              border:'1px solid rgba(34,197,94,0.2)',
              boxShadow:'0 0 60px -20px rgba(34,197,94,0.15)',
              position:'relative', overflow:'hidden',
              flexWrap:'wrap', gap:24,
            }}
          >
            <div style={{ position:'relative' }}>
              <h3 style={{ fontSize:'clamp(1.5rem,3vw,2.25rem)', fontWeight:600, letterSpacing:'-0.025em', fontFamily:'var(--font-display)', color:'#e2e8f4' }}>
                Your next interview is{' '}
                <span style={{ color: GREEN }}>waiting</span>.
              </h3>
              <p style={{ color:'#8892a4', marginTop:6, fontSize:15 }}>
                Set up a mock session in under 60 seconds. Start with one.
              </p>
            </div>

            <div style={{ position:'relative', display:'flex', gap:12 }}>
              <button
                onClick={() => navigate('/setup')}
                className="btn-primary"
              >
                <span className="btn-dot" />
                Start practicing
                <span className="btn-arrow">→</span>
              </button>
              <button
                onClick={() => navigate('/sample-feedback')}
                className="btn-ghost-pill"
                style={{ color:'#e2e8f4', borderColor:'rgba(255,255,255,0.20)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)'; e.currentTarget.style.background = 'transparent' }}
              >
                View feedback sample
              </button>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  )
}
