type ActivityProgressOptions = {
  activeTabId?: string | null
  activityTabIndex?: Record<string, string>
  fallbackTabId?: string
}

const DEFAULT_TAB_ID = 'tab-1'

function getCourseTabs(course: any) {
  const rawTabs = course?.tabMetadata ?? course?.tab_metadata
  if (!Array.isArray(rawTabs)) {
    return []
  }

  return rawTabs
    .map((tab: any, index: number) => {
      const id =
        tab?.id ??
        tab?.tab_uuid ??
        tab?.tabUuid ??
        tab?.tabUUID ??
        `tab-${index + 1}`
      const position =
        typeof tab?.position === 'number' ? tab.position : index
      return { id, position }
    })
    .filter((tab: { id: unknown }) => typeof tab.id === 'string')
    .sort(
      (a: { position: number }, b: { position: number }) =>
        (a.position ?? 0) - (b.position ?? 0),
    )
}

export function getCourseFallbackTabId(course: any): string {
  const tabs = getCourseTabs(course)
  return (
    tabs[0]?.id ??
    course?.tabStoreDefaultId ??
    DEFAULT_TAB_ID
  )
}

export function resolveChapterTabId(
  chapter: any,
  course: any,
  fallbackTabId?: string,
): string {
  const fallback = fallbackTabId ?? getCourseFallbackTabId(course)
  const chapterTab =
    chapter?.tab_uuid ??
    chapter?.tabUuid ??
    chapter?.tabUUID
  if (typeof chapterTab === 'string' && chapterTab.length > 0) {
    return chapterTab
  }
  return fallback
}

export function isDynamicActivity(activity: any): boolean {
  return (
    activity?.activity_type === 'TYPE_DYNAMIC' ||
    activity?.activity_sub_type === 'SUBTYPE_DYNAMIC_PAGE'
  )
}

function normalizeActivityUuid(raw: any): string | null {
  if (raw === null || raw === undefined) {
    return null
  }
  const value = String(raw)
  if (!value.length) {
    return null
  }
  return value.startsWith('activity_') ? value : `activity_${value}`
}

function extractActivityUuid(candidate: any): string | null {
  if (candidate === null || candidate === undefined) {
    return null
  }
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return normalizeActivityUuid(candidate)
  }
  if (typeof candidate !== 'object') {
    return null
  }
  const direct =
    candidate.activity_uuid ??
    candidate.activityUuid ??
    candidate.activityUUID ??
    candidate.uuid ??
    candidate.id
  if (direct !== undefined) {
    return normalizeActivityUuid(direct)
  }
  if (candidate.activity) {
    return extractActivityUuid(candidate.activity)
  }
  if (candidate.step) {
    return extractActivityUuid(candidate.step)
  }
  return null
}

function extractCompletionState(candidate: any): boolean | undefined {
  if (candidate === null || candidate === undefined) {
    return undefined
  }
  if (typeof candidate === 'boolean') {
    return candidate
  }
  if (typeof candidate === 'object') {
    const completionKeys = [
      'complete',
      'completed',
      'done',
      'is_complete',
      'isComplete',
    ]
    for (const key of completionKeys) {
      if (typeof candidate[key] === 'boolean') {
        return candidate[key]
      }
    }
    const statusKeys = ['status', 'state', 'progress']
    for (const key of statusKeys) {
      const statusValue = candidate[key]
      if (typeof statusValue === 'string') {
        const normalized = statusValue.toLowerCase()
        if (
          [
            'complete',
            'completed',
            'done',
            'finished',
            'success',
            'approved',
          ].includes(normalized)
        ) {
          return true
        }
      }
    }
  }
  return undefined
}

export type ActivityVerificationStatus = 'NONE' | 'CORRECT' | 'INCORRECT'

function normalizeVerificationStatus(
  value: unknown,
): ActivityVerificationStatus | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'string') {
    const upper = value.toUpperCase()
    if (upper === 'NONE' || upper === 'CORRECT' || upper === 'INCORRECT') {
      return upper as ActivityVerificationStatus
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'CORRECT' : 'NONE'
  }
  return undefined
}

function extractVerificationStatus(
  candidate: any,
): ActivityVerificationStatus | undefined {
  if (candidate === null || candidate === undefined) {
    return undefined
  }
  const direct = normalizeVerificationStatus(candidate)
  if (direct) {
    return direct
  }
  if (typeof candidate !== 'object') {
    return undefined
  }
  const keys = [
    'tutor_verified',
    'tutorVerified',
    'tutor_verification',
    'tutorVerification',
    'verification',
    'verified',
  ]
  for (const key of keys) {
    if (!(key in candidate)) continue
    const normalized = normalizeVerificationStatus(candidate[key])
    if (normalized) {
      return normalized
    }
  }
  return undefined
}

function getProgressionStepsForTab(course: any, tabId?: string | null) {
  const progression = course?.progression ?? course?.progressions
  if (!progression) {
    return null
  }

  const candidates: any[] = []

  if (tabId) {
    const tabContainers = [
      progression.tabs?.[tabId],
      progression.tabProgression?.[tabId],
      progression.tab_progression?.[tabId],
      progression.tabMap?.[tabId],
      progression.tab_map?.[tabId],
      progression[tabId],
    ]
    for (const container of tabContainers) {
      if (!container) {
        continue
      }
      if (Array.isArray(container)) {
        return container
      }
      if (typeof container === 'object') {
        const nested =
          container.steps ??
          container.activities ??
          container.completedActivities ??
          container.items
        if (Array.isArray(nested)) {
          return nested
        }
      }
    }
  }

  candidates.push(
    progression.steps,
    progression.activities,
    progression.completedActivities,
    progression.items,
    progression,
  )

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return null
}

export function buildActivityTabIndex(
  course: any,
  fallbackTabId?: string,
): Record<string, string> {
  const index: Record<string, string> = {}
  const fallback = fallbackTabId ?? getCourseFallbackTabId(course)

  const chapters = Array.isArray(course?.chapters) ? course.chapters : []
  chapters.forEach((chapter: any) => {
    const tabId = resolveChapterTabId(chapter, course, fallback)
    const activities = Array.isArray(chapter?.activities)
      ? chapter.activities
      : []
    activities.forEach((activity: any) => {
      const activityUuid = extractActivityUuid(
        activity?.activity_uuid ?? activity,
      )
      const normalized = normalizeActivityUuid(activityUuid)
      if (normalized) {
        index[normalized] = tabId
      }
    })
  })

  return index
}

function getActiveTabIdFromOptions(
  options: ActivityProgressOptions | undefined,
  chapterTabId: string,
): string {
  if (options?.activeTabId) {
    return options.activeTabId
  }
  return chapterTabId
}

export function isChapterLocked(
  chapterID: number,
  course: any,
  options?: ActivityProgressOptions,
) {
  const chapters = Array.isArray(course?.chapters) ? course.chapters : []
  const chapter = chapters.find((c: any) => c.id === chapterID)

  if (!chapter) {
    return false
  }

  const fallbackTabId =
    options?.fallbackTabId ?? getCourseFallbackTabId(course)
  const chapterTabId = resolveChapterTabId(chapter, course, fallbackTabId)
  const activeTabId = getActiveTabIdFromOptions(options, chapterTabId)

  if (options?.activeTabId && chapterTabId !== activeTabId) {
    return false
  }

  const predecessorIds = Array.isArray(chapter?.predecessors)
    ? chapter.predecessors
    : []

  if (predecessorIds.length === 0) {
    return false
  }

  const activityTabIndex =
    options?.activityTabIndex ??
    buildActivityTabIndex(course, fallbackTabId)

  for (const predecessorID of predecessorIds) {
    const pred = chapters.find((c: any) => c.id === predecessorID)

    if (!pred) {
      continue
    }

    const predecessorTabId = resolveChapterTabId(
      pred,
      course,
      fallbackTabId,
    )

    if (predecessorTabId !== activeTabId) {
      continue
    }

    const activities = Array.isArray(pred?.activities)
      ? pred.activities
      : []

    if (activities.length === 0) {
      return true
    }

    const lastActivity = activities[activities.length - 1]
    const lastActivityUuid =
      extractActivityUuid(lastActivity?.activity_uuid ?? lastActivity) ??
      extractActivityUuid(lastActivity)

    if (!lastActivityUuid) {
      return true
    }

    if (
      !isActivityDone(course, lastActivityUuid, {
        activeTabId,
        activityTabIndex,
        fallbackTabId,
      })
    ) {
      return true
    }
  }

  return false
}

export function isActivityLocked(
  course: any,
  chapter: any,
  activityUUID: string,
  options?: ActivityProgressOptions,
) {
  if (!chapter || !Array.isArray(chapter?.activities)) {
    return true
  }

  const normalizedTarget = normalizeActivityUuid(activityUUID)
  const activityIndex = chapter.activities.findIndex(
    (act: any) =>
      normalizeActivityUuid(
        act?.activity_uuid ?? act?.activityUuid ?? act?.activityUUID ?? act?.id,
      ) === normalizedTarget,
  )

  if (activityIndex <= 0) {
    return false
  }

  const previous = chapter.activities[activityIndex - 1]
  const previousUuid =
    extractActivityUuid(previous?.activity_uuid ?? previous) ??
    extractActivityUuid(previous)

  if (!previousUuid) {
    return true
  }

  return !isActivityDone(course, previousUuid, options)
}

export function isActivityDone(
  course: any,
  activityUUID: string,
  options?: ActivityProgressOptions,
) {
  const normalizedTarget = normalizeActivityUuid(activityUUID)
  if (!normalizedTarget) {
    return false
  }

  const fallbackTabId =
    options?.fallbackTabId ?? getCourseFallbackTabId(course)

  const activityTabIndex =
    options?.activityTabIndex ??
    buildActivityTabIndex(course, fallbackTabId)

  const targetTabId = activityTabIndex[normalizedTarget] ?? fallbackTabId
  const activeTabId =
    options?.activeTabId ?? targetTabId ?? fallbackTabId

  if (
    options?.activeTabId &&
    targetTabId &&
    targetTabId !== options.activeTabId
  ) {
    return false
  }

  const progressionSteps = getProgressionStepsForTab(course, activeTabId)
  if (Array.isArray(progressionSteps)) {
    for (const step of progressionSteps) {
      const stepUuid = extractActivityUuid(step)
      const normalizedStepUuid = normalizeActivityUuid(stepUuid)
      if (normalizedStepUuid !== normalizedTarget) {
        continue
      }

      const completion = extractCompletionState(step)
      if (completion === undefined) {
        return true
      }
      if (completion) {
        return true
      }
    }
  }

  const run = course?.trail?.runs?.find(
    (candidate: any) => candidate?.course_id == course?.id,
  )
  if (!run) {
    return false
  }

  const steps = Array.isArray(run?.steps) ? run.steps : []
  for (const step of steps) {
    const stepUuid = extractActivityUuid(step)
    const normalizedStepUuid = normalizeActivityUuid(stepUuid)
    if (normalizedStepUuid !== normalizedTarget) {
      continue
    }

    const stepTabId = activityTabIndex[normalizedStepUuid] ?? fallbackTabId
    if (activeTabId && stepTabId && stepTabId !== activeTabId) {
      continue
    }

    const completion = extractCompletionState(step)
    if (completion) {
      return true
    }
  }

  return false
}

export function getActivityTutorVerification(
  course: any,
  activityUUID: string,
  options?: ActivityProgressOptions,
): ActivityVerificationStatus | undefined {
  const normalizedTarget = normalizeActivityUuid(activityUUID)
  if (!normalizedTarget) {
    return undefined
  }

  const fallbackTabId =
    options?.fallbackTabId ?? getCourseFallbackTabId(course)

  const activityTabIndex =
    options?.activityTabIndex ??
    buildActivityTabIndex(course, fallbackTabId)

  const targetTabId = activityTabIndex[normalizedTarget] ?? fallbackTabId
  const activeTabId =
    options?.activeTabId ?? targetTabId ?? fallbackTabId

  if (
    options?.activeTabId &&
    targetTabId &&
    targetTabId !== options.activeTabId
  ) {
    return undefined
  }

  const progressionSteps = getProgressionStepsForTab(course, activeTabId)
  if (Array.isArray(progressionSteps)) {
    for (const step of progressionSteps) {
      const stepUuid = extractActivityUuid(step)
      const normalizedStepUuid = normalizeActivityUuid(stepUuid)
      if (normalizedStepUuid !== normalizedTarget) {
        continue
      }
      const verification = extractVerificationStatus(step)
      if (verification !== undefined) {
        return verification
      }
    }
  }

  const run = course?.trail?.runs?.find(
    (candidate: any) => candidate?.course_id == course?.id,
  )
  if (!run) {
    return undefined
  }

  const steps = Array.isArray(run?.steps) ? run.steps : []
  for (const step of steps) {
    const stepUuid = extractActivityUuid(step)
    const normalizedStepUuid = normalizeActivityUuid(stepUuid)
    if (normalizedStepUuid !== normalizedTarget) {
      continue
    }

    const stepTabId = activityTabIndex[normalizedStepUuid] ?? fallbackTabId
    if (activeTabId && stepTabId && stepTabId !== activeTabId) {
      continue
    }

    const verification = extractVerificationStatus(step)
    if (verification !== undefined) {
      return verification
    }
  }

  return undefined
}
