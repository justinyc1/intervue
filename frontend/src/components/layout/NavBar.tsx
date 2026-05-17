import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 18 L12 4 L20 18 L15 18 L12 12 L9 18 Z" fill="#e2e8f4" />
      <circle cx="19.5" cy="4.5" r="2.2" fill="#22c55e" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" />
    </svg>
  )
}

const NAV_LINKS = [
  { to: '/history',  label: 'Sessions' },
  { to: '/problems', label: 'Problems' },
  { to: '/setup',    label: 'Practice'  },
]

export function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const isInterviewRoom = location.pathname.includes('/interview/')

  if (isInterviewRoom) return null

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-[16px]">

        {/* Wordmark */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <Logo />
          <span
            className="text-[17px] font-bold tracking-[-0.02em] text-paper transition-opacity duration-200 group-hover:opacity-70"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Intervue
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'relative text-sm transition-colors duration-200',
                location.pathname === to
                  ? 'font-semibold text-paper'
                  : 'text-paper-faint hover:text-paper-dim'
              )}
            >
              {label}
              {location.pathname === to && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute -bottom-[18px] left-0 right-0 h-[1px] bg-ember"
                />
              )}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-ghost-pill text-sm font-medium">
                Sign in
              </button>
            </SignInButton>
            <button
              onClick={() => navigate('/setup')}
              className="btn-primary text-sm"
            >
              <span className="btn-dot" />
              Start a mock
              <span className="btn-arrow">→</span>
            </button>
          </SignedOut>

          <SignedIn>
            <button
              onClick={() => navigate('/setup')}
              className="btn-primary text-sm"
            >
              <span className="btn-dot" />
              New session
              <span className="btn-arrow">→</span>
            </button>
            <UserButton
              appearance={{
                variables: {
                  colorText: '#e2e8f4',
                  colorTextSecondary: '#8892a4',
                  colorBackground: '#13151c',
                  colorInputBackground: '#191d28',
                  colorPrimary: '#22c55e',
                },
                elements: {
                  avatarBox: 'w-8 h-8',
                  userButtonPopoverCard: 'shadow-[var(--shadow-elev)] border border-white/[0.08] bg-[#13151c]',
                  userButtonPopoverActionButton: 'hover:bg-[#191d28] text-[#e2e8f4]',
                  userButtonPopoverFooter: '!hidden',
                  badge: '!hidden',
                },
              }}
            >
              <UserButton.MenuItems>
                <UserButton.Action
                  label="Account"
                  labelIcon={<AccountIcon />}
                  onClick={() => navigate('/account')}
                />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>
        </div>
      </nav>
    </motion.header>
  )
}
