import type { Dictionary } from "./types"

export const en: Dictionary = {
  // ── Common ──
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    continue: "Continue",
    loading: "Loading…",
    noGoal: "No goal",
    mins: "mins",
    due: "Due:",
    steps: (n) => `${n} steps`,
    standalone: "Standalone",
    triggerHelpTooltipLabel: "How triggers work",
    triggerHelpTooltip:
      "Resets progress and brings the goal back each time the trigger fires — best for goals doable in a day.",
  },

  // ── Navigation ──
  nav: {
    home: "Home",
    myGoals: "My Goals",
    myTasks: "My Tasks",
    allTasks: "All Tasks",
    goals: "Goals",
    tasks: "Tasks",
  },

  // ── Sidebar footer menu ──
  sidebar: {
    more: "More",
    help: "Help",
    about: "About",
  },

  // ── Doc site sidebar ──
  doc: {
    groups: {
      concepts: "Concepts",
      guides: "Guides",
    },
    concepts: {
      core: "Core Concepts",
      estimatedOccurrences: "Estimated Occurrences",
      trigger: "Trigger",
      repeatRule: "RepeatRule",
      repeatRuleVsTrigger: "RepeatRule vs Trigger",
      dailyFocus: "Daily Focus",
    },
    guides: {
      quickStart: "Quick Start",
      setTrigger: "Set a Trigger",
      setRepeatRule: "Set a RepeatRule",
      syncSetup: "Sync Setup",
      aiEstimationSetup: "AI Setup",
    },
    home: "Home",
    onThisPage: "On this page",
  },

  // ── Status labels ──
  status: {
    todo: "Todo",
    inProgress: "In Progress",
    done: "Done",
    notScheduled: "Not Scheduled",
    completed: "Completed",
    incomplete: "Incomplete",
    focused: "Focused",
    unfocused: "Unfocused",
    dismissedToday: "Excluded from today",
  },
  dueBadge: {
    prefix: "Due",
    overdue: "Overdue",
    today: "Due today",
    tomorrow: "Due tomorrow",
    inDays: (n) => `in ${n}d`,
  },
  runtimeSource: {
    duePolicy: "Pulled in by due policy",
    goalDuePolicy: "Pulled in by goal due policy",
    repeatPolicy: "Pulled in by repeat rule",
    triggerPolicy: "Pulled in by trigger",
    manual: "Added manually",
    default: "Auto-scheduled",
  },

  // ── Home page ──
  home: {
    greetingMorning: "Good morning!",
    greetingAfternoon: "Good afternoon!",
    greetingEvening: "Good evening!",
    greetingNight: "Good night!",
    todaysTasks: "Today's Tasks",
    todaysFocus: "Today's Focus",
    planningPressure: "Planning Pressure",
    pressureLow: "Low",
    pressureHigh: "High",
    pressureTooltip: (count, minutes) =>
      `${count} planned${minutes ? ` · ${minutes}m` : ""}`,
    pressureReasonRepeat: "Repeat",
    pressureReasonTaskTrigger: "Task trigger",
    pressureReasonGoalTrigger: "Goal trigger",
    pressureNoGoal: "No goal",
    pressurePullupTitle: "Planning",
    pressureDueTitle: "Due",
    pressureDueTask: "Task",
    pressureDueGoal: "Goal",
    pressureDueSummary: (dueCount) =>
      `${dueCount} due ${dueCount === 1 ? "item" : "items"}`,
    recentActivities: "Recent Activities",
    addTask: "Add Task",
    replanToday: "Replan today",
    newGoal: "New Goal",
    focusAllTasksDismissed: "Every task of this goal is removed from today — nothing to focus.",
    taskMarkedDone: (title) => `"${title}" marked as done`,
    noRecentActivities: "No recent activities for now",
  },

  // ── Tasks page ──
  tasks: {
    today: "Today",
    plans: "Plans",
    unscheduled: "Unscheduled",
    tomorrow: "Tomorrow",
    in7Days: "In 7 Days",
    skipped: "Skipped",
    addTask: "Add Task",
    noTasksFound: "No tasks found.",
    todoCount: (n) => `Todo (${n})`,
    inProgressCount: (n) => `In Progress (${n})`,
    doneCount: (n) => `Done (${n})`,
    tomorrowCount: (n) => `Tomorrow (${n})`,
    in7DaysCount: (n) => `In 7 Days (${n})`,
    skippedCount: (n) => `Skipped (${n})`,
    unscheduledCount: (n) => `Unscheduled (${n})`,
    planOn: (dateLabel) => `plan on ${dateLabel}`,
    skippedPlan: (dateLabel) => `skipped ${dateLabel}`,
    skippedTimes: (n) => `skipped ${n} times`,
    taskSkipped: "Task skipped for today",
    restoreInPlans: "Restore in Plans",
    byTriggerCount: (n) => `By Trigger (${n})`,
    pulledByGoalTrigger: "Pulled up by its goal's trigger",
    alsoTriggersOn: "Also triggers on the following dates",
    pullUpLabel: (date) => `Pull-Up: ${date}`,
  },

  // ── Task runs dialog (a task with several runs today) ──
  taskRuns: {
    title: "Multiple items detected",
    description:
      "This task appears more than once in today's list — usually because it was added again by hand, or a repeat rule carried over an unfinished item.",
    openLabel: (count: number) => `${count} items today`,
    columnRun: "Item",
    columnStatus: "Status",
    remove: "Remove this item",
  },

  // ── Repeat debt popover ──
  repeatDebt: {
    triggerLabel: "Why this repeat item is here",
    title: "Why am I seeing this repeat item?",
    description:
      "This item was carried into today because a planned repeat occurrence was not completed on its original day.",
    originalPlanLabel: "Originally planned for",
    markDone: "Mark done",
    ignoreOne: "Ignore this debt item",
    ignored: "Debt item ignored",
  },

  // ── Pull-up info popover ──
  pullUpInfo: {
    label: "Pull-up info",
    repeatTitle: "Repeat pull-up",
    triggerTitle: "Trigger pull-up",
    goalTriggerTitle: "Pulled up by goal trigger",
    repeatDescription:
      "This task is scheduled automatically by its repeat rule; below are its cadence and planned dates.",
    triggerDescription:
      "This task is pulled up automatically by a trigger rule within its active window, not by a fixed due date.",
    goalTriggerDescription:
      "This task's goal has a trigger; the task is pulled up whenever the goal fires.",
    ruleLabel: "Rule",
    nextLabel: "Next",
    windowLabel: "Window",
    cadenceDaily: "Daily",
    cadenceEveryNDays: (n) => `Every ${n} days`,
    cadenceWeekly: (days) => `Weekly on ${days}`,
    cadenceEveryNWeeks: (n, days) => `Every ${n} weeks on ${days}`,
    cadenceMonthly: (day) => `Monthly on day ${day}`,
    cadenceCustom: "Custom dates",
  },

  // ── My Goals page ──
  myGoals: {
    title: "My Goals",
    inProgress: "In Progress",
    done: "Done",
    noGoalsInProgress: "No goals in progress, let's create one!",
    noGoalsDone: "No goals done yet, keep going!",
    newGoal: "New Goal",
    select: "Select",
    deleteCount: (count) => `Delete (${count})`,
    deleteGoalsTitle: (count) => `Delete ${count} Goal(s)?`,
    deleteGoalsDescription:
      "This will permanently delete the selected goals and all associated data.",
  },

  // ── All Tasks page ──
  allTasks: {
    title: "All Tasks",
    searchPlaceholder: "Search tasks...",
    allGoals: "All Goals",
    allStatuses: "All Statuses",
    allCompletion: "All Completion",
    completedOnly: "Completed",
    incompleteOnly: "Incomplete",
    columnTitle: "Title",
    columnGoal: "Goal",
    columnStatus: "Status",
    columnCompletion: "Completion",
    columnDueDate: "Due Date",
    columnDuration: "Duration",
    viewDetails: "View Details",
    deleteCount: (count) => `Delete (${count})`,
    deleteTasksTitle: (count) => `Delete ${count} Task(s)?`,
    deleteTasksDescription:
      "This will permanently delete the selected tasks and all associated data.",
    minLabel: "min",
  },

  // ── Goal Detail page ──
  goalDetail: {
    details: "Details",
    tasks: "Tasks",
    notes: "Notes",
    duration: "Duration",
    goalProgress: "Goal Progress",
    activityLogs: "Activity Logs",
    createdByGoal: "Created by this goal",
    taskDependencyTree: "Task Dependency Tree",
    tasksList: "Tasks List",
    addTasks: "Add Tasks",
    aiAddTasks: "AI breakdown",
    taskFilter: "Task Filter",
    addTag: "Add tag",
    notesPlaceholder: "Here, right here!",
    noActivity: "No activity yet.",
    noTasks: "No tasks created by this goal yet.",
    noDependencyGraph:
      "No dependency graph yet. Create a task from this goal to initialize relationships.",
    deleteGoalTitle: "Delete Goal?",
    deleteGoalDescription:
      "This will permanently delete this goal and all associated data.",
    deleteTaskTitle: "Delete Task?",
    deleteTaskDescription:
      "This will permanently delete this task and all associated data.",
    durationUpdated: "Duration updated",
    durationDisabledByTrigger:
      "Duration is disabled while this goal uses a trigger.",
    trigger: "Trigger",
    triggerDisabled: "No trigger configured.",
    triggerMissingRule: "Trigger is enabled, but its rule is missing.",
    openTriggerSettings: "Open trigger settings",
    closeTriggerSettings: "Close trigger settings",
    triggerSaved: "Trigger saved",
    triggerRemoved: "Trigger removed",
    triggerOverwriteTitle: "Overwrite task settings?",
    triggerOverwriteDescription:
      "Some tasks in this goal have a planned count other than 1, or a repeat / trigger rule. Enabling the trigger will reset them to single-run tasks and delete their repeat planning points and trigger rules. Continue?",
    notesSaved: "Notes saved",
    goalNotFound: "Goal not found",
    doubleClickDescription: "Double click to add description.",
    tasksCompleted: "tasks completed",
    totalTimeSpent: "Total time spent",
  },

  // ── Task Detail page ──
  taskDetail: {
    notSet: "(Not set)",
    durationUpdated: "Duration updated",
    stepAdded: "Step added",
    notesSaved: "Notes saved",
    taskNotFound: "Task not found",
    deleteTaskTitle: "Delete Task?",
    deleteTaskDescription:
      "This will permanently delete this task and all associated data.",
    notes: "Notes",
    notesPlaceholder: "Here, right here!",
    steps: "Steps",
    addStepPlaceholder: "Add a step...",
    relationships: "Relationships",
    noDependencyGraph:
      "No dependency graph. This task is not associated with a goal.",
    schedule: "Schedule",
    due: "Due",
    latestFinishTime: "Latest finish time",
    dueDateUpdated: "Due date updated",
    dueDateCleared: "Due date cleared",
    estimatedDuration: "Estimated Duration",
    repeat: "Repeat",
    daily: "Daily",
    weekly: "Weekly",
    everyNDays: "Every N days",
    daysOfWeek: "Days of week",
    everyNWeeks: "Every N weeks",
    repeatPeriodRequired: "Repeat period is required.",
    pickBothDates: "Pick both start and end dates for the repeat period.",
    addDueDateFirst:
      "Add a due date to the goal before configuring a repeat period or preview dates.",
    repeatDisabledByTriggerGoal:
      "This goal uses a trigger, so tasks in it can only be single-run tasks.",
    scheduleLockedByTriggerGoal:
      "This goal uses a trigger; task scheduling is governed by the trigger and the task is single-run.",
    totalLockedByTrigger:
      "A trigger task is single-run; estimated occurrences is fixed at 1.",
    estimatedOccurrences: "Estimated Occurrences",
    totalExceedsOccurrences: (max: number) =>
      `Completion count cannot exceed ${max} planned occurrences.`,
    autoEstimate: "Auto Estimate",
    previewDates: "Preview Dates",
    activityLogs: "Activity Logs",
    contributeTo: "Contribute to",
    doubleClickDescription: "Double click to add description.",
    trigger: "Trigger",
    triggerDisabled: "No trigger configured.",
    openTriggerSettings: "Open trigger settings",
    closeTriggerSettings: "Close trigger settings",
    triggerSaved: "Trigger saved",
    triggerRemoved: "Trigger removed",
    repeatSaved: "Repeat rule saved",
    scheduleSaved: "Schedule saved",
    allowCrossDay: "Allow cross-day",
    allowCrossDayHelp:
      "When enabled, an in-progress task is kept across the day boundary instead of being cleared (and a trigger task won't re-fire while it's unfinished).",
    allowCrossDayHelpLabel: "Cross-day help",
    crossDayDisabledByRepeat:
      "Repeat tasks have fixed pull-up dates and don't support cross-day.",
    repeatRuleHelp:
      "Auto-schedules on a fixed cadence (every N days / chosen weekdays) within the active period.",
    repeatRuleHelpLabel: "Repeat rule help",
    triggerPeriod: "Trigger period",
    triggerPeriodPickBoth:
      "Pick both start and end dates for the trigger period.",
    dueDisabledByTrigger:
      "Due date is unavailable while this task uses a trigger.",
    repeatDisabledByTaskTrigger:
      "This task uses a trigger, so repeat settings are unavailable.",
    triggerDisabledByRepeat:
      "This task uses a repeat rule, so trigger settings are unavailable.",
    triggerDisabledByGoalTrigger:
      "The goal of this task already uses a trigger.",
    customCompletion: "Custom completion…",
    todayDone: "Done today",
    completionRecords: "Completion records",
    colDate: "Date",
    colStatus: "Status",
    colActions: "Actions",
    addRow: "Add row",
    quickAddToday: "Quick-add today",
    pointPlanned: "Planned",
    pointCompleted: "Completed",
    pointSkipped: "Skipped",
    noRecentActivities: "No recent activities for now",
  },

  // ── Settings ──
  settings: {
    title: "Settings",
    tabGeneral: "General",
    tabPlanner: "Planner",
    tabSync: "Sync",
    tabAi: "AI",
    language: "Language",
    theme: "Theme",
    themeSystem: "Follow system",
    themeLight: "Light",
    themeDark: "Dark",
    dailyCapacity: "Daily scheduling capacity",
    dailyCapacityHelp:
      "Total minutes the scheduler can allocate into today before it stops auto-planning additional tasks.",
    taskForcedThreshold: "Task forced-today threshold (days)",
    taskForcedThresholdHelp:
      "Tasks whose due date is within this many days from today will be automatically added to today and cannot be removed. Set 0 for due-today only, 1 for due today or tomorrow, etc.",
    goalForcedThreshold: "Goal forced-focus threshold (days)",
    goalForcedThresholdHelp:
      "Goals whose due date is within this many days from today will be automatically focused and cannot be unfocused. Same semantics as above.",
    maxFocusGoals: "Auto-focused goals per day",
    maxFocusGoalsHelp:
      "How many goals auto-planning selects for today's focus (least-complete first) and spreads today's tasks across. Rule-forced goals count toward it. You can always manually focus more — this only sets the automatic selection count, it doesn't cap manual focus.",
    aiSection: "AI Configuration",
    aiProvider: "AI Provider",
    aiProviderHelp:
      "Choose your AI provider. Each provider requires its own API key.",
    openRouterApiKey: "OpenRouter API Key",
    openRouterApiKeyHelp:
      "Get your API key from openrouter.ai. The key is stored locally in your browser.",
    openRouterConnect: "Get key from OpenRouter",
    openRouterModel: "Model",
    openRouterModelHelp:
      "OpenRouter model identifier, e.g. openai/gpt-4o-mini.",
    openRouterModelPlaceholder: "openai/gpt-4o-mini",
    deepseekApiKey: "DeepSeek API Key",
    deepseekApiKeyHelp:
      "Get your API key from platform.deepseek.com. The key is stored locally in your browser.",
    deepseekModel: "Model",
    deepseekModelHelp: "DeepSeek model identifier, e.g. deepseek-v4-flash.",
    deepseekModelPlaceholder: "deepseek-v4-flash",
  },

  // ── OpenRouter OAuth callback page ──
  openRouterOAuth: {
    connectFailedToast: "Could not connect to OpenRouter. Please try again.",
    exchangingTitle: "Connecting to OpenRouter…",
    exchangingDescription: "Exchanging the authorization code for an API key.",
    successTitle: "OpenRouter connected",
    successDescription:
      "An API key was created and saved to your AI settings.",
    errorTitle: "OpenRouter authorization failed",
    errorDescription:
      "The authorization code could not be exchanged for an API key. Please return to Settings and try again.",
    done: "Done",
    returnToApp: "Return to app",
  },

  // ── Create Task Dialog ──
  createTask: {
    title: "Create a Task",
    taskName: "Task Name",
    taskNameRequired: "Task name is required.",
    taskNamePlaceholder: "What needs to be done?",
    descriptionOptional: "Description",
    descriptionPlaceholder: "Add more details...",
    goal: "Contribute to Goal",
    noGoalStandalone: "No goal (standalone task)",
    dueDate: "Due",
    time: "Latest finish time",
    invalidTime: "Invalid time.",
    atLeast1Minute: "Must be at least 1 minute.",
    dueRequired: "Due date is required for standalone tasks.",
    repeatRequiresGoal: "Repeat requires a goal.",
    noDueWithRepeat: "Cannot set due date when repeat is enabled.",
    estimatedDuration: "Estimated Duration",
    repeat: "Repeat",
    repeatMode: "Repeat Mode",
    interval: "Every N days",
    daysOfWeek: "Days of week",
    startDate: "Start Date",
    endDate: "End Date",
    plannedOccurrences: "Estimated Occurrences",
    totalExceedsOccurrences: (max: number) =>
      `Completion count cannot exceed ${max} planned occurrences.`,
    daily: "Daily",
    weekly: "Weekly",
    information: "Information",
    steps: "Steps",
    addStep: "Add step",
    addStepPlaceholder: "Add a step...",
    schedule: "Schedule",
    latestFinishTime: "Latest finish time",
    clearDueDate: "Clear due date",
    dueWithinGoal: "Task due must stay within the selected goal duration.",
    dueRequiredStandalone:
      "Required for standalone tasks. Default: today 23:59.",
    dueOptionalGoal: "Optional for goal tasks.",
    repeatPeriodRequired: "Repeat period is required.",
    pickBothDates: "Pick both start and end dates for the repeat period.",
    everyNWeeks: "Every N weeks",
    repeatPeriod: "Repeat Period (required)",
    addDueDateFirst:
      "Add a due date to the goal before configuring a repeat period or preview dates.",
    repeatDisabledByTriggerGoal:
      "This goal uses a trigger, so tasks in it can only be single-run tasks.",
    scheduleLockedByTriggerGoal:
      "This goal uses a trigger; task scheduling is governed by the trigger and the task is single-run.",
    autoEstimate: "Auto Estimate",
    previewDates: "Preview Dates",
    taskDependencies: "Task Dependencies",
    createTask: "Create Task",
    taskCreated: "Task created",
    dueTooEarly: (date) => `Task due cannot be earlier than ${date}.`,
    dueTooLate: (date) => `Task due cannot be later than ${date}.`,
  },

  // ── Create Goal Dialog ──
  createGoal: {
    title: "Create a Goal",
    goalName: "Goal Name",
    goalNameRequired: "Goal name is required.",
    descriptionOptional: "Description (Optional)",
    descriptionPlaceholder: "Describe your goal here.",
    namePlaceholder: "Name",
    fromTo: "From to",
    selectBothDates: "Please select both start and end date.",
    endAfterStart: "End time must be later than start time.",
    schedule: "Schedule",
    goalDue: "Due date (optional)",
    dueTimeLabel: "Due time",
    clearDue: "Clear due date",
    selectDate: "Select date",
    createGoal: "Create Goal",
    createWithTasks: "Create & add tasks",
    goalCreated: "Goal created",
    settingTrigger: "Trigger",
    clearDateRange: "Clear date range",
    openTriggerSettings: "Open trigger settings",
    closeTriggerSettings: "Close trigger settings",
    triggerModePlaceholder: "Select trigger mode",
    triggerDaily: "Daily",
    triggerWeekly: "Weekly",
    triggerMonthly: "Monthly",
    triggerCustom: "Custom",
    invalidTrigger: "Invalid trigger setting.",
    triggerDateRangeUnavailable: "Triggered goals cannot use a fixed due date.",
    triggerRepeatEvery: "Repeat every",
    triggerDaysOfWeek: "Days of week",
    triggerEveryNWeeks: "Every n weeks",
    triggerDayOfMonth: "Day of month",
    triggerDayOfMonthOption: (day) => `Day ${day}`,
    triggerMonthlyClampHint:
      "In months with fewer days, it fires on the last day of the month.",
    triggerCustomDates: "Custom dates",
    triggerSetDueLabel: "Set a due date on reset",
    triggerSetDueHint:
      "Each round is due at 23:59 the day before the next trigger — a daily trigger is due the same evening.",
    clearCustomDates: "Clear",
    triggerDailyIntervalRequired:
      "Please enter a valid repeat interval for the daily trigger.",
    triggerWeeklyDaysRequired:
      "Please select at least one weekday for the weekly trigger.",
    triggerWeeklyIntervalRequired:
      "Please enter a valid repeat interval for the weekly trigger.",
    triggerMonthlyDayRequired:
      "Please pick a day of the month (1–31) for the monthly trigger.",
    triggerCustomDatesRequired:
      "Please select at least one date for the custom trigger.",
  },

  // ── Confirm Delete Dialog ──
  confirmDelete: {
    defaultTitle: "Are you sure?",
    defaultDescription: "This action cannot be undone.",
  },

  // ── Change task's goal binding ──
  goalRebind: {
    label: "Goal",
    editRelationship: "Edit goal relationship",
    addRelationship: "Add goal relationship",
    relationshipHint:
      "Choose which goal this task belongs to, or make it standalone.",
    normalizeTitle: "Reset task settings?",
    normalizeDescription:
      "This destination can't hold a repeating or triggered task. Continuing resets the task to a single run and clears its repeat and trigger rules.",
    moved: "Task moved.",
    moveFailed: "Failed to move task.",
  },

  // ── Checklist Dialog ──
  checklist: {
    title: "Checklist",
    description: "Verify each step is completed before marking done",
    confirmDone: "Confirm Done",
  },

  // ── Sync ──
  sync: {
    title: "Sync",
    providerLabel: "Provider",
    providerPlaceholder: "Select a provider",
    providerHelp: "Select a supported cloud sync service.",
    providerLockedHelp:
      "The current sync provider is still bound. Disconnect it before switching.",
    providerNone: "None",
    providerGoogleDrive: "Google Drive",
    providerOneDrive: "OneDrive",
    autoSync: "Auto sync",
    lastSynced: "Last synced",
    neverSynced: "Never synced",
    unknownTime: "Unknown time",
    syncNow: "Sync now",
    syncingNow: "Syncing...",
    syncNowFailed: "Sync failed. Please try again later.",
    oauthCallback: {
      connectedTitle: "Connected",
      connectedDescription:
        "This device is now connected and ready to sync. You can return to the app.",
      done: "Done",
      errorTitle: "Authorization failed",
      invalidTitle: "Invalid authorization result",
      invalidDescription:
        "No usable authorization result was received. Start authorization again from the app.",
      returnToApp: "Return to app",
      errors: {
        invalidOAuthState:
          "Authorization state was invalid. Restart authorization.",
        missingRefreshToken:
          "The provider did not return a reusable credential. Restart authorization and grant offline access.",
        providerError:
          "The provider could not complete authorization. Try again.",
        oauthCallbackFailed: "Authorization could not be completed. Try again.",
      },
    },
    googleDrive: {
      title: "Google Drive",
      statusDescriptions: {
        authorized: "Google Drive is connected and ready to sync data.",
        authorizing:
          "Complete the authorization flow in the Google popup window.",
        refreshing: "Refreshing Google Drive authorization status.",
        unauthorized:
          "After authorization, sync data will be stored in the Google Drive App Data folder.",
      },
      buttonLabels: {
        disconnect: "Disconnect",
        disconnecting: "Disconnecting...",
        authorizing: "Authorizing...",
        refreshing: "Connecting...",
        authorize: "Authorize Google Drive",
      },
      errors: {
        authorizationFailed:
          "Google Drive authorization failed. Please authorize again.",
        syncUnavailable:
          "Google Drive sync is temporarily unavailable. Please try again later.",
      },
    },
    oneDrive: {
      title: "OneDrive",
      statusDescriptions: {
        authorized: "OneDrive is connected and ready to sync data.",
        authorizing:
          "Complete the authorization flow in the OneDrive popup window.",
        refreshing: "Refreshing OneDrive authorization status.",
        unauthorized:
          "After authorization, sync data will be stored in the OneDrive app folder.",
      },
      buttonLabels: {
        disconnect: "Disconnect",
        disconnecting: "Disconnecting...",
        authorizing: "Authorizing...",
        refreshing: "Connecting...",
        authorize: "Authorize OneDrive",
      },
      errors: {
        authorizationFailed:
          "OneDrive authorization failed. Please authorize again.",
        syncUnavailable:
          "OneDrive sync is temporarily unavailable. Please try again later.",
      },
    },
    dangerZone: {
      title: "Danger zone",
      description:
        "Revokes the provider authorization for this device and permanently deletes the cloud data backup of all devices. This cannot be undone.",
      action: "Delete authorization & cloud backup",
      actionInProgress: "Deleting...",
      confirm: (providerTitle: string) =>
        `This will permanently delete the cloud data backup of all devices in your ${providerTitle} account and revoke this device's authorization. This cannot be undone. Continue?`,
      errorFailed: "Failed to clear the cloud backup. Please try again later.",
    },
    syncTooltip: {
      lastSyncAt: "Last synced at",
      lastSyncAtNever: "Not synced yet",
      error: "Last sync failed",
      authorizationFailed: "Authorization failed",
      syncUnavailable: "Sync unavailable",
      syncing: "Syncing...",
    },
  },

  // ── Context Menu / Quick Actions ──
  actions: {
    unfocus: "Unfocus",
    focusToday: "Focus Today",
    viewDetails: "View Details",
    moreActions: "More actions",
    addToToday: "Add to Today",
    markInProgress: "Mark In Progress",
    markDone: "Mark Done",
    undoComplete: "Undo Complete",
    moveBackToTodo: "Move Back to Todo",
    runAgain: "Do It Again",
    undoOnce: "Undo One Completion",
    runOrdinal: (n: number) => `Item ${n}`,
    carriedOver: (dateLabel: string) => `Since ${dateLabel}`,
    runsDoneToday: (count: number) => `Done ${count}x`,
    moveBackToInProgress: "Move Back to In Progress",
    skip: "Skip",
    excludeFromToday: "Exclude from Today",
    restoreToTodo: "Restore to Todo",
    deleteTask: "Delete Task",
    deleteGoal: "Delete Goal",
  },

  // ── Activity Item ──
  activity: {
    completed: "Completed",
    added: "Added",
    skipped: "Skipped",
  },

  // ── Quota Views ──
  quota: {
    occupiedMins: (used, capacity) => `Planned ${used}/${capacity} mins`,
    overLimitTooltip: (used, capacity) =>
      `Today's planned tasks total ${used} minutes (including completed ones), exceeding the daily threshold of ${capacity} minutes. The planner will not auto-add more tasks until capacity is freed.`,
    normalTooltip: (used, capacity) =>
      `Today's planned tasks (including completed ones) total ${used} of ${capacity} schedulable minutes.`,
    focusedCount: (focused, max) => `Focused ${focused}/${max}`,
    focusOverLimit: (max) =>
      `You've manually focused beyond the ${max} auto-selected goals. That's fine — every focused goal is still planned; auto-selection just stops adding more.`,
    focusWithForced: (forced) =>
      `${forced} ${forced === 1 ? "goal is" : "goals are"} auto-focused by rules.`,
    focusNormal: (max) =>
      `Auto-planning selects up to ${max} goals for today's focus. You can manually focus more anytime.`,
  },

  // ── Weekday labels ──
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],

  // ── FlowPanel ──
  flowPanel: {
    steps: (n) => `${n} steps`,
    progress: "Progress:",
    estimated: "Estimated:",
    taskCompleted: "Task fully completed",
    recurringTask: "Recurring task",
    runtimeTodo: "Today's todo",
    runtimeInProgress: "Today's in progress",
    runtimeDone: "Today's done",
    undo: "Undo",
  },

  // ── Duration Input ──
  durationInput: {
    placeholder: "e.g. 30m",
  },

  // ── Planner Dialog ──
  planner: {
    title: "Day Planner",
    taskPool: "Unscheduled",
    allScheduled: "All tasks are scheduled",
    export: "Export",
    importCalendar: "Import to Calendar App",
    exportFile: "Export .ics File",
    helpTitle: "How to use",
    help: "Click or drag an empty track to add a time block; right-click a block to delete it; scroll to move through tasks; hold Ctrl/⌘ and scroll to adjust the time scale.",
    noTodoTasks: "No to-do tasks to schedule",
  },

  // ── Date Range Time Picker ──
  dateRange: {
    startDate: "Start date",
    endDate: "End date",
    startTime: "Start Time",
    endTime: "End Time",
  },

  // ── DataTable ──
  dataTable: {
    selectAll: "Select all",
    selectRow: "Select row",
    noResults: "No tasks found.",
    rowsPerPage: "Rows per page",
    pageOf: (current, total) => `Page ${current} of ${total}`,
  },

  // ── Tag Editor ──
  tagEditor: {
    editGoalTag: "Edit goal tag",
    preset: "Preset",
    custom: "Custom",
    tagNamePlaceholder: "Tag name",
    addCustomTag: "Add custom tag",
    clearTag: "Clear tag",
    tagUpdated: "Tag updated.",
    tagUpdateFailed: "Failed to update tag.",
    tagCreateFailed: "Failed to create tag.",
    tagDeleted: "Tag deleted.",
    tagDeleteFailed: "Failed to delete tag.",
    deleteTagLabel: "Delete tag",
  },

  // ── Repeat Period Picker ──
  repeatPeriod: {
    notSet: "(Not set)",
    pickEndDate: "Pick an end date",
  },

  // ── Steps Item ──
  stepsItem: {
    editStepTitle: "Edit step title",
    removeStep: "Remove step",
    reorderStep: "Drag to reorder",
  },

  // ── Repeat Period Legend ──
  repeatLegend: {
    currentPeriod: "Current repeat period",
    ancestorPeriod: "Dependency-chain task period",
    plannedDates: "Planned dates",
  },

  // ── Schedule (repeat / trigger) window validation ──
  scheduleValidation: {
    repeatPeriod: "Repeat period",
    triggerPeriod: "Trigger period",
    pickBothDates: (period) =>
      `Pick both start and end dates for the ${period.toLowerCase()}.`,
    endOnOrAfterStart: (period) =>
      `${period} end must be on or after the start date.`,
    withinGoalDuration: (period) =>
      `${period} must stay within the selected goal duration.`,
    overlapsPredecessor: (period, title, start, end) =>
      `${period} overlaps with predecessor "${title}" (${start} – ${end}).`,
    overlapsSuccessor: (period, title, start, end) =>
      `${period} overlaps with successor "${title}" (${start} – ${end}).`,
    noOccurrences:
      "No occurrences fall inside the repeat window. Adjust the dates or pick at least one weekday.",
    totalExceedsOccurrences: (max) =>
      `Completion count cannot exceed the ${max} planned occurrences in the repeat window.`,
  },

  // ── App boot ──
  app: {
    loadError: "Failed to load data:",
  },

  // ── Forced Reason HoverCards ──
  forced: {
    manualFocus: "is currently focused manually.",
    triggerFocus:
      "was focused today by its trigger. You can still un-focus it — it will not come back until the trigger fires again.",
    autoPlanned: (count) =>
      `is focused because the scheduler added ${count} auto-planned today item${count === 1 ? "" : "s"} for this goal.`,
    goalDuePolicy:
      "is this goal's due date, which falls within the forced focus policy window.",
    taskDuePolicy:
      "is this task's due date, forcing it into today by due policy.",
    manualTodayTask:
      "was manually added to today. Remove it before unfocusing.",
    repeatPolicy: (plannedFor) =>
      `was imported to today by repeat policy${plannedFor ? ` (planned for ${plannedFor})` : ""}. Skip the task in My Tasks to unlock this goal.`,
    taskTriggerPolicy: (firedDate) =>
      `was brought into today by its trigger${firedDate ? ` (fired on ${firedDate})` : ""}. Complete or skip the task to unlock this goal.`,
    taskForced:
      "is this task's due date, which falls within the forced today policy window.",
    linkedGoal: "Linked goal:",
    repeatTaskImported: (plannedFor) =>
      `was imported by repeat policy${plannedFor ? ` (planned for ${plannedFor})` : ""}. Use Skip to remove it from today.`,
  },

  // ── AI scenario components ──
  ai: {
    errorNetwork: "Connection failed. Check your network and try again.",
    errorApi: "The AI service returned an error. Check your AI settings.",
    goSettings: "Open AI settings",
    noApiKey: "Set up your AI service first",
    decompose: {
      title: "Break down into tasks",
      subtitle:
        "Check tasks to regenerate; empty badges autofill. With none, AI decides a count first.",
      goalLabel: "Goal",
      placeholder: "Describe what this goal involves… (optional)",
      generate: "Generate",
      counting: "Deciding how many tasks…",
      tasksLabel: "Tasks",
      add: "Add task",
      taskPlaceholder: "Task name",
      deleteTask: "Delete task",
      empty: "Hit Generate to let AI split it, or add tasks with +",
      cancel: "Cancel",
      confirm: "Confirm",
    },
    steps: { idle: "Autofill", counting: "Counting…", filling: "Filling…" },
    dependency: {
      title: "Optimize dependencies",
      subtitle:
        "Only reorders dependencies between existing tasks — none added or removed.",
      placeholder: "Add your adjustments… (optional)",
      generate: "Optimize",
      optimizing: "Optimizing dependencies…",
      button: "Optimize deps",
    },
  },

  commands: {
    goalCreateFailed: "Failed to create goal.",
    goalUpdateFailed: "Failed to update goal.",
    goalDeleteFailed: "Failed to delete goal.",
    taskCreateFailed: "Failed to create task.",
    taskUpdateFailed: "Failed to update task.",
    taskDeleteFailed: "Failed to delete task.",
    dependencyUpdateFailed: "Failed to update dependency graph.",
  },
}
