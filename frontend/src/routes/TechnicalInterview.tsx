import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import Editor from "@monaco-editor/react";
import { Conversation } from "@11labs/client";
import type { Status } from "@11labs/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { apiFetch, wsUrl } from "@/lib/api";
import type {
  ApiSession,
  ApiQuestion,
  ApiCodeRunResult,
  ApiAgentUrl,
} from "@/lib/apiTypes";
import type { Language } from "@/lib/types";


const LANGUAGES: { id: Language; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "go", label: "Go" },
];

// ─── Whiteboard ───────────────────────────────────────────────────────────────

type Point = { x: number; y: number };
type DrawTool = "pen" | "rect" | "ellipse" | "line" | "eraser";
type DrawStroke =
  | { type: "pen"; points: Point[]; color: string; width: number; eraser?: boolean }
  | { type: "rect"; x: number; y: number; w: number; h: number; color: string; width: number }
  | { type: "ellipse"; x: number; y: number; w: number; h: number; color: string; width: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number };

const DRAW_COLORS = ["#e2e8f4", "#22c55e", "#f87171", "#60A5FA", "#FBBF24", "#C084FC", "#4ade80"];
const STROKE_SIZES = [1, 2, 4, 8];
const ERASER_SIZES = [12, 24, 48, 96];

function EraserIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4.5" width="12" height="6" rx="1.5" strokeWidth="1.4" />
      <line x1="4.5" y1="4.5" x2="4.5" y2="10.5" strokeWidth="1.4" />
      <line x1="1" y1="10.5" x2="13" y2="10.5" strokeWidth="1.4" />
    </svg>
  );
}

function renderStroke(ctx: CanvasRenderingContext2D, s: DrawStroke) {
  const isEraser = s.type === "pen" && s.eraser;
  ctx.globalCompositeOperation = isEraser ? "destination-out" : "source-over";
  ctx.strokeStyle = isEraser ? "rgba(0,0,0,1)" : s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.type === "pen") {
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
  } else if (s.type === "rect") {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  } else if (s.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.type === "line") {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function redrawCanvas(canvas: HTMLCanvasElement, strokes: DrawStroke[], preview?: DrawStroke) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = 0; x <= canvas.width; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  for (const s of strokes) renderStroke(ctx, s);
  if (preview) renderStroke(ctx, preview);
}

const TOOL_DEFS: { id: DrawTool; title: string }[] = [
  { id: "pen", title: "Pen" },
  { id: "rect", title: "Rectangle" },
  { id: "ellipse", title: "Ellipse" },
  { id: "line", title: "Line" },
  { id: "eraser", title: "Eraser" },
];

const TOOL_ICON: Record<DrawTool, React.ReactNode> = {
  pen: "✏",
  rect: "□",
  ellipse: "○",
  line: "╱",
  eraser: <EraserIcon />,
};

function Whiteboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [strokeSize, setStrokeSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(24);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);

  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const sizeRef = useRef(strokeSize);
  const eraserSizeRef = useRef(eraserSize);
  const strokesRef = useRef<DrawStroke[]>([]);
  const isDrawingRef = useRef(false);
  const startRef = useRef<Point>({ x: 0, y: 0 });
  const penPointsRef = useRef<Point[]>([]);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = strokeSize; }, [strokeSize]);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      redrawCanvas(canvas, strokesRef.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        setStrokes((prev) => {
          const next = prev.slice(0, -1);
          strokesRef.current = next;
          if (canvasRef.current) redrawCanvas(canvasRef.current, next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): Point {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawingRef.current = true;
    startRef.current = getPos(e);
    if (toolRef.current === "pen" || toolRef.current === "eraser") {
      penPointsRef.current = [startRef.current];
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getPos(e);
    setCursorPos(pos);
    if (!isDrawingRef.current) return;
    const t = toolRef.current;
    const c = colorRef.current;
    const w = sizeRef.current;
    const s0 = startRef.current;
    const canvas = canvasRef.current!;

    let preview: DrawStroke;
    if (t === "pen") {
      penPointsRef.current.push(pos);
      preview = { type: "pen", points: [...penPointsRef.current], color: c, width: w };
    } else if (t === "eraser") {
      penPointsRef.current.push(pos);
      preview = { type: "pen", points: [...penPointsRef.current], color: c, width: eraserSizeRef.current, eraser: true };
    } else if (t === "rect") {
      preview = { type: "rect", x: s0.x, y: s0.y, w: pos.x - s0.x, h: pos.y - s0.y, color: c, width: w };
    } else if (t === "ellipse") {
      preview = { type: "ellipse", x: s0.x, y: s0.y, w: pos.x - s0.x, h: pos.y - s0.y, color: c, width: w };
    } else {
      preview = { type: "line", x1: s0.x, y1: s0.y, x2: pos.x, y2: pos.y, color: c, width: w };
    }
    redrawCanvas(canvas, strokesRef.current, preview);
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pos = getPos(e);
    const t = toolRef.current;
    const c = colorRef.current;
    const w = sizeRef.current;
    const s0 = startRef.current;

    let stroke: DrawStroke;
    if (t === "pen") {
      stroke = { type: "pen", points: [...penPointsRef.current], color: c, width: w };
    } else if (t === "eraser") {
      stroke = { type: "pen", points: [...penPointsRef.current], color: c, width: eraserSizeRef.current, eraser: true };
    } else if (t === "rect") {
      stroke = { type: "rect", x: s0.x, y: s0.y, w: pos.x - s0.x, h: pos.y - s0.y, color: c, width: w };
    } else if (t === "ellipse") {
      stroke = { type: "ellipse", x: s0.x, y: s0.y, w: pos.x - s0.x, h: pos.y - s0.y, color: c, width: w };
    } else {
      stroke = { type: "line", x1: s0.x, y1: s0.y, x2: pos.x, y2: pos.y, color: c, width: w };
    }
    penPointsRef.current = [];
    const next = [...strokesRef.current, stroke];
    setStrokes(next);
    strokesRef.current = next;
    if (canvasRef.current) redrawCanvas(canvasRef.current, next);
  }

  const clear = () => {
    setStrokes([]);
    strokesRef.current = [];
    if (canvasRef.current) redrawCanvas(canvasRef.current, []);
  };

  const undo = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      strokesRef.current = next;
      if (canvasRef.current) redrawCanvas(canvasRef.current, next);
      return next;
    });
  };

  const isEraser = tool === "eraser";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-ink-700/60 bg-ink-900 px-3 py-2">
        {/* Tools */}
        <div className="flex items-center gap-0.5">
          {TOOL_DEFS.map(({ id, title }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              title={title}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-sm font-mono text-sm transition-all duration-150",
                tool === id
                  ? "bg-ember/15 text-ember border border-ember/30"
                  : "text-paper-faint hover:text-paper-dim border border-transparent",
              )}
            >
              {TOOL_ICON[id]}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-ink-700/60" />

        {/* Colors — dimmed when eraser active */}
        <div className={cn("flex items-center gap-1 transition-opacity duration-150", isEraser && "opacity-30 pointer-events-none")}>
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={cn(
                "h-3.5 w-3.5 rounded-full border-2 transition-all duration-150",
                color === c ? "border-paper scale-125" : "border-transparent hover:scale-110",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="h-4 w-px bg-ink-700/60" />

        {/* Size selector — switches between pen sizes and eraser sizes */}
        {isEraser ? (
          <div className="flex items-center gap-0.5">
            {ERASER_SIZES.map((sz) => {
              const w = Math.round(sz * 0.75);
              const h = Math.round(sz * 0.45);
              return (
                <button
                  key={sz}
                  onClick={() => setEraserSize(sz)}
                  title={`${sz}px eraser`}
                  className={cn(
                    "flex h-7 w-9 items-center justify-center rounded-sm border transition-all duration-150",
                    eraserSize === sz ? "border-ember/30 bg-ember/10" : "border-transparent hover:border-ink-600",
                  )}
                >
                  <div
                    className="rounded-sm border border-paper/25 bg-paper/10"
                    style={{ width: Math.min(w, 28), height: Math.min(h, 14) }}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {STROKE_SIZES.map((sz) => (
              <button
                key={sz}
                onClick={() => setStrokeSize(sz)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-sm border transition-all duration-150",
                  strokeSize === sz ? "border-ember/30 bg-ember/10" : "border-transparent hover:border-ink-600",
                )}
              >
                <div className="rounded-full bg-paper-dim" style={{ width: sz * 2 + 2, height: sz * 2 + 2 }} />
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="font-mono text-xs text-paper transition-colors bg-ink-700 hover:bg-ink-600 px-3 py-1 rounded-sm disabled:opacity-30"
          >
            ↩ Undo
          </button>
          <button
            onClick={clear}
            disabled={strokes.length === 0}
            className="font-mono text-xs text-crimson transition-colors bg-crimson/15 hover:bg-crimson/25 border border-crimson/30 px-3 py-1 rounded-sm disabled:opacity-30"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-[#191d28]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ cursor: isEraser ? "none" : "crosshair" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { setCursorPos(null); onMouseUp({ clientX: 0, clientY: 0 } as React.MouseEvent<HTMLCanvasElement>); }}
        />
        {/* Custom eraser cursor */}
        {isEraser && cursorPos && (
          <div
            className="pointer-events-none absolute rounded-sm border border-paper/30 bg-paper/5"
            style={{
              left: cursorPos.x - eraserSize / 2,
              top: cursorPos.y - eraserSize / 2,
              width: eraserSize,
              height: eraserSize,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          />
        )}
      </div>
    </div>
  );
}


function useCountdown(totalSecs: number) {
  const [seconds, setSeconds] = useState(totalSecs);
  useEffect(() => {
    if (totalSecs > 0) setTimeout(() => setSeconds(totalSecs), 0);
  }, [totalSecs]);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return { timeStr: `${mm}:${ss}`, seconds };
}




interface TestResultUI {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  passed?: boolean;
}


interface TranscriptLine {
  speaker: "ai" | "user";
  text: string;
}


export function TechnicalInterview() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();


  const [session, setSession] = useState<ApiSession | null>(null);
  const [question, setQuestion] = useState<ApiQuestion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);


  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState("");
  const [showTests, setShowTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResultUI[]>([]);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);


  const [whiteboardMode, setWhiteboardMode] = useState(false)
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor' | 'interviewer'>('editor');

  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);


  const convRef = useRef<Awaited<
    ReturnType<typeof Conversation.startSession>
  > | null>(null);
  const audioWsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const testResultsRef = useRef(testResults);
  const lastSnapshotCodeRef = useRef<string>('')
  const snapshotSeqRef = useRef(0)


  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    testResultsRef.current = testResults;
  }, [testResults]);

  useEffect(() => {
    if (!sessionId || !started) return

    const sendSnapshot = async () => {
      const currentCode = codeRef.current
      if (!currentCode.trim() || currentCode === lastSnapshotCodeRef.current) return
      lastSnapshotCodeRef.current = currentCode
      const seq = ++snapshotSeqRef.current
      try {
        const token = await getToken()
        if (!token) return
        await apiFetch(`/api/interviews/${sessionId}/code/snapshot`, token, {
          method: 'POST',
          body: JSON.stringify({ language: languageRef.current, code: currentCode, sequence: seq }),
        })
      } catch (err) {
        console.error('Snapshot failed (non-critical):', err)
      }
    }

    const intervalId = setInterval(sendSnapshot, 30_000)
    return () => clearInterval(intervalId)
  }, [sessionId, started, getToken])


  const totalSecs = (session?.duration_minutes ?? 45) * 60;
  const { timeStr, seconds: remainSecs } = useCountdown(totalSecs);


  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);


  // Load session + questions on mount
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const [sess, questions, urlResp] = await Promise.all([
          apiFetch<ApiSession>(`/api/interviews/${sessionId}`, token),
          apiFetch<ApiQuestion[]>(
            `/api/interviews/${sessionId}/questions`,
            token,
          ),
          apiFetch<ApiAgentUrl>(
            `/api/interviews/${sessionId}/agent-url`,
            token,
          ),
        ]);
        if (cancelled) return;
        setSession(sess);
        setAgentUrl(urlResp.signed_url);


        const techQ = questions.find((q) => q.type === "technical") ?? null;
        setQuestion(techQ);
        if (techQ?.problem?.starter_code?.["python"]) {
          setCode(techQ.problem.starter_code["python"]);
        }


        if (sess.status === "pending") {
          await apiFetch(`/api/interviews/${sessionId}`, token, {
            method: "PATCH",
            body: JSON.stringify({ status: "active" }),
          });
        }
      } catch (err) {
        if (!cancelled) setLoadError("Failed to load session.");
        console.error(err);
      }
    }
    load();
    return () => {
      cancelled = true;
      mediaRecorderRef.current?.stop()
      audioWsRef.current?.close()
      convRef.current?.endSession().catch(() => {});
    };
  }, [sessionId, getToken]);


  const handleStartInterview = async () => {
    if (!agentUrl || started) return;
    setStarted(true);
    setConnecting(true);
    try {
      const conversation = await Conversation.startSession({
        signedUrl: agentUrl,
        clientTools: {
          get_current_code: async () => {
            const c = codeRef.current;
            const lang = languageRef.current;
            if (!c || !c.trim()) return JSON.stringify({ status: "no_code", message: "The candidate has not written any code yet." });
            return JSON.stringify({ language: lang, code: c });
          },
          get_test_results: async () => {
            const results = testResultsRef.current;
            if (!results.length) return JSON.stringify({ status: "not_run", message: "The candidate has not run their code yet." });
            const passed = results.filter((r) => r.passed).length;
            return JSON.stringify({
              total: results.length,
              passed,
              failed: results.length - passed,
              results: results.map((r) => ({
                passed: r.passed,
                actual: r.actual ?? "",
              })),
            });
          },
        },
        onMessage: ({
          message,
          source,
        }: {
          message: string;
          source: "ai" | "user";
        }) => {
          setTranscript((t) => [...t, { speaker: source, text: message }]);
        },
        onModeChange: ({ mode }: { mode: "speaking" | "listening" }) => {
          setInterviewerSpeaking(mode === "speaking");
        },
        onStatusChange: ({ status }: { status: Status }) => {
          if (status === "connected") setConnecting(false);
        },
        onError: (message: string, context?: unknown) => {
          console.error("ElevenLabs error", message, context);
        },
      });


      convRef.current = conversation;
      const convId = conversation.getId();
      if (convId) {
        const t = await getToken();
        if (t) {
          await apiFetch(`/api/interviews/${sessionId}`, t, {
            method: "PATCH",
            body: JSON.stringify({ elevenlabs_conversation_id: convId }),
          });
        }
      }

      // Tap ElevenLabs AudioContext to record both user + AI audio
      type VoiceConversationWithAudio = typeof conversation & {
        output?: { context: AudioContext; gain: AudioNode }
        input?: { inputStream: MediaStream }
      }
      const voiceConv = conversation as VoiceConversationWithAudio
      if (voiceConv.output && voiceConv.input) {
        try {
          const token2 = await getToken()
          if (token2 && sessionId) {
            const wsProtocolUrl = wsUrl(`/ws/interviews/${sessionId}/audio?token=${token2}`)
            const audioWs = new WebSocket(wsProtocolUrl)
            audioWsRef.current = audioWs

            const ctx: AudioContext = voiceConv.output.context
            const recordingDest = ctx.createMediaStreamDestination()
            voiceConv.output.gain.connect(recordingDest)
            const micSrc = ctx.createMediaStreamSource(voiceConv.input.inputStream)
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
          }
        } catch (err) {
          console.error('Failed to set up audio recording:', err)
        }
      }
    } catch (err) {
      console.error("ElevenLabs start failed", err);
      setStarted(false);
      setConnecting(false);
    }
  };


  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    const starter = question?.problem?.starter_code?.[lang] ?? "";
    setCode(starter);
  };


  const handleRun = async () => {
    if (!sessionId || !question?.coding_problem_id || running) return;
    setRunning(true);
    setShowTests(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await apiFetch<ApiCodeRunResult>(
        `/api/interviews/${sessionId}/code/run`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ language, code, question_id: question.id }),
        },
      );
      setTestResults(
        result.test_results.map((tr) => ({
          id: tr.test_case_id,
          input: "",
          expected: "",
          actual: tr.stdout ?? tr.stderr ?? "",
          passed: tr.passed,
        })),
      );
    } catch (err) {
      console.error("Run failed", err);
    } finally {
      setRunning(false);
    }
  };


  const handleSubmit = async () => {
    if (!sessionId || !question?.coding_problem_id || submitting) return;
    setSubmitting(true);
    setShowTests(true);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await apiFetch<ApiCodeRunResult>(
        `/api/interviews/${sessionId}/code/submit`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ language, code, question_id: question.id }),
        },
      );
      setTestResults(
        result.test_results.map((tr) => ({
          id: tr.test_case_id,
          input: "",
          expected: "",
          actual: tr.stdout ?? tr.stderr ?? "",
          passed: tr.passed,
        })),
      );
      await endSession(token);
    } catch (err) {
      console.error("Submit failed", err);
    } finally {
      setSubmitting(false);
    }
  };


  const endSession = async (tokenArg?: string) => {
    if (!sessionId) return;
    try {
      mediaRecorderRef.current?.stop()
      audioWsRef.current?.close()
      await convRef.current?.endSession();
      const token = tokenArg ?? (await getToken());
      if (!token) return;
      await apiFetch(`/api/interviews/${sessionId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
    } catch (err) {
      console.error("PATCH completed failed", err);
      toast.error(
        "Session may not have saved. Feedback generation could be delayed.",
      );
    }
    navigate(`/feedback/${sessionId}`);
  };


  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-950">
        <p className="font-mono text-xs text-crimson">{loadError}</p>
      </div>
    );
  }


  const problem = question?.problem;
  const persona = session?.interviewer_tone ?? "neutral";
  const personaInitial = persona.charAt(0).toUpperCase();
  const personaColor: Record<string, string> = {
    friendly: '#22c55e', supportive: '#22c55e',
    neutral: '#5B5BD6', corporate: '#5B5BD6',
    intense: '#f87171', pressure: '#f87171',
    skeptical: '#f87171', probing: '#f87171',
  };
  const avatarColor = personaColor[persona] ?? '#5B5BD6';


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex h-screen flex-col bg-ink-950 overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-ink-700/60 bg-ink-900 px-4 py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 18 L12 4 L20 18 L15 18 L12 12 L9 18 Z" fill="#e2e8f4" />
            <circle cx="19.5" cy="4.5" r="2.2" fill="#22c55e" />
          </svg>
          <span className="font-display text-sm font-bold text-paper" style={{ letterSpacing: '-0.02em' }}>Intervue</span>
          <span className="text-paper-faint/40 hidden sm:inline">/</span>
          <span className="hidden sm:inline font-mono text-xs text-paper-faint">
            technical{session?.company ? ` · ${session.company.toLowerCase()}` : ""}
            {problem ? ` · ${problem.title.toLowerCase()}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-ember/8 border border-ember/25">
          <span className="live-dot" />
          <span className="font-mono text-[11px] text-ember tracking-widest">LIVE · {(session?.interviewer_tone ?? 'AI').toUpperCase()}</span>
        </div>
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-paper">
          <span className="text-paper-faint text-[11px]">elapsed</span>
          <span className="font-semibold">{timeStr}</span>
          <span className="text-paper-faint text-[11px]">/ {String(Math.floor(totalSecs / 60)).padStart(2,'0')}:00</span>
        </div>
        <div className="hidden sm:block w-24 h-1 bg-ink-700/40 rounded-full overflow-hidden mx-2">
          <div
            className="h-full bg-ember rounded-full transition-all"
            style={{ width: `${Math.max(0, ((totalSecs - remainSecs) / totalSecs) * 100)}%` }}
          />
        </div>
        <button
          onClick={() => endSession()}
          className="font-mono text-xs uppercase tracking-widest text-crimson border border-crimson/30 bg-crimson/5 px-3 py-1 rounded-sm hover:bg-crimson/10 hover:border-crimson/50 transition-all shrink-0"
        >
          End session
        </button>
      </div>


      {/* Three-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Pane 1: Problem */}
        <div className={cn(
          "flex-col overflow-y-auto border-r border-ink-700/60 bg-ink-900 p-5",
          mobileTab === 'problem' ? "flex flex-1" : "hidden",
          "lg:flex lg:flex-none lg:w-[320px]"
        )}>
          {!problem ? (
            <p className="font-mono text-xs text-paper-faint animate-pulse">
              Loading problem...
            </p>
          ) : (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                    problem.difficulty === "easy"
                      ? "bg-moss/15 text-moss"
                      : problem.difficulty === "medium"
                        ? "bg-ember/15 text-ember"
                        : "bg-crimson/15 text-crimson",
                  )}
                >
                  {problem.difficulty}
                </span>
              </div>
              <h2 className="mb-4 font-display text-xl font-semibold text-paper">
                {problem.title}
              </h2>
              <div className="prose-sm text-sm leading-relaxed text-paper-dim space-y-4">
                <p className="text-paper-dim whitespace-pre-line">
                  {problem.description}
                </p>
                <div className="space-y-3">
                  {problem.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-sm border border-ink-700/50 bg-ink-800 p-3"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint mb-2">
                        Example {i + 1}
                      </p>
                      <p className="font-mono text-xs text-paper-dim">
                        <span className="text-paper-faint">Input:</span>{" "}
                        {ex.input}
                      </p>
                      <p className="font-mono text-xs text-paper-dim">
                        <span className="text-paper-faint">Output:</span>{" "}
                        {ex.output}
                      </p>
                      {ex.explanation && (
                        <p className="mt-1 text-xs text-paper-faint">
                          {ex.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-paper-faint mb-2">
                    Constraints
                  </p>
                  <ul className="space-y-1">
                    {problem.constraints.map((c, i) => (
                      <li
                        key={i}
                        className="font-mono text-xs text-paper-dim flex gap-2"
                      >
                        <span className="text-paper-faint">·</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>


        {/* Pane 2: Editor / Whiteboard */}
        <div className={cn(
          "flex-col overflow-hidden",
          mobileTab === 'editor' ? "flex flex-1" : "hidden",
          "lg:flex lg:flex-1"
        )}>
          <div className="flex items-center gap-2 border-b border-ink-700/60 bg-ink-900 px-3 py-2">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              disabled={whiteboardMode}
              className="rounded-sm border border-ink-700/60 bg-ink-800 px-2.5 py-1.5 font-mono text-xs text-paper-dim focus:border-ember/50 focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed appearance-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setWhiteboardMode((w) => !w)}
              className={cn(
                "flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 font-mono text-xs transition-all duration-150",
                whiteboardMode
                  ? "border-ember/40 bg-ember/10 text-ember"
                  : "border-ink-700/60 text-paper-faint hover:text-paper-dim hover:border-ink-600",
              )}
            >
              ✎ Whiteboard
            </button>

            {!whiteboardMode && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleRun}
                  disabled={running}
                  className="flex items-center gap-1.5 rounded-sm border border-ink-700/60 bg-ink-800 px-3 py-1.5 font-mono text-xs text-paper-dim hover:border-paper-faint/30 hover:text-paper transition-all disabled:opacity-50"
                >
                  {running ? "..." : "▶ Run"}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-sm bg-ember px-3 py-1.5 font-mono text-xs text-ink-950 hover:bg-ember-soft transition-all disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit →"}
                </button>
              </div>
            )}
          </div>

          {whiteboardMode ? (
            <Whiteboard />
          ) : (
            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                language={language === "cpp" ? "cpp" : language}
                value={code}
                onChange={(val) => setCode(val ?? "")}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
                  fontLigatures: true,
                  lineHeight: 1.7,
                  padding: { top: 16, bottom: 16 },
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "all",
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  tabSize: 4,
                }}
              />
            </div>
          )}


          <AnimatePresence>
            {showTests && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden border-t border-ink-700/60 bg-ink-900"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono text-xs uppercase tracking-widest text-paper-faint">
                      Test Results
                    </p>
                    <button
                      onClick={() => setShowTests(false)}
                      className="font-mono text-xs text-paper-faint hover:text-paper-dim"
                    >
                      ✕
                    </button>
                  </div>
                  {testResults.length === 0 ? (
                    <p className="font-mono text-xs text-paper-faint animate-pulse">
                      Running...
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {testResults.map((tc) => (
                        <div
                          key={tc.id}
                          className={cn(
                            "flex items-center gap-3 rounded-sm border p-3",
                            tc.passed
                              ? "border-moss/30 bg-moss/8"
                              : "border-crimson/30 bg-crimson/8",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-xs",
                              tc.passed ? "text-moss" : "text-crimson",
                            )}
                          >
                            {tc.passed ? "✓ PASS" : "✗ FAIL"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs text-paper-faint">
                              Test case {tc.id}
                            </p>
                            {tc.actual && (
                              <p className="font-mono text-xs text-paper-dim truncate">
                                Output: {tc.actual}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        {/* Pane 3: Interviewer + Transcript */}
        <div className={cn(
          "flex-col border-l border-ink-700/60 bg-ink-900",
          mobileTab === 'interviewer' ? "flex flex-1" : "hidden",
          "lg:flex lg:w-[280px] lg:shrink-0 lg:flex-none"
        )}>
          <div className="border-b border-ink-700/60 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-semibold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}AA)` }}
              >
                {personaInitial}
                {interviewerSpeaking && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ember animate-pulse border-2 border-ink-900" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-paper">AI Interviewer</p>
                <p className="font-mono text-[10px] text-paper-faint capitalize">
                  {connecting
                    ? "Connecting..."
                    : !started
                      ? "Ready"
                      : interviewerSpeaking
                        ? "Speaking"
                        : persona}
                </p>
              </div>
              {interviewerSpeaking && (
                <div className="ml-auto flex items-center gap-1">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [1, 2.5, 1] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6,
                        delay: i * 0.15,
                      }}
                      className="h-3 w-0.5 rounded-full bg-ember origin-bottom"
                    />
                  ))}
                </div>
              )}
            </div>


            {!started ? (
              <button
                onClick={handleStartInterview}
                disabled={!agentUrl}
                className="w-full rounded-sm bg-ember px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-ink-950 hover:bg-ember-soft transition-all disabled:opacity-40"
              >
                {agentUrl ? "▶ Start Interview" : "Loading..."}
              </button>
            ) : (
              <button
                onClick={() => {
                  const newMuted = !muted;
                  setMuted(newMuted);
                  try {
                    convRef.current?.setMicMuted(newMuted);
                  } catch (error) {
                    console.error("Error muting mic", error);
                  }
                }}
                className={cn(
                  "w-full rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-widest transition-all duration-200",
                  muted
                    ? "border-crimson/40 bg-crimson/10 text-crimson"
                    : "border-ink-700/60 text-paper-faint hover:border-paper-faint/30 hover:text-paper-dim",
                )}
              >
                {muted ? "⊘ Muted" : "⊙ Mute"}
              </button>
            )}
          </div>


          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
          >
            {!started ? (
              <p className="font-mono text-[10px] text-paper-faint/50">
                Read the problem, then start the interview when ready.
              </p>
            ) : connecting ? (
              <p className="font-mono text-[10px] text-paper-faint/50 animate-pulse">
                Connecting to interviewer...
              </p>
            ) : transcript.length === 0 ? (
              <p className="font-mono text-[10px] text-paper-faint/50">
                Transcript will appear here...
              </p>
            ) : (
              transcript.map((seg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "rounded-xl border px-3 py-2",
                    seg.speaker === "ai"
                      ? "border-ink-700/50 bg-ink-800/40"
                      : "border-ember/20 bg-ember/5",
                  )}
                >
                  <span
                    className={cn(
                      "mb-1 block font-mono text-[9px] font-semibold uppercase tracking-widest",
                      seg.speaker === "ai" ? "text-paper-faint" : "text-ember",
                    )}
                  >
                    {seg.speaker === "ai" ? "INTERVIEWER" : "YOU"}
                  </span>
                  <p className="text-xs leading-relaxed text-paper-dim">
                    {seg.text}
                  </p>
                </motion.div>
              ))
            )}
          </div>


          <div className="flex items-center justify-between border-t border-ink-700/60 px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
              {remainSecs > 0 ? 'time left' : 'time up'}
            </span>
            <span className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              remainSecs < 300 ? "text-crimson" : remainSecs < 600 ? "text-ember" : "text-paper",
            )}>
              {timeStr}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="flex shrink-0 border-t border-ink-700/60 bg-ink-900 lg:hidden">
        {([
          { id: 'problem', label: 'Problem', icon: '◧' },
          { id: 'editor', label: 'Code', icon: '⌨' },
          { id: 'interviewer', label: 'Voice', icon: '⊙' },
        ] as const).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
              mobileTab === id ? "text-ember border-t border-ember" : "text-paper-faint border-t border-transparent hover:text-paper-dim",
            )}
          >
            <span className="text-sm">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
