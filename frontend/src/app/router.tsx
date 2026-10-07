import { createBrowserRouter } from 'react-router'
import { AppShell } from '../components/layout/AppShell'

/** Route-level code splitting keeps first load under budget (DESIGN.md §10). */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const router = createBrowserRouter([
  { path: '/', lazy: page(() => import('../features/landing/LandingPage')) },
  { path: '/sign-in', lazy: page(() => import('../features/auth/SignInPage')) },
  { path: '/sign-up', lazy: page(() => import('../features/auth/SignUpPage')) },
  { path: '/try/position-size', lazy: page(() => import('../features/academy/TryLessonPage')) },
  {
    Component: AppShell,
    children: [
      { path: '/learn', lazy: page(() => import('../features/academy/LearnPage')) },
      { path: '/journal', lazy: page(() => import('../features/journal/JournalPage')) },
      { path: '/lab', lazy: page(() => import('../features/strategy/LabPage')) },
      { path: '/progress', lazy: page(() => import('../features/progress/ProgressPage')) },
      { path: '/more', lazy: page(() => import('../features/settings/MorePage')) },
    ],
  },
  { path: '*', lazy: page(() => import('../features/NotFoundPage')) },
])
