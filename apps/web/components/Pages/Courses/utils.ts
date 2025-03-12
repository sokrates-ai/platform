export function isChapterLocked(chapterID: number, course: any) {
    // Get chapter index
    const chapterIndex = course.chapters.findIndex((c: any) => c.id === chapterID)

    if (chapterIndex === 0) {
        return false
    }


    // Get previous chapter index.
    const previousChapterIndex = chapterIndex - 1
    const previousChapter = course.chapters[previousChapterIndex]

    if (previousChapter.activities.length === 0) {
        return false
    }

    const lastActivity = previousChapter.activities[previousChapter.activities.length - 1]
    if (isActivityDone(course, lastActivity.id)) {
        return false
    }

    return true
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