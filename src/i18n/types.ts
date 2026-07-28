export interface Dictionary {
  // ── Common ──
  common: {
    save: string
    cancel: string
    delete: string
    confirm: string
    continue: string
    loading: string
    noGoal: string
    mins: string
    due: string // "Due:" prefix
    steps: (n: number) => string
    standalone: string
    triggerHelpTooltipLabel: string
    triggerHelpTooltip: string
  }

  // ── Navigation ──
  nav: {
    home: string
    myGoals: string
    myTasks: string
    allTasks: string
    goals: string
    tasks: string
  }

  // ── Sidebar footer menu ──
  sidebar: {
    more: string
    help: string
    about: string
  }

  // ── Doc site sidebar ──
  doc: {
    home: string
    onThisPage: string
    groups: {
      concepts: string
      guides: string
    }
    concepts: {
      core: string
      estimatedOccurrences: string
      trigger: string
      repeatRule: string
      repeatRuleVsTrigger: string
      dailyFocus: string
    }
    guides: {
      quickStart: string
      setTrigger: string
      setRepeatRule: string
      syncSetup: string
      aiEstimationSetup: string
    }
  }

  // ── Status labels ──
  status: {
    todo: string
    inProgress: string
    done: string
    notScheduled: string
    completed: string
    incomplete: string
    focused: string
    unfocused: string
    /** The user removed this task from today's plan (day-scoped). */
    dismissedToday: string
  }

  // ── Due badge (destructive) on the task detail header ──
  dueBadge: {
    prefix: string
    overdue: string
    today: string
    tomorrow: string
    inDays: (n: number) => string
  }

  // ── TaskRuntimeBadge source tooltip (how the task got pulled into today) ──
  runtimeSource: {
    duePolicy: string
    goalDuePolicy: string
    repeatPolicy: string
    triggerPolicy: string
    manual: string
    default: string
  }

  // ── Home page ──
  home: {
    greetingMorning: string
    greetingAfternoon: string
    greetingEvening: string
    greetingNight: string
    todaysTasks: string
    todaysFocus: string
    planningPressure: string
    pressureLow: string
    pressureHigh: string
    pressureTooltip: (count: number, minutes?: number) => string
    pressureReasonRepeat: string
    pressureReasonTaskTrigger: string
    pressureReasonGoalTrigger: string
    pressureNoGoal: string
    /** Hover-card section header for items pulled up by repeat/trigger rules. */
    pressurePullupTitle: string
    /** Hover-card section header for items whose own due date lands that day. */
    pressureDueTitle: string
    /** Tag on a due item that is a task. */
    pressureDueTask: string
    /** Tag on a due item that is a goal. */
    pressureDueGoal: string
    /** Hover-card summary, e.g. "2 due · 3 pulled up". */
    pressureDueSummary: (dueCount: number) => string
    recentActivities: string
    addTask: string
    replanToday: string
    newGoal: string
    noRecentActivities: string
    /** Tooltip when every task of a goal is removed from today. */
    focusAllTasksDismissed: string
    taskMarkedDone: (title: string) => string
  }

  // ── Tasks page ──
  tasks: {
    today: string
    plans: string
    unscheduled: string
    tomorrow: string
    in7Days: string
    skipped: string
    addTask: string
    noTasksFound: string
    todoCount: (n: number) => string
    inProgressCount: (n: number) => string
    doneCount: (n: number) => string
    tomorrowCount: (n: number) => string
    in7DaysCount: (n: number) => string
    skippedCount: (n: number) => string
    unscheduledCount: (n: number) => string
    planOn: (dateLabel: string) => string
    skippedPlan: (dateLabel: string) => string
    skippedTimes: (n: number) => string
    taskSkipped: string
    restoreInPlans: string
    byTriggerCount: (n: number) => string
    pulledByGoalTrigger: string
    alsoTriggersOn: string
    pullUpLabel: (date: string) => string
  }

  // ── Repeat debt popover ──
  taskRuns: {
    title: string
    description: string
    openLabel: (count: number) => string
    columnRun: string
    columnStatus: string
    remove: string
  }
  repeatDebt: {
    triggerLabel: string
    title: string
    description: string
    originalPlanLabel: string
    markDone: string
    ignoreOne: string
    ignored: string
  }

  // ── Pull-up info popover (repeat / trigger schedule explanation) ──
  pullUpInfo: {
    label: string
    repeatTitle: string
    triggerTitle: string
    goalTriggerTitle: string
    repeatDescription: string
    triggerDescription: string
    goalTriggerDescription: string
    ruleLabel: string
    nextLabel: string
    windowLabel: string
    cadenceDaily: string
    cadenceEveryNDays: (n: number) => string
    cadenceWeekly: (days: string) => string
    cadenceEveryNWeeks: (n: number, days: string) => string
    cadenceMonthly: (day: number) => string
    cadenceCustom: string
  }

  // ── My Goals page ──
  myGoals: {
    title: string
    inProgress: string
    done: string
    noGoalsInProgress: string
    noGoalsDone: string
    newGoal: string
    select: string
    deleteCount: (count: number) => string
    deleteGoalsTitle: (count: number) => string
    deleteGoalsDescription: string
  }

  // ── All Tasks page ──
  allTasks: {
    title: string
    searchPlaceholder: string
    allGoals: string
    allStatuses: string
    allCompletion: string
    completedOnly: string
    incompleteOnly: string
    columnTitle: string
    columnGoal: string
    columnStatus: string
    columnCompletion: string
    columnDueDate: string
    columnDuration: string
    viewDetails: string
    deleteCount: (count: number) => string
    deleteTasksTitle: (count: number) => string
    deleteTasksDescription: string
    minLabel: string
  }

  // ── Goal Detail page ──
  goalDetail: {
    details: string
    tasks: string
    notes: string
    duration: string
    goalProgress: string
    activityLogs: string
    createdByGoal: string
    taskDependencyTree: string
    tasksList: string
    addTasks: string
    aiAddTasks: string
    taskFilter: string
    addTag: string
    notesPlaceholder: string
    noActivity: string
    noTasks: string
    noDependencyGraph: string
    deleteGoalTitle: string
    deleteGoalDescription: string
    deleteTaskTitle: string
    deleteTaskDescription: string
    durationUpdated: string
    durationDisabledByTrigger: string
    trigger: string
    triggerDisabled: string
    triggerMissingRule: string
    openTriggerSettings: string
    closeTriggerSettings: string
    triggerSaved: string
    triggerRemoved: string
    triggerOverwriteTitle: string
    triggerOverwriteDescription: string
    notesSaved: string
    goalNotFound: string
    doubleClickDescription: string
    tasksCompleted: string
    totalTimeSpent: string
  }

  // ── Task Detail page ──
  taskDetail: {
    noRecentActivities: string
    notSet: string
    durationUpdated: string
    stepAdded: string
    notesSaved: string
    taskNotFound: string
    deleteTaskTitle: string
    deleteTaskDescription: string
    notes: string
    notesPlaceholder: string
    steps: string
    addStepPlaceholder: string
    relationships: string
    noDependencyGraph: string
    schedule: string
    due: string
    latestFinishTime: string
    dueDateUpdated: string
    dueDateCleared: string
    estimatedDuration: string
    repeat: string
    daily: string
    weekly: string
    everyNDays: string
    daysOfWeek: string
    everyNWeeks: string
    repeatPeriodRequired: string
    pickBothDates: string
    addDueDateFirst: string
    repeatDisabledByTriggerGoal: string
    scheduleLockedByTriggerGoal: string
    totalLockedByTrigger: string
    estimatedOccurrences: string
    totalExceedsOccurrences: (max: number) => string
    autoEstimate: string
    previewDates: string
    activityLogs: string
    contributeTo: string
    doubleClickDescription: string
    trigger: string
    triggerDisabled: string
    openTriggerSettings: string
    closeTriggerSettings: string
    triggerSaved: string
    triggerRemoved: string
    repeatSaved: string
    scheduleSaved: string
    allowCrossDay: string
    allowCrossDayHelp: string
    allowCrossDayHelpLabel: string
    crossDayDisabledByRepeat: string
    repeatRuleHelp: string
    repeatRuleHelpLabel: string
    triggerPeriod: string
    triggerPeriodPickBoth: string
    dueDisabledByTrigger: string
    repeatDisabledByTaskTrigger: string
    triggerDisabledByRepeat: string
    triggerDisabledByGoalTrigger: string
    customCompletion: string
    todayDone: string
    completionRecords: string
    colDate: string
    colStatus: string
    colActions: string
    addRow: string
    quickAddToday: string
    pointPlanned: string
    pointCompleted: string
    pointSkipped: string
  }

  // ── Settings ──
  settings: {
    title: string
    tabGeneral: string
    tabPlanner: string
    tabSync: string
    tabAi: string
    language: string
    theme: string
    themeSystem: string
    themeLight: string
    themeDark: string
    dailyCapacity: string
    dailyCapacityHelp: string
    taskForcedThreshold: string
    taskForcedThresholdHelp: string
    goalForcedThreshold: string
    goalForcedThresholdHelp: string
    maxFocusGoals: string
    maxFocusGoalsHelp: string
    aiSection: string
    aiProvider: string
    aiProviderHelp: string
    openRouterApiKey: string
    openRouterApiKeyHelp: string
    openRouterConnect: string
    openRouterModel: string
    openRouterModelHelp: string
    openRouterModelPlaceholder: string
    deepseekApiKey: string
    deepseekApiKeyHelp: string
    deepseekModel: string
    deepseekModelHelp: string
    deepseekModelPlaceholder: string
  }

  // ── OpenRouter OAuth callback page ──
  openRouterOAuth: {
    connectFailedToast: string
    exchangingTitle: string
    exchangingDescription: string
    successTitle: string
    successDescription: string
    errorTitle: string
    errorDescription: string
    done: string
    returnToApp: string
  }

  // ── Create Task Dialog ──
  createTask: {
    title: string
    taskName: string
    taskNameRequired: string
    taskNamePlaceholder: string
    descriptionOptional: string
    descriptionPlaceholder: string
    goal: string
    noGoalStandalone: string
    dueDate: string
    time: string
    invalidTime: string
    atLeast1Minute: string
    dueRequired: string
    repeatRequiresGoal: string
    noDueWithRepeat: string
    estimatedDuration: string
    repeat: string
    repeatMode: string
    interval: string
    daysOfWeek: string
    startDate: string
    endDate: string
    plannedOccurrences: string
    totalExceedsOccurrences: (max: number) => string
    daily: string
    weekly: string
    information: string
    steps: string
    addStep: string
    addStepPlaceholder: string
    schedule: string
    latestFinishTime: string
    clearDueDate: string
    dueWithinGoal: string
    dueRequiredStandalone: string
    dueOptionalGoal: string
    repeatPeriodRequired: string
    pickBothDates: string
    everyNWeeks: string
    repeatPeriod: string
    addDueDateFirst: string
    repeatDisabledByTriggerGoal: string
    scheduleLockedByTriggerGoal: string
    autoEstimate: string
    previewDates: string
    taskDependencies: string
    createTask: string
    taskCreated: string
    dueTooEarly: (date: string) => string
    dueTooLate: (date: string) => string
  }

  // ── Create Goal Dialog ──
  createGoal: {
    title: string
    goalName: string
    goalNameRequired: string
    descriptionOptional: string
    descriptionPlaceholder: string
    namePlaceholder: string
    fromTo: string
    selectBothDates: string
    endAfterStart: string
    schedule: string
    goalDue: string
    dueTimeLabel: string
    clearDue: string
    selectDate: string
    createGoal: string
    createWithTasks: string
    goalCreated: string
    settingTrigger: string
    clearDateRange: string
    openTriggerSettings: string
    closeTriggerSettings: string
    triggerModePlaceholder: string
    triggerDaily: string
    triggerWeekly: string
    triggerMonthly: string
    triggerCustom: string
    invalidTrigger: string
    triggerDateRangeUnavailable: string
    triggerRepeatEvery: string
    triggerDaysOfWeek: string
    triggerEveryNWeeks: string
    triggerDayOfMonth: string
    triggerDayOfMonthOption: (day: number) => string
    triggerMonthlyClampHint: string
    triggerCustomDates: string
    triggerSetDueLabel: string
    triggerSetDueHint: string
    clearCustomDates: string
    triggerDailyIntervalRequired: string
    triggerWeeklyDaysRequired: string
    triggerWeeklyIntervalRequired: string
    triggerMonthlyDayRequired: string
    triggerCustomDatesRequired: string
  }

  // ── Confirm Delete Dialog ──
  confirmDelete: {
    defaultTitle: string
    defaultDescription: string
  }

  // ── Change task's goal binding ──
  goalRebind: {
    label: string
    editRelationship: string
    addRelationship: string
    relationshipHint: string
    normalizeTitle: string
    normalizeDescription: string
    moved: string
    moveFailed: string
  }

  // ── Checklist Dialog ──
  checklist: {
    title: string
    description: string
    confirmDone: string
  }

  // ── Sync Dialog / Provider ──
  sync: {
    syncTooltip: {
      lastSyncAt: string
      lastSyncAtNever: string
      error: string
      authorizationFailed: string
      syncUnavailable: string
      syncing: string
    }
    title: string
    providerLabel: string
    providerPlaceholder: string
    providerHelp: string
    providerLockedHelp: string
    providerNone: string
    providerGoogleDrive: string
    providerOneDrive: string
    autoSync: string
    lastSynced: string
    neverSynced: string
    unknownTime: string
    syncNow: string
    syncingNow: string
    syncNowFailed: string
    oauthCallback: {
      connectedTitle: string
      connectedDescription: string
      done: string
      errorTitle: string
      invalidTitle: string
      invalidDescription: string
      returnToApp: string
      errors: {
        invalidOAuthState: string
        missingRefreshToken: string
        providerError: string
        oauthCallbackFailed: string
      }
    }
    googleDrive: {
      title: string
      statusDescriptions: {
        authorized: string
        authorizing: string
        refreshing: string
        unauthorized: string
      }
      buttonLabels: {
        disconnect: string
        disconnecting: string
        authorizing: string
        refreshing: string
        authorize: string
      }
      errors: {
        authorizationFailed: string
        syncUnavailable: string
      }
    }
    oneDrive: {
      title: string
      statusDescriptions: {
        authorized: string
        authorizing: string
        refreshing: string
        unauthorized: string
      }
      buttonLabels: {
        disconnect: string
        disconnecting: string
        authorizing: string
        refreshing: string
        authorize: string
      }
      errors: {
        authorizationFailed: string
        syncUnavailable: string
      }
    }
    dangerZone: {
      title: string
      description: string
      action: string
      actionInProgress: string
      confirm: (providerTitle: string) => string
      errorFailed: string
    }
  }

  // ── Context Menu / Quick Actions ──
  actions: {
    unfocus: string
    focusToday: string
    viewDetails: string
    /** aria-label for the visible "⋮" trigger of a row's context menu. */
    moreActions: string
    addToToday: string
    markInProgress: string
    markDone: string
    undoComplete: string
    moveBackToTodo: string
    runAgain: string
    undoOnce: string
    runOrdinal: (n: number) => string
    carriedOver: (dateLabel: string) => string
    runsDoneToday: (count: number) => string
    moveBackToInProgress: string
    skip: string
    excludeFromToday: string
    restoreToTodo: string
    deleteTask: string
    deleteGoal: string
  }

  // ── Activity Item ──
  activity: {
    completed: string
    added: string
    skipped: string
  }

  // ── Quota Views ──
  quota: {
    occupiedMins: (used: number, capacity: number) => string
    overLimitTooltip: (used: number, capacity: number) => string
    normalTooltip: (used: number, capacity: number) => string
    focusedCount: (focused: number, max: number) => string
    focusOverLimit: (max: number) => string
    focusWithForced: (forced: number) => string
    focusNormal: (max: number) => string
  }

  // ── Weekday labels ──
  weekdays: string[]

  // ── FlowPanel ──
  flowPanel: {
    steps: (n: number) => string
    progress: string
    estimated: string
    taskCompleted: string
    recurringTask: string
    runtimeTodo: string
    runtimeInProgress: string
    runtimeDone: string
    undo: string
  }

  // ── Duration Input ──
  durationInput: {
    placeholder: string
  }

  // ── Planner Dialog ──
  planner: {
    title: string
    taskPool: string
    allScheduled: string
    export: string
    importCalendar: string
    exportFile: string
    helpTitle: string
    help: string
    noTodoTasks: string
  }

  // ── Date Range Time Picker ──
  dateRange: {
    startDate: string
    endDate: string
    startTime: string
    endTime: string
  }

  // ── DataTable ──
  dataTable: {
    selectAll: string
    selectRow: string
    noResults: string
    rowsPerPage: string
    pageOf: (current: number, total: number) => string
  }

  // ── Tag Editor ──
  tagEditor: {
    editGoalTag: string
    preset: string
    custom: string
    tagNamePlaceholder: string
    addCustomTag: string
    clearTag: string
    tagUpdated: string
    tagUpdateFailed: string
    tagCreateFailed: string
    tagDeleted: string
    tagDeleteFailed: string
    deleteTagLabel: string
  }

  // ── Repeat Period Picker ──
  repeatPeriod: {
    notSet: string
    pickEndDate: string
  }

  // ── Steps Item ──
  stepsItem: {
    editStepTitle: string
    removeStep: string
    reorderStep: string
  }

  // ── Repeat Period Legend ──
  repeatLegend: {
    currentPeriod: string
    ancestorPeriod: string
    plannedDates: string
  }

  // ── Schedule (repeat / trigger) window validation ──
  scheduleValidation: {
    repeatPeriod: string
    triggerPeriod: string
    pickBothDates: (period: string) => string
    endOnOrAfterStart: (period: string) => string
    withinGoalDuration: (period: string) => string
    overlapsPredecessor: (
      period: string,
      title: string,
      start: string,
      end: string
    ) => string
    overlapsSuccessor: (
      period: string,
      title: string,
      start: string,
      end: string
    ) => string
    noOccurrences: string
    totalExceedsOccurrences: (max: number) => string
  }

  // ── App boot ──
  app: {
    loadError: string
  }

  // ── Forced Reason HoverCards ──
  forced: {
    manualFocus: string
    /** Focused because the goal's trigger fired at the day boundary. */
    triggerFocus: string
    autoPlanned: (count: number) => string
    goalDuePolicy: string
    taskDuePolicy: string
    manualTodayTask: string
    repeatPolicy: (plannedFor?: string) => string
    taskTriggerPolicy: (firedDate?: string) => string
    taskForced: string
    linkedGoal: string
    repeatTaskImported: (plannedFor?: string) => string
  }

  // ── AI scenario components ──
  ai: {
    // Shared error / settings copy (decompose dialog, dependency popover, toasts)
    errorNetwork: string
    errorApi: string
    goSettings: string
    noApiKey: string
    // Task decompose dialog
    decompose: {
      title: string
      subtitle: string
      goalLabel: string
      placeholder: string
      generate: string
      counting: string
      tasksLabel: string
      add: string
      taskPlaceholder: string
      deleteTask: string
      empty: string
      cancel: string
      confirm: string
    }
    // AI steps autofill button
    steps: {
      idle: string
      counting: string
      filling: string
    }
    // Dependency optimize (popover / overlay / trigger button)
    dependency: {
      title: string
      subtitle: string
      placeholder: string
      generate: string
      optimizing: string
      button: string
    }
  }

  // ── Command failure messages ──
  commands: {
    goalCreateFailed: string
    goalUpdateFailed: string
    goalDeleteFailed: string
    taskCreateFailed: string
    taskUpdateFailed: string
    taskDeleteFailed: string
    dependencyUpdateFailed: string
  }
}
