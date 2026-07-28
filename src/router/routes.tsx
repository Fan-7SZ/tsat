import { Navigate, type RouteObject } from "react-router"

import { AppRoot, RootErrorBoundary, RootHydrateFallback } from "@/App"
import { MainLayout } from "@/layouts/MainLayout"
import { DocumentLayout } from "@/layouts/DocumentLayout"
import { Home } from "@/pages/Home"
import { MyGoals } from "@/pages/MyGoals"
import { Tasks } from "@/pages/Tasks"
import { AllTasks } from "@/pages/AllTasks"
import { GoalDetail, GoalDetailErrorBoundary } from "@/pages/GoalDetail"
import { TaskDetail, TaskDetailErrorBoundary } from "@/pages/TaskDetail"
import { OAuthCallback } from "@/pages/OAuthCallback"
import { OpenRouterCallback } from "@/pages/OpenRouterCallback"
import {
  bootLoader,
  goalDetailLoader,
  listPagesLoader,
  mainLayoutLoader,
  taskDetailLoader,
} from "@/router/loaders"
import { Core } from "@/pages/doc/Core"
import { EstimatedOccurrences } from "@/pages/doc/EstimatedOccurrences"
import { TriggerAndRepeatRule } from "@/pages/doc/TriggerAndRepeatRule"
import { DailyFocus } from "@/pages/doc/DailyFocus"
import { QuickStart } from "@/pages/doc/QuickStart"
import { TriggerSetup } from "@/pages/doc/TriggerSetup"
import { RepeatRuleSetup } from "@/pages/doc/RepeatRuleSetup"
import { SyncSetup } from "@/pages/doc/SyncSetup"
import { AiSetup } from "@/pages/doc/AiSetup"

export const appRoutes: RouteObject[] = [
  {
    element: <AppRoot />,
    HydrateFallback: RootHydrateFallback,
    ErrorBoundary: RootErrorBoundary,
    children: [
      { path: "auth/callback", element: <OAuthCallback />, loader: bootLoader },
      {
        path: "auth/openrouter",
        element: <OpenRouterCallback />,
        loader: bootLoader,
      },
      {
        path: "/",
        element: <MainLayout />,
        loader: mainLayoutLoader,
        // The sidebar is fed by live queries; the loader only covers the first
        // frame, so re-running it on every navigation would be wasted work.
        shouldRevalidate: () => false,
        children: [
          { index: true, element: <Home />, loader: listPagesLoader },
          { path: "tasks", element: <Tasks />, loader: listPagesLoader },
          { path: "all-tasks", element: <AllTasks />, loader: listPagesLoader },
          { path: "my-goals", element: <MyGoals />, loader: listPagesLoader },
          {
            path: "goals/:id",
            element: <GoalDetail />,
            loader: goalDetailLoader,
            ErrorBoundary: GoalDetailErrorBoundary,
          },
          {
            path: "tasks/:id",
            element: <TaskDetail />,
            loader: taskDetailLoader,
            ErrorBoundary: TaskDetailErrorBoundary,
          },
        ],
      },
      {
        path: "doc",
        element: <DocumentLayout />,
        children: [
          { index: true, element: <Navigate to="concepts/core" replace /> },
          { path: "concepts/core", element: <Core /> },
          {
            path: "concepts/estimated-occurrences",
            element: <EstimatedOccurrences />,
          },
          {
            path: "concepts/trigger-and-repeat-rule",
            element: <TriggerAndRepeatRule />,
          },
          { path: "concepts/daily-focus", element: <DailyFocus /> },
          { path: "guides/quick-start", element: <QuickStart /> },
          { path: "guides/set-a-trigger", element: <TriggerSetup /> },
          { path: "guides/set-a-repeat-rule", element: <RepeatRuleSetup /> },
          { path: "guides/sync-setup", element: <SyncSetup /> },
          { path: "guides/ai-setup", element: <AiSetup /> },
        ],
      },
    ],
  },
]
