import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { Toaster } from 'sonner'
import { NavBar } from '@/components/layout/NavBar'
import { Home } from '@/routes/Home'
import { Setup } from '@/routes/Setup'
import { TechnicalInterview } from '@/routes/TechnicalInterview'
import { BehavioralInterview } from '@/routes/BehavioralInterview'
import { ResumeInterview } from '@/routes/ResumeInterview'
import { Feedback } from '@/routes/Feedback'
import { History } from '@/routes/History'
import { Account } from '@/routes/Account'
import { SampleFeedback } from '@/routes/SampleFeedback'
import { Problems } from '@/routes/Problems'
import { NotFound } from '@/routes/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth()
  const { openSignIn } = useClerk()

  useEffect(() => {
    if (isLoaded && !isSignedIn) openSignIn()
  }, [isLoaded, isSignedIn, openSignIn])

  if (!isLoaded || !isSignedIn) return null
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
          <Route path="/problems" element={<ProtectedRoute><Problems /></ProtectedRoute>} />
          <Route path="/interview/:id/technical" element={<ProtectedRoute><TechnicalInterview /></ProtectedRoute>} />
          <Route path="/interview/:id/behavioral" element={<ProtectedRoute><BehavioralInterview /></ProtectedRoute>} />
          <Route path="/interview/:id/resume" element={<ProtectedRoute><ResumeInterview /></ProtectedRoute>} />
          <Route path="/feedback/:id" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/sample-feedback" element={<SampleFeedback />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#13151c',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f4',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          },
        }}
      />
    </BrowserRouter>
  )
}
