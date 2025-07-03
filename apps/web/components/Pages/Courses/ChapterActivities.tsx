import React from 'react'
import ChapterActivity from './ChapterActivity'
import { isActivityDone, isActivityLocked } from './utils'
import { Progress } from '@/components/ui/progress'

interface Props {
	course: any
	chapterID: number,
	orgslug: string
	courseId: string
	current_activity?: any
	access_token: string,
}

function ChapterActivities(props: Props) {
	const course = props.course
	const chapterID = props.chapterID
	const orgslug = props.orgslug
	const courseid = props.courseId

	const chapter = course.chapters.find(((c: any) => c.id === chapterID))

	// Calculate completion percentage for the chapter
	const totalActivities = chapter.activities.length
	const completedActivities = chapter.activities.filter((activity: any) =>
		!isActivityLocked(course, chapter, activity.id) && isActivityDone(course, activity.id)
	).length

	const completionPercentage = Math.round((completedActivities / totalActivities) * 100)

    let run = course.trail?.runs.find(
        (run: any) => run.course_id == course.id
    )
    // if (run) {
    //     return run.steps.find((step: any) => step.activity_id == activityID)
    // } else {
    //     return false
    // }
	// console.log("run", run)
// 
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between mb-2 px-1">
				<div className="text-xs sm:text-sm text-muted-foreground">
					{completedActivities} of {totalActivities} activities completed
				</div>
				<div className="text-xs sm:text-sm font-medium">{completionPercentage}%</div>
			</div>

			<Progress value={completionPercentage} className="h-2 mb-4 sm:mb-6" />

			<div className="space-y-2">
				{chapter.activities.map((activity: any) => {
					const activityLocked = isActivityLocked(course, chapter, activity.id)
					const activityDone = !activityLocked && isActivityDone(course, activity.id)
					const activityState = (activityLocked ? 'locked' : (activityDone ? 'done' : 'available'))

					return (
						<ChapterActivity
							activity={activity}
							course={course}
							orgslug={orgslug}
							state={activityState}
							key={activity.id}
							access_token={props.access_token}
						/>
					)
				})}
			</div>
		</div>
	)
}

export default ChapterActivities