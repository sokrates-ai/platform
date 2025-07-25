import React, { useState } from 'react'
import ChapterActivity, { ACTIVITY_STATE } from './ChapterActivity'
import { isActivityDone, isActivityLocked } from './utils'

interface Props {
	course: any
	chapterID: number
	orgslug: string
	courseId: string
	current_activity?: any
	access_token: string
}

export default function ChapterActivities({
	course,
	chapterID,
	orgslug,
	access_token,
}: Props) {
	const [selectedId, setSelectedId] = useState<number | null>(null)

	const chapter = course.chapters.find((c: any) => c.id === chapterID)
	const { activities } = chapter

	const stateOf = (idx: number): ACTIVITY_STATE => {
		const a = activities[idx]
		if (isActivityLocked(course, chapter, a.id)) return 'locked'
		return isActivityDone(course, a.id) ? 'done' : 'available'
	}

	return (
		<div className="space-y-4 mt-4 sm:mt-12 mx-0 sm:mx-16">
			<div className="relative">
				{activities.map((activity: any, idx: number) => {
					const state = stateOf(idx)
					const prevState = idx > 0 ? stateOf(idx - 1) : null
					const nextState =
						idx < activities.length - 1 ? stateOf(idx + 1) : null

					const green = '#9ABB46'
					const grey = '#DFDFDF'

					const topColour =
						prevState === 'done' ? green : grey
					const bottomColour =
						state === 'done' ? green : grey

					return (
						<div
							key={activity.id}
							className="relative flex gap-4 cursor-pointer"
							onClick={() => setSelectedId(activity.id)}
						>
							<ChapterActivity
								activity={activity}
								course={course}
								orgslug={orgslug}
								state={state}
								access_token={access_token}
								showTop={idx !== 0}
								showBottom={idx !== activities.length - 1}
								topColour={idx === 0 ? 'transparent' : topColour}
								bottomColour={
									idx === activities.length - 1 ? 'transparent' : bottomColour
								}
								selected={selectedId === activity.id}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
}
