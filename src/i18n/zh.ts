import type { Dictionary } from "./types"

export const zh: Dictionary = {
  // ── 通用 ──
  common: {
    save: "保存",
    cancel: "取消",
    delete: "删除",
    confirm: "确认",
    continue: "继续",
    loading: "加载中…",
    noGoal: "无目标",
    mins: "分钟",
    due: "截止:",
    steps: (n) => `${n} 个步骤`,
    standalone: "独立任务",
    triggerHelpTooltipLabel: "触发器工作原理说明",
    triggerHelpTooltip:
      "触发时自动重置进度并重新拉起目标，适合当天能完成的目标。",
  },

  // ── 导航 ──
  nav: {
    home: "首页",
    myGoals: "我的目标",
    myTasks: "我的任务",
    allTasks: "全部任务",
    goals: "目标",
    tasks: "任务",
  },

  // ── 侧边栏底部菜单 ──
  sidebar: {
    more: "更多",
    help: "帮助",
    about: "关于",
  },

  // ── 文档站侧边栏 ──
  doc: {
    groups: {
      concepts: "概念",
      guides: "使用指南",
    },
    concepts: {
      core: "核心概念",
      estimatedOccurrences: "预计次数",
      trigger: "触发器",
      repeatRule: "重复规则",
      repeatRuleVsTrigger: "重复规则 vs 触发器",
      dailyFocus: "每日聚焦",
    },
    guides: {
      quickStart: "快速上手",
      setTrigger: "设置触发器",
      setRepeatRule: "设置重复规则",
      syncSetup: "同步设置",
      aiEstimationSetup: "AI 设置",
    },
    home: "主页",
    onThisPage: "本页内容",
  },

  // ── 状态标签 ──
  status: {
    todo: "待办",
    inProgress: "进行中",
    done: "已完成",
    notScheduled: "未安排",
    completed: "已完成",
    incomplete: "未完成",
    focused: "已聚焦",
    unfocused: "未聚焦",
    dismissedToday: "已移出今天",
  },
  dueBadge: {
    prefix: "截止",
    overdue: "已逾期",
    today: "今天截止",
    tomorrow: "明天截止",
    inDays: (n) => `${n} 天后`,
  },
  runtimeSource: {
    duePolicy: "由截止策略拉入今天",
    goalDuePolicy: "由目标截止策略拉入今天",
    repeatPolicy: "由重复规则拉入今天",
    triggerPolicy: "由触发器拉入今天",
    manual: "手动添加到今天",
    default: "由调度器自动安排",
  },

  // ── 首页 ──
  home: {
    greetingMorning: "早上好！",
    greetingAfternoon: "下午好！",
    greetingEvening: "晚上好！",
    greetingNight: "夜深了！",
    todaysTasks: "今日任务",
    todaysFocus: "今日聚焦",
    planningPressure: "规划压力",
    pressureLow: "少",
    pressureHigh: "多",
    pressureTooltip: (count, minutes) =>
      `${count} 项规划${minutes ? ` · ${minutes} 分钟` : ""}`,
    pressureReasonRepeat: "重复",
    pressureReasonTaskTrigger: "任务触发",
    pressureReasonGoalTrigger: "目标触发",
    pressureNoGoal: "未关联目标",
    pressurePullupTitle: "规划",
    pressureDueTitle: "截止",
    pressureDueTask: "任务",
    pressureDueGoal: "目标",
    pressureDueSummary: (dueCount) => `${dueCount} 项截止`,
    recentActivities: "最近活动",
    addTask: "添加任务",
    replanToday: "刷新今日计划",
    newGoal: "新建目标",
    focusAllTasksDismissed: "该目标的任务今天都已移出，没有可聚焦的内容。",
    taskMarkedDone: (title) => `“${title}” 已标记为完成`,
    noRecentActivities: "暂无最近活动",
  },

  // ── 任务页面 ──
  tasks: {
    today: "今天",
    plans: "计划",
    unscheduled: "未安排",
    tomorrow: "明天",
    in7Days: "7 天内",
    skipped: "已跳过",
    addTask: "添加任务",
    noTasksFound: "未找到任务。",
    todoCount: (n) => `待办 (${n})`,
    inProgressCount: (n) => `进行中 (${n})`,
    doneCount: (n) => `已完成 (${n})`,
    tomorrowCount: (n) => `明天 (${n})`,
    in7DaysCount: (n) => `7 天内 (${n})`,
    skippedCount: (n) => `已跳过 (${n})`,
    unscheduledCount: (n) => `未安排 (${n})`,
    planOn: (dateLabel) => `计划于 ${dateLabel}`,
    skippedPlan: (dateLabel) => `已跳过 ${dateLabel}`,
    skippedTimes: (n) => `已跳过 ${n} 次`,
    taskSkipped: "任务已跳过今天的执行",
    restoreInPlans: "在计划中恢复",
    byTriggerCount: (n) => `触发拉起 (${n})`,
    pulledByGoalTrigger: "由其目标触发器拉起的",
    alsoTriggersOn: "也会于下列时间触发",
    pullUpLabel: (date) => `拉起：${date}`,
  },

  // ── 多次拉起任务的执行列表 ──
  taskRuns: {
    title: "检测到多个任务项",
    description:
      "该任务在今日列表中存在多条（通常来自手动再次拉起，或重复规则带来的未完成项）。",
    openLabel: (count: number) => `多个规划任务拉起 (${count})`,
    columnRun: "任务项",
    columnStatus: "状态",
    remove: "移除这一项",
  },

  // ── 重复任务债务提示 ──
  repeatDebt: {
    triggerLabel: "说明这个重复项为什么出现",
    title: "为什么会看到这个重复项？",
    description:
      "这个项目来自未完成的重复计划。它被带到今天，是为了提醒你处理之前留下的任务债务。",
    originalPlanLabel: "该任务原定计划于",
    markDone: "补打卡",
    ignoreOne: "永久忽略这一项",
    ignored: "已忽略这一项债务",
  },

  // ── 拉起说明 popover ──
  pullUpInfo: {
    label: "拉起说明",
    repeatTitle: "重复拉起",
    triggerTitle: "触发器拉起",
    goalTriggerTitle: "由目标触发器拉起",
    repeatDescription: "该任务按重复规则自动安排,以下为其拉起节奏与计划日期。",
    triggerDescription:
      "该任务由触发器按规则在有效期内自动拉起,而非固定截止日期。",
    goalTriggerDescription:
      "该任务所属目标启用了触发器,目标被拉起时会一并拉起此任务。",
    ruleLabel: "规则",
    nextLabel: "下次",
    windowLabel: "有效期",
    cadenceDaily: "每天",
    cadenceEveryNDays: (n) => `每 ${n} 天`,
    cadenceWeekly: (days) => `每周 ${days}`,
    cadenceEveryNWeeks: (n, days) => `每 ${n} 周 ${days}`,
    cadenceMonthly: (day) => `每月 ${day} 号`,
    cadenceCustom: "指定日期",
  },

  // ── 我的目标页面 ──
  myGoals: {
    title: "我的目标",
    inProgress: "进行中",
    done: "已完成",
    noGoalsInProgress: "暂无进行中的目标，创建一个吧！",
    noGoalsDone: "暂无已完成的目标，继续加油！",
    newGoal: "新建目标",
    select: "选择",
    deleteCount: (count) => `删除 (${count})`,
    deleteGoalsTitle: (count) => `删除 ${count} 个目标？`,
    deleteGoalsDescription: "此操作将永久删除所选目标及所有关联数据。",
  },

  // ── 全部任务页面 ──
  allTasks: {
    title: "全部任务",
    searchPlaceholder: "搜索任务...",
    allGoals: "全部目标",
    allStatuses: "全部状态",
    allCompletion: "全部完成度",
    completedOnly: "已完成",
    incompleteOnly: "未完成",
    columnTitle: "标题",
    columnGoal: "目标",
    columnStatus: "状态",
    columnCompletion: "完成度",
    columnDueDate: "截止日期",
    columnDuration: "时长",
    viewDetails: "查看详情",
    deleteCount: (count) => `删除 (${count})`,
    deleteTasksTitle: (count) => `删除 ${count} 个任务？`,
    deleteTasksDescription: "此操作将永久删除所选任务及所有关联数据。",
    minLabel: "分钟",
  },

  // ── 目标详情页 ──
  goalDetail: {
    details: "详情",
    tasks: "任务",
    notes: "笔记",
    duration: "时长",
    goalProgress: "目标进度",
    activityLogs: "活动日志",
    createdByGoal: "由此目标创建",
    taskDependencyTree: "任务依赖树",
    tasksList: "任务列表",
    addTasks: "添加任务",
    aiAddTasks: "AI 批量拆任务",
    taskFilter: "任务筛选",
    addTag: "添加标签",
    notesPlaceholder: "在这里记录！",
    noActivity: "暂无活动。",
    noTasks: "该目标下暂无任务。",
    noDependencyGraph: "暂无依赖图。从此目标创建任务以初始化关系。",
    deleteGoalTitle: "删除目标？",
    deleteGoalDescription: "此操作将永久删除该目标及所有关联数据。",
    deleteTaskTitle: "删除任务？",
    deleteTaskDescription: "此操作将永久删除该任务及所有关联数据。",
    durationUpdated: "时长已更新",
    durationDisabledByTrigger: "该目标启用触发器时，起止时间不可设置。",
    trigger: "触发器",
    triggerDisabled: "未配置触发器。",
    triggerMissingRule: "目标已启用触发器，但缺少触发规则。",
    openTriggerSettings: "打开触发器设置",
    closeTriggerSettings: "关闭触发器设置",
    triggerSaved: "触发器已保存",
    triggerRemoved: "触发器已移除",
    triggerOverwriteTitle: "覆盖任务设置？",
    triggerOverwriteDescription:
      "该目标下有任务的预计次数不为 1，或设置了重复 / 触发规则。启用触发器会将这些任务重置为单次任务，并删除其重复规划点和触发规则。是否继续？",
    notesSaved: "笔记已保存",
    goalNotFound: "目标未找到",
    doubleClickDescription: "双击添加描述。",
    tasksCompleted: "个任务已完成",
    totalTimeSpent: "总花费时间",
  },

  // ── 任务详情页 ──
  taskDetail: {
    notSet: "（未设置）",
    durationUpdated: "时长已更新",
    stepAdded: "步骤已添加",
    notesSaved: "笔记已保存",
    taskNotFound: "任务未找到",
    noRecentActivities: "暂无最近活动",
    deleteTaskTitle: "删除任务？",
    deleteTaskDescription: "此操作将永久删除该任务及所有关联数据。",
    notes: "笔记",
    notesPlaceholder: "在这里记录！",
    steps: "步骤",
    addStepPlaceholder: "添加步骤...",
    relationships: "关联关系",
    noDependencyGraph: "暂无依赖图。此任务未关联目标。",
    schedule: "排期",
    due: "截止日期",
    latestFinishTime: "最晚完成时间",
    dueDateUpdated: "截止日期已更新",
    dueDateCleared: "截止日期已清除",
    estimatedDuration: "预计时长",
    repeat: "重复",
    daily: "每天",
    weekly: "每周",
    everyNDays: "每 N 天",
    daysOfWeek: "星期",
    everyNWeeks: "每 N 周",
    repeatPeriodRequired: "重复周期为必填。",
    pickBothDates: "请选择重复周期的开始和结束日期。",
    addDueDateFirst: "请先为目标设置截止日期，再配置重复周期或预览日期。",
    repeatDisabledByTriggerGoal:
      "该目标启用了触发器，因此其中的任务只能是单次任务。",
    scheduleLockedByTriggerGoal:
      "该目标已启用触发器，任务排期由触发器决定，且只能是单次任务。",
    totalLockedByTrigger: "触发器任务是单次任务，预计次数固定为 1。",
    estimatedOccurrences: "预计次数",
    totalExceedsOccurrences: (max: number) =>
      `完成次数不能超过窗口内可执行的 ${max} 次。`,
    autoEstimate: "自动估算",
    previewDates: "预览日期",
    activityLogs: "活动日志",
    contributeTo: "贡献于",
    doubleClickDescription: "双击添加描述。",
    trigger: "触发器",
    triggerDisabled: "未配置触发器。",
    openTriggerSettings: "打开触发器设置",
    closeTriggerSettings: "关闭触发器设置",
    triggerSaved: "触发器已保存",
    triggerRemoved: "触发器已移除",
    repeatSaved: "重复规则已保存",
    scheduleSaved: "排期已保存",
    allowCrossDay: "允许跨天",
    allowCrossDayHelp:
      "启用后，处于“进行中”的任务会在跨天时保留，而不会被清空（触发器任务也不会重复拉起）。",
    allowCrossDayHelpLabel: "允许跨天说明",
    crossDayDisabledByRepeat: "重复任务的拉起日期已固定，不支持跨天。",
    repeatRuleHelp: "按固定节奏（每隔几天 / 每周指定日）在有效期内自动安排。",
    repeatRuleHelpLabel: "重复规则说明",
    triggerPeriod: "触发器有效期",
    triggerPeriodPickBoth: "请选择触发器有效期的开始和结束日期。",
    dueDisabledByTrigger: "该任务启用了触发器，截止时间不可用。",
    repeatDisabledByTaskTrigger: "该任务启用了触发器，无法使用重复规则设置。",
    triggerDisabledByRepeat: "该任务启用了重复规则，无法使用触发器设置。",
    triggerDisabledByGoalTrigger: "该任务所属的目标已启用触发器。",
    customCompletion: "自定义完成情况…",
    todayDone: "今日完成",
    completionRecords: "完成记录",
    colDate: "日期",
    colStatus: "状态",
    colActions: "操作",
    addRow: "添加行",
    quickAddToday: "快捷添加当日",
    pointPlanned: "待完成",
    pointCompleted: "已完成",
    pointSkipped: "已跳过",
  },

  // ── 设置 ──
  settings: {
    title: "设置",
    tabGeneral: "通用",
    tabPlanner: "规划",
    tabSync: "同步",
    tabAi: "AI",
    language: "语言",
    theme: "主题",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色",
    dailyCapacity: "每日调度容量",
    dailyCapacityHelp:
      "调度器在停止自动计划额外任务之前，可以分配到今天的总分钟数。",
    taskForcedThreshold: "任务强制今日阈值（天）",
    taskForcedThresholdHelp:
      "截止日期在该天数内的任务将自动添加到今天且不可移除。设为 0 表示仅当天截止，设为 1 表示今天或明天截止，以此类推。",
    goalForcedThreshold: "目标强制聚焦阈值（天）",
    goalForcedThresholdHelp:
      "截止日期在该天数内的目标将自动聚焦且不可取消聚焦。语义同上。",
    maxFocusGoals: "每日自动聚焦目标数",
    maxFocusGoalsHelp:
      "规划时自动选择多少个目标进入今日聚焦(按完成度最低优先),并把今天的任务铺开到这些目标上。被规则强制聚焦的目标计入此数。你随时可以手动聚焦更多——此设置只决定自动选择的数量,不限制手动聚焦。",
    aiSection: "AI 配置",
    aiProvider: "AI 服务商",
    aiProviderHelp: "选择 AI 服务商。不同服务商需要各自的 API 密钥。",
    openRouterApiKey: "OpenRouter API 密钥",
    openRouterApiKeyHelp:
      "从 openrouter.ai 获取 API 密钥。密钥仅存储在浏览器本地。",
    openRouterConnect: "从 OpenRouter 获取",
    openRouterModel: "模型",
    openRouterModelHelp: "OpenRouter 模型标识，如 openai/gpt-4o-mini。",
    openRouterModelPlaceholder: "openai/gpt-4o-mini",
    deepseekApiKey: "DeepSeek API 密钥",
    deepseekApiKeyHelp:
      "从 platform.deepseek.com 获取 API 密钥。密钥仅存储在浏览器本地。",
    deepseekModel: "模型",
    deepseekModelHelp: "DeepSeek 模型标识，如 deepseek-v4-flash。",
    deepseekModelPlaceholder: "deepseek-v4-flash",
  },

  // ── OpenRouter OAuth 回调页 ──
  openRouterOAuth: {
    connectFailedToast: "连接 OpenRouter 失败，请重试。",
    exchangingTitle: "正在连接 OpenRouter…",
    exchangingDescription: "正在用授权码换取 API 密钥。",
    successTitle: "OpenRouter 已连接",
    successDescription: "API 密钥已生成并保存到 AI 设置。",
    errorTitle: "OpenRouter 授权失败",
    errorDescription: "未能用授权码换取 API 密钥，请回到设置重试。",
    done: "完成",
    returnToApp: "返回应用",
  },

  // ── 创建任务对话框 ──
  createTask: {
    title: "创建任务",
    taskName: "任务名称",
    taskNameRequired: "请输入任务名称。",
    taskNamePlaceholder: "需要做什么？",
    descriptionOptional: "描述",
    descriptionPlaceholder: "添加更多细节...",
    goal: "关联目标",
    noGoalStandalone: "无目标（独立任务）",
    dueDate: "截止日期",
    time: "最晚完成时间",
    invalidTime: "无效时间。",
    atLeast1Minute: "至少 1 分钟。",
    dueRequired: "独立任务必须设置截止日期。",
    repeatRequiresGoal: "重复任务需要关联目标。",
    noDueWithRepeat: "启用重复时不可设置截止日期。",
    estimatedDuration: "预计时长",
    repeat: "重复",
    repeatMode: "重复模式",
    interval: "每 N 天",
    daysOfWeek: "星期",
    startDate: "开始日期",
    endDate: "结束日期",
    plannedOccurrences: "预计次数",
    totalExceedsOccurrences: (max: number) =>
      `完成次数不能超过窗口内可执行的 ${max} 次。`,
    daily: "每天",
    weekly: "每周",
    information: "信息",
    steps: "步骤",
    addStep: "添加步骤",
    addStepPlaceholder: "添加步骤...",
    schedule: "排期",
    latestFinishTime: "最晚完成时间",
    clearDueDate: "清除截止日期",
    dueWithinGoal: "任务截止日期须在所选目标周期内。",
    dueRequiredStandalone: "独立任务必填。默认：今天 23:59。",
    dueOptionalGoal: "目标任务可选。",
    repeatPeriodRequired: "重复周期为必填。",
    pickBothDates: "请选择重复周期的开始和结束日期。",
    everyNWeeks: "每 N 周",
    repeatPeriod: "重复周期（必填）",
    addDueDateFirst: "请先为目标设置截止日期，再配置重复周期或预览日期。",
    repeatDisabledByTriggerGoal:
      "该目标启用了触发器，因此其中的任务只能是单次任务。",
    scheduleLockedByTriggerGoal:
      "该目标已启用触发器，任务排期由触发器决定，且只能是单次任务。",
    autoEstimate: "自动估算",
    previewDates: "预览日期",
    taskDependencies: "任务依赖",
    createTask: "创建任务",
    taskCreated: "任务已创建",
    dueTooEarly: (date) => `任务截止日期不能早于 ${date}。`,
    dueTooLate: (date) => `任务截止日期不能晚于 ${date}。`,
  },

  // ── 创建目标对话框 ──
  createGoal: {
    title: "创建目标",
    goalName: "目标名称",
    goalNameRequired: "请输入目标名称。",
    descriptionOptional: "描述（可选）",
    descriptionPlaceholder: "描述你的目标。",
    namePlaceholder: "名称",
    fromTo: "起止时间",
    selectBothDates: "请选择开始和结束日期。",
    endAfterStart: "结束时间必须晚于开始时间。",
    schedule: "日程",
    goalDue: "截止日期(可选)",
    dueTimeLabel: "截止时间",
    clearDue: "清除截止日期",
    selectDate: "选择日期",
    createGoal: "创建目标",
    createWithTasks: "创建并拆任务",
    goalCreated: "目标已创建",
    settingTrigger: "触发器",
    clearDateRange: "清除日期范围",
    openTriggerSettings: "打开触发器设置",
    closeTriggerSettings: "关闭触发器设置",
    triggerModePlaceholder: "选择触发模式",
    triggerDaily: "每天",
    triggerWeekly: "每周",
    triggerMonthly: "每月",
    triggerCustom: "自定义",
    invalidTrigger: "触发器设置无效。",
    triggerDateRangeUnavailable: "触发型目标不能使用固定日期范围。",
    triggerRepeatEvery: "重复间隔",
    triggerDaysOfWeek: "星期",
    triggerEveryNWeeks: "每 N 周",
    triggerDayOfMonth: "每月几号",
    triggerDayOfMonthOption: (day) => `${day} 号`,
    triggerMonthlyClampHint: "当月天数不足时，将在当月最后一天触发。",
    triggerCustomDates: "自定义日期",
    triggerSetDueLabel: "重置时设置截止时间",
    triggerSetDueHint:
      "每轮的截止时间为下次触发前一天的 23:59——每天触发即当晚到期。",
    clearCustomDates: "清除",
    triggerDailyIntervalRequired: "请为每日触发填写有效的重复间隔。",
    triggerWeeklyDaysRequired: "请至少选择一个每周触发的星期。",
    triggerWeeklyIntervalRequired: "请为每周触发填写有效的重复间隔。",
    triggerMonthlyDayRequired: "请为每月触发选择 1–31 之间的日期。",
    triggerCustomDatesRequired: "请至少选择一个自定义触发日期。",
  },

  // ── 确认删除对话框 ──
  confirmDelete: {
    defaultTitle: "确定要删除吗？",
    defaultDescription: "此操作不可撤销。",
  },

  // ── 修改任务绑定的目标 ──
  goalRebind: {
    label: "目标",
    editRelationship: "修改所属目标",
    addRelationship: "添加所属目标",
    relationshipHint: "选择该任务所属的目标，或将其设为独立任务。",
    normalizeTitle: "重置任务设置？",
    normalizeDescription:
      "该目标无法容纳重复或触发类任务。继续将把任务重置为单次执行，并清除其重复规则和触发器。",
    moved: "任务已移动。",
    moveFailed: "移动任务失败。",
  },

  // ── 清单对话框 ──
  checklist: {
    title: "清单",
    description: "在标记完成前确认每个步骤已完成",
    confirmDone: "确认完成",
  },

  // ── 同步 ──
  sync: {
    title: "同步",
    providerLabel: "同步提供方",
    providerPlaceholder: "选择同步提供方",
    providerHelp: "选择受支持的云同步服务。",
    providerLockedHelp: "当前同步提供方已绑定，请先解绑后再切换。",
    providerNone: "无",
    providerGoogleDrive: "Google Drive",
    providerOneDrive: "OneDrive",
    autoSync: "自动同步",
    lastSynced: "上次同步",
    neverSynced: "从未同步",
    unknownTime: "时间未知",
    syncNow: "立即同步",
    syncingNow: "同步中...",
    syncNowFailed: "同步失败，请稍后重试。",
    oauthCallback: {
      connectedTitle: "已连接",
      connectedDescription: "此设备已连接,可以开始同步。你可以返回应用。",
      done: "完成",
      errorTitle: "授权失败",
      invalidTitle: "授权结果无效",
      invalidDescription: "没有收到可处理的授权结果，请从应用内重新开始授权。",
      returnToApp: "返回应用",
      errors: {
        invalidOAuthState: "授权状态无效，请重新开始授权。",
        missingRefreshToken:
          "服务商没有返回可复用凭证，请重新授权并允许离线访问。",
        providerError: "服务商未能完成授权，请稍后重试。",
        oauthCallbackFailed: "授权未能完成，请稍后重试。",
      },
    },
    googleDrive: {
      title: "Google Drive",
      statusDescriptions: {
        authorized: "Google Drive 已绑定，可用于同步数据。",
        authorizing: "请在弹出的 Google 授权窗口中完成授权。",
        refreshing: "正在刷新 Google Drive 授权状态。",
        unauthorized: "授权后会使用 Google Drive App Data 目录保存同步数据。",
      },
      buttonLabels: {
        disconnect: "解除绑定",
        disconnecting: "解除绑定中...",
        authorizing: "授权中...",
        refreshing: "连接中...",
        authorize: "授权 Google Drive",
      },
      errors: {
        authorizationFailed: "Google Drive 授权失败，请重新授权。",
        syncUnavailable: "Google Drive 同步暂时不可用，请稍后重试。",
      },
    },
    oneDrive: {
      title: "OneDrive",
      statusDescriptions: {
        authorized: "OneDrive 已绑定，可用于同步数据。",
        authorizing: "请在弹出的 OneDrive 授权窗口中完成授权。",
        refreshing: "正在刷新 OneDrive 授权状态。",
        unauthorized: "授权后会使用 OneDrive 应用专属目录保存同步数据。",
      },
      buttonLabels: {
        disconnect: "解除绑定",
        disconnecting: "解除绑定中...",
        authorizing: "授权中...",
        refreshing: "连接中...",
        authorize: "授权 OneDrive",
      },
      errors: {
        authorizationFailed: "OneDrive 授权失败，请重新授权。",
        syncUnavailable: "OneDrive 同步暂时不可用，请稍后重试。",
      },
    },
    dangerZone: {
      title: "敏感操作",
      description:
        "吊销此设备在服务商侧的授权,并永久删除所有设备的云端数据备份。此操作不可恢复。",
      action: "删除授权并清空云端备份",
      actionInProgress: "删除中...",
      confirm: (providerTitle: string) =>
        `这会永久删除 ${providerTitle} 账号中所有设备的云端数据备份,并吊销此设备的授权。此操作不可恢复,确定继续吗？`,
      errorFailed: "清空云端备份失败，请稍后重试。",
    },
    syncTooltip: {
      lastSyncAt: "最近同步于",
      lastSyncAtNever: "尚未同步",
      error: "最近同步失败",
      authorizationFailed: "授权失败，请重新连接",
      syncUnavailable: "同步服务暂时不可用",
      syncing: "同步中...",
    },
  },

  // ── 右键菜单 / 快捷操作 ──
  actions: {
    unfocus: "取消聚焦",
    focusToday: "今日聚焦",
    viewDetails: "查看详情",
    moreActions: "更多操作",
    addToToday: "添加到今天",
    markInProgress: "标记为进行中",
    markDone: "标记为完成",
    undoComplete: "撤销完成",
    moveBackToTodo: "退回待办",
    runAgain: "再做一次",
    undoOnce: "撤销一次完成",
    runOrdinal: (n: number) => `第 ${n} 项`,
    carriedOver: (dateLabel: string) => `始于 ${dateLabel}`,
    runsDoneToday: (count: number) => `已完成 ${count} 次`,
    moveBackToInProgress: "退回进行中",
    skip: "跳过",
    excludeFromToday: "从今天移除",
    restoreToTodo: "恢复为待办",
    deleteTask: "删除任务",
    deleteGoal: "删除目标",
  },

  // ── 活动条目 ──
  activity: {
    completed: "已完成",
    added: "已添加",
    skipped: "已跳过",
  },

  // ── 配额视图 ──
  quota: {
    occupiedMins: (used, capacity) => `已安排 ${used}/${capacity} 分钟`,
    overLimitTooltip: (used, capacity) =>
      `今日安排的任务共 ${used} 分钟（含已完成），超出每日阈值 ${capacity} 分钟。计划器将不再自动添加更多任务，直到释放容量。`,
    normalTooltip: (used, capacity) =>
      `今日安排的任务（含已完成）共 ${used} 分钟，每日可调度 ${capacity} 分钟。`,
    focusedCount: (focused, max) => `已聚焦 ${focused}/${max}`,
    focusOverLimit: (max) =>
      `手动聚焦已超过自动选择的 ${max} 个目标。没关系——所有已聚焦目标都会被排程,规划只是不再自动补充更多。`,
    focusWithForced: (forced) => `其中 ${forced} 个是被规则自动聚焦的。`,
    focusNormal: (max) =>
      `规划会自动选择至多 ${max} 个目标进入今日聚焦。你可以随时手动聚焦更多。`,
  },

  // ── 星期标签 ──
  weekdays: ["日", "一", "二", "三", "四", "五", "六"],

  // ── 流程面板 ──
  flowPanel: {
    steps: (n) => `${n} 个步骤`,
    progress: "进度:",
    estimated: "预计:",
    taskCompleted: "任务已全部完成",
    recurringTask: "重复任务",
    runtimeTodo: "今日待办",
    runtimeInProgress: "今日进行中",
    runtimeDone: "今日已完成",
    undo: "撤销",
  },

  // ── 时长输入 ──
  durationInput: {
    placeholder: "例如 30m",
  },

  // ── 日程规划 ──
  planner: {
    title: "日程规划",
    taskPool: "未排程",
    allScheduled: "所有任务已排程",
    export: "导出",
    importCalendar: "导入日历 App",
    exportFile: "导出 .ics 文件",
    helpTitle: "使用说明",
    help: "点击或拖拽空白轨道新建时间块；右键时间块删除；滚轮上下浏览任务；按住 Ctrl/⌘ 滚轮调整时间尺度。",
    noTodoTasks: "暂无待办任务",
  },

  // ── 日期范围时间选择器 ──
  dateRange: {
    startDate: "开始日期",
    endDate: "结束日期",
    startTime: "开始时间",
    endTime: "结束时间",
  },

  // ── 数据表格 ──
  dataTable: {
    selectAll: "全选",
    selectRow: "选择行",
    noResults: "未找到任务。",
    rowsPerPage: "每页行数",
    pageOf: (current, total) => `第 ${current} 页，共 ${total} 页`,
  },

  // ── 标签编辑器 ──
  tagEditor: {
    editGoalTag: "编辑目标标签",
    preset: "预设",
    custom: "自定义",
    tagNamePlaceholder: "标签名称",
    addCustomTag: "添加自定义标签",
    clearTag: "清除标签",
    tagUpdated: "标签已更新。",
    tagUpdateFailed: "更新标签失败。",
    tagCreateFailed: "创建标签失败。",
    tagDeleted: "标签已删除。",
    tagDeleteFailed: "删除标签失败。",
    deleteTagLabel: "删除标签",
  },

  // ── 重复周期选择器 ──
  repeatPeriod: {
    notSet: "（未设置）",
    pickEndDate: "选择结束日期",
  },

  // ── 步骤条目 ──
  stepsItem: {
    editStepTitle: "编辑步骤标题",
    removeStep: "移除步骤",
    reorderStep: "拖动以排序",
  },
  // ── 重复周期图例 ──
  repeatLegend: {
    currentPeriod: "当前重复周期",
    ancestorPeriod: "依赖链任务周期",
    plannedDates: "计划日期",
  },

  // ── 计划（重复 / 触发）时间窗校验 ──
  scheduleValidation: {
    repeatPeriod: "重复周期",
    triggerPeriod: "触发周期",
    pickBothDates: (period) => `请为${period}选择开始和结束日期。`,
    endOnOrAfterStart: (period) => `${period}的结束日期必须不早于开始日期。`,
    withinGoalDuration: (period) => `${period}必须处于所选目标的时间范围内。`,
    overlapsPredecessor: (period, title, start, end) =>
      `${period}与前置任务“${title}”（${start} – ${end}）的时间范围重叠。`,
    overlapsSuccessor: (period, title, start, end) =>
      `${period}与后置任务“${title}”（${start} – ${end}）的时间范围重叠。`,
    noOccurrences:
      "重复周期内没有任何可安排的日期，请调整日期范围或至少选择一个星期。",
    totalExceedsOccurrences: (max) =>
      `完成次数不能超过重复窗口内计划的 ${max} 次。`,
  },

  // ── 应用启动 ──
  app: {
    loadError: "加载数据失败：",
  },

  // ── 强制原因悬停卡 ──
  forced: {
    manualFocus: "当前为手动聚焦。",
    triggerFocus:
      "由触发器在今天拉起。你仍可取消聚焦，取消后当天不会再被自动拉回，直到触发器下次触发。",
    autoPlanned: (count) =>
      `由于调度器添加了 ${count} 个自动计划的今日项目，该目标已被聚焦。`,
    goalDuePolicy:
      "是该目标的截止时间，已进入强制聚焦策略窗口，因此被强制聚焦。",
    taskDuePolicy: "是该任务的截止时间，因截止策略被强制加入今天。",
    manualTodayTask: "被手动添加到今天。移除后才能取消聚焦。",
    repeatPolicy: (plannedFor) =>
      `被重复策略导入今天${plannedFor ? `（计划于 ${plannedFor}）` : ""}。在"我的任务"中跳过该任务以解锁此目标。`,
    taskTriggerPolicy: (firedDate) =>
      `因触发器被拉入今天${firedDate ? `（触发于 ${firedDate}）` : ""}。完成或跳过该任务以解锁此目标。`,
    taskForced: "是该任务的截止时间，已进入强制今日策略窗口。",
    linkedGoal: "关联目标：",
    repeatTaskImported: (plannedFor) =>
      `被重复策略导入${plannedFor ? `（计划于 ${plannedFor}）` : ""}。使用"跳过"将其从今天移除。`,
  },

  // ── AI 场景组件 ──
  ai: {
    errorNetwork: "网络连接失败,请检查网络后重试。",
    errorApi: "AI 服务返回错误,请检查 AI 辅助设置。",
    goSettings: "前往 AI 设置",
    noApiKey: "请先配置 AI 服务",
    decompose: {
      title: "AI 拆分任务",
      subtitle:
        "勾选要重新生成的任务,空 badge 会自动填充;没有任务时 AI 先定数量再补全。",
      goalLabel: "目标",
      placeholder: "补充描述这个目标要做什么…(可选)",
      generate: "生成",
      counting: "正在确定任务数量…",
      tasksLabel: "任务",
      add: "添加任务",
      taskPlaceholder: "任务名称",
      deleteTask: "删除该任务",
      empty: "点击「生成」让 AI 拆分,或用 + 手动添加任务",
      cancel: "取消",
      confirm: "确认",
    },
    steps: { idle: "AI 补全", counting: "确定数量…", filling: "补全中…" },
    dependency: {
      title: "AI 优化依赖",
      subtitle: "只调整已有任务之间的依赖,不会新增或删除任务。",
      placeholder: "补充你的调整意见…(可选)",
      generate: "优化",
      optimizing: "正在优化依赖…",
      button: "AI 优化依赖",
    },
  },

  commands: {
    goalCreateFailed: "创建目标失败。",
    goalUpdateFailed: "更新目标失败。",
    goalDeleteFailed: "删除目标失败。",
    taskCreateFailed: "创建任务失败。",
    taskUpdateFailed: "更新任务失败。",
    taskDeleteFailed: "删除任务失败。",
    dependencyUpdateFailed: "更新依赖关系失败。",
  },
}
