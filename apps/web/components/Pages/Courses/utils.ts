export function isChapterLocked(chapterID: number, course: any) {
    const chapter = course.chapters.find((c: any) => c.id === chapterID)

    const predecessorChapters = chapter.predecessors

    console.log(predecessorChapters)

    if (predecessorChapters.length === 0) {
        return false
    }

    for (let predecessorID of predecessorChapters) {
        const pred = course.chapters.find((c: any) => c.id === predecessorID)

        if (pred.activities.length === 0) {
            return true
        }

        const lastActivity = pred.activities[pred.activities.length - 1]
        if (!isActivityDone(course, lastActivity.id)) {
            return true
        }
    }

    return false
}

export function isActivityLocked(course: any, chapter: any, activityID: number) {
    const activityIndex = chapter.activities.findIndex((act: any) => act.id === activityID)
    if (activityIndex === 0) {
        return false
    }

    const previousIndex = activityIndex - 1
    const previous = chapter.activities[previousIndex]

    if (isActivityDone(course, previous.id)) {
        return false
    }

    console.log(activityID, 'still locked')

    return true
}

export function isActivityDone(course: any, activityID: number) {
    let run = course.trail?.runs.find(
        (run: any) => run.course_id == course.id
    )
    if (run) {
        return run.steps.find((step: any) => step.activity_id == activityID)
    } else {
        return false
    }
}