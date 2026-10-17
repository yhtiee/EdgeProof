import { createBrowserRouter } from 'react-router'
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
          { path: '/progress', lazy: page(() => import('../features/progress/ProgressPage')) },
          { path: '/more', lazy: page(() => import('../features/settings/MorePage')) },
          { path: '/profile', lazy: page(() => import('../features/profile/ProfilePage')) },
        ],
      },
    ],
  },
  { path: '*', lazy: page(() => import('../features/NotFoundPage')) },
])
