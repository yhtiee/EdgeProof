import { createBrowserRouter, redirect } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { RequireOnboarded, RequireOnboarding } from './guards'

/** Route-level code splitting keeps first load under budget (DESIGN.md §10). */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const router = createBrowserRouter([
  { path: '/', lazy: page(() => import('../features/landing/LandingPage')) },
  { path: '/sign-in', lazy: page(() => import('../features/auth/SignInPage')) },
  { path: '/sign-up', lazy: page(() => import('../features/auth/SignUpPage')) },
  { path: '/try', lazy: page(() => import('../features/academy/TryLessonPage')) },
  { path: '/try/position-size', lazy: page(() => import('../features/academy/TrySimulatorPage')) },
  {
    Component: RequireOnboarding,
    children: [{ path: '/onboarding', lazy: page(() => import('../features/onboarding/OnboardingPage')) }],
  },
  {
    Component: RequireOnboarded,
    children: [
      // Lesson and exam screens are full-focus: no tab bar or sidebar (DESIGN.md §12).
      { path: '/learn/:slug', lazy: page(() => import('../features/academy/LessonPage')) },
      { path: '/learn/exam/:key', lazy: page(() => import('../features/academy/ExamPage')) },
      {
        Component: AppShell,
        children: [
          { path: '/learn', lazy: page(() => import('../features/academy/LearnPage')) },
          {
            path: '/journal',
            lazy: page(() => import('../features/journal/JournalLayout')),
            children: [
              { index: true, lazy: page(() => import('../features/journal/TradesPage')) },
              { path: 'metrics', lazy: page(() => import('../features/journal/MetricsPage')) },
              { path: 'reviews', lazy: page(() => import('../features/journal/ReviewsPage')) },
              { path: 'setup', lazy: page(() => import('../features/journal/SetupPage')) },
            ],
          },
          { path: '/journal/new', lazy: page(() => import('../features/journal/TradeFormPage')) },
          { path: '/journal/:key', lazy: page(() => import('../features/journal/TradeFormPage')) },
          { path: '/lab', lazy: page(() => import('../features/strategy/LabPage')) },
          { path: '/lab/:strategyId', lazy: page(() => import('../features/strategy-lab/StrategyPage')) },
          { path: '/lab/:strategyId/v/:number/:step', lazy: page(() => import('../features/strategy-lab/BuilderPage')) },
          // Fundamental Bias Scanner: open to every signed-in learner, no gate (docs/scanner).
          {
            path: '/scanner',
            lazy: page(() => import('../features/scanner/ScannerLayout')),
            children: [
              { index: true, lazy: page(() => import('../features/scanner/PairsPage')) },
              { path: 'currencies', lazy: page(() => import('../features/scanner/CurrenciesPage')) },
              { path: 'evidence', lazy: page(() => import('../features/scanner/EvidencePage')) },
            ],
          },
          { path: '/scanner/:symbol', lazy: page(() => import('../features/scanner/PairPage')) },
          // Progress is a section of the profile; old links still land there.
          { path: '/progress', loader: () => redirect('/profile#progress') },
          { path: '/settings', lazy: page(() => import('../features/settings/MorePage')) },
          { path: '/more', loader: () => redirect('/settings') },
          { path: '/profile', lazy: page(() => import('../features/profile/ProfilePage')) },
        ],
      },
    ],
  },
  { path: '*', lazy: page(() => import('../features/NotFoundPage')) },
])
