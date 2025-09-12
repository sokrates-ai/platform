export function isChapterLocked(chapterID: number, course: any) {
    const chapter = course.chapters.find((c: any) => c.id === chapterID)

    const predecessorChapters = chapter.predecessors

    if (predecessorChapters.length === 0) {
        return false
    }

    for (let predecessorID of predecessorChapters) {
        const pred = course.chapters.find((c: any) => c.id === predecessorID)

        if (pred.activities.length === 0) {
            return true
        }

        const lastActivity = pred.activities[pred.activities.length - 1]
        if (!isActivityDone(course, lastActivity.activity_uuid)) {
            return true
        }
    }

    return false
}

export function isActivityLocked(course: any, chapter: any, activityUUID: string) {
    console.log(chapter.activities, activityUUID)
    const activityIndex = chapter.activities.findIndex((act: any) => act.activity_uuid === activityUUID)
    if (activityIndex === 0) {
        return false
    }

    const previousIndex = activityIndex - 1
    const previous = chapter.activities[previousIndex]

    if (isActivityDone(course, previous.activity_uuid)) {
        return false
    }

    return true
}

export function isActivityDone(course: any, activityUUID: string) {
    let run = course.trail?.runs.find(
        (run: any) => run.course_id == course.id
    )
    if (run) {
        const step = run.steps.find((step: any) => step.activity_uuid == activityUUID)
        if (!step) {
            return false
        }
        return step.complete
    } else {
        return false
    }
}
