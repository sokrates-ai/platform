import React, { useMemo, useState } from 'react'
import ChapterActivity, { ACTIVITY_STATE } from './ChapterActivity'
import {
	buildActivityTabIndex,
	getCourseFallbackTabId,
	isActivityDone,
	isActivityLocked,
} from './utils'

interface Props {
	course: any
	chapterID: number
	orgslug: string
	courseId: string
	current_activity?: any
	access_token: string
	selectedTabId: string | null
}

export default function ChapterActivities({
	course,
	chapterID,
	orgslug,
	access_token,
	selectedTabId,
}: Props) {
	const [selectedId, setSelectedId] = useState<number | null>(null)

	const chapter = course?.chapters?.find((c: any) => c.id === chapterID)
	const activities = Array.isArray(chapter?.activities) ? chapter.activities : []

	const fallbackTabId = useMemo(
		() => getCourseFallbackTabId(course),
		[course],
	)

	const activityTabIndex = useMemo(
		() => buildActivityTabIndex(course, fallbackTabId),
		[course, fallbackTabId],
	)

	const effectiveTabId = selectedTabId ?? fallbackTabId

	if (!chapter) {
		return null
	}

	const stateOf = (idx: number): ACTIVITY_STATE => {
		const a = activities[idx]
		const activityUuid =
			a?.activity_uuid ?? a?.activityUuid ?? a?.activityUUID ?? a?.id
		if (
			isActivityLocked(course, chapter, activityUuid, {
				activeTabId: effectiveTabId,
				activityTabIndex,
				fallbackTabId,
			})
		)
			return 'locked'
		return isActivityDone(course, activityUuid, {
			activeTabId: effectiveTabId,
			activityTabIndex,
			fallbackTabId,
		})
			? 'done'
			: 'available'
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
							key={activity.activity_uuid ?? activity.id ?? idx}
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
