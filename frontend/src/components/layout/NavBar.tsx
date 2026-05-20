import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/clerk-react'
import { motion, AnimatePresence } from 'framer-motion'
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

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <motion.line
        x1="3" y1="6" x2="17" y2="6"
        stroke="#e2e8f4" strokeWidth="1.5" strokeLinecap="round"
        animate={open ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
        style={{ originX: '10px', originY: '6px' }}
      />
      <motion.line
        x1="3" y1="10" x2="17" y2="10"
        stroke="#e2e8f4" strokeWidth="1.5" strokeLinecap="round"
        animate={open ? { opacity: 0 } : { opacity: 1 }}
      />
      <motion.line
        x1="3" y1="14" x2="17" y2="14"
        stroke="#e2e8f4" strokeWidth="1.5" strokeLinecap="round"
        animate={open ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
        style={{ originX: '10px', originY: '14px' }}
      />
    </svg>
  )
}

export function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const isInterviewRoom = location.pathname.includes('/interview/')

  if (isInterviewRoom) return null

  const handleNavClick = () => setMenuOpen(false)

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-[16px]">

        <Link to="/" className="flex items-center gap-2.5 group" onClick={handleNavClick}>
          <Logo />
          <span
            className="text-[17px] font-bold tracking-[-0.02em] text-paper transition-opacity duration-200 group-hover:opacity-70"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Intervue
          </span>
        </Link>

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

        <div className="flex items-center gap-2.5">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-ghost-pill hidden text-sm font-medium sm:inline-flex">
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
              className="hidden btn-primary text-sm sm:inline-flex"
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

          <button
            className="flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150 hover:bg-white/[0.06] md:hidden"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-white/[0.06] md:hidden"
            style={{ background: '#0c0e14' }}
          >
            <div className="flex flex-col px-6 py-4 gap-1">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={handleNavClick}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm transition-colors duration-150',
                    location.pathname === to
                      ? 'font-semibold text-paper bg-white/[0.06]'
                      : 'text-paper-faint hover:text-paper hover:bg-white/[0.04]'
                  )}
                >
                  {label}
                </Link>
              ))}
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-col gap-2">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="btn-ghost-pill w-full justify-center text-sm font-medium" onClick={handleNavClick}>
                      Sign in
                    </button>
                  </SignInButton>
                  <button
                    onClick={() => { navigate('/setup'); handleNavClick() }}
                    className="btn-primary w-full justify-center text-sm"
                  >
                    <span className="btn-dot" />
                    Start a mock
                    <span className="btn-arrow">→</span>
                  </button>
                </SignedOut>
                <SignedIn>
                  <button
                    onClick={() => { navigate('/setup'); handleNavClick() }}
                    className="btn-primary w-full justify-center text-sm"
                  >
                    <span className="btn-dot" />
                    New session
                    <span className="btn-arrow">→</span>
                  </button>
                </SignedIn>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
