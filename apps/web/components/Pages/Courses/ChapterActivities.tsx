'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import ChapterActivity, { ACTIVITY_STATE } from './ChapterActivity'
import {
	buildActivityTabIndex,
	getCourseFallbackTabId,
	isActivityDone,
	isActivityLocked,
} from './utils'
import { getActivity } from '@services/courses/activities'
import Canva from '@components/Objects/Activities/DynamicCanva/DynamicCanva'
import { Loader2 } from 'lucide-react'
import { markActivityAsComplete } from '@services/courses/activity'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

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
	const router = useRouter()
	const [selectedId, setSelectedId] = useState<number | null>(null)
	const [dynamicActivity, setDynamicActivity] = useState<any | null>(null)
	const [dynamicError, setDynamicError] = useState<string | null>(null)
	const [isLoadingDynamic, setIsLoadingDynamic] = useState(false)
	const latestDynamicRequest = useRef<string | null>(null)

	const chapter = useMemo(
		() => course?.chapters?.find((c: any) => c.id === chapterID),
		[course, chapterID],
	)
	const activities = useMemo(
		() => (Array.isArray(chapter?.activities) ? chapter.activities : []),
		[chapter?.activities],
	)

	const fallbackTabId = useMemo(
		() => getCourseFallbackTabId(course),
		[course],
	)

	const activityTabIndex = useMemo(
		() => buildActivityTabIndex(course, fallbackTabId),
		[course, fallbackTabId],
	)

	const effectiveTabId = selectedTabId ?? fallbackTabId

	const selectedActivity = useMemo(
		() => activities.find((activity: any) => activity.id === selectedId),
		[activities, selectedId],
	)

	const isDynamicActivity = (activity: any) =>
		activity?.activity_type === 'TYPE_DYNAMIC' ||
		activity?.activity_sub_type === 'SUBTYPE_DYNAMIC_PAGE'

	const selectedIsDynamic = isDynamicActivity(selectedActivity)

	const shouldShowDynamicPreview =
		selectedIsDynamic &&
		(isLoadingDynamic || dynamicError || dynamicActivity)

	const selectedCourseTrail = course?.trail
	const isSelectedActivityCompleted = () => {
		if (!selectedActivity) return false
		const activityId = selectedActivity.id
		const run = selectedCourseTrail?.runs?.find(
			(run: any) => run.course_id === course?.id,
		)
		if (!run) return false
		return Boolean(
			run.steps?.find(
				(step: any) => step.activity_id === activityId && step.complete,
			),
		)
	}

	const handleMarkComplete = async () => {
		if (!selectedActivity) return
		try {
			await markActivityAsComplete(
				orgslug,
				course.course_uuid,
				selectedActivity.activity_uuid,
				access_token,
			)
			toast.success('Activity marked as complete')
			router.refresh()
		} catch (error) {
			toast.error('Could not mark activity as complete')
		}
	}

	useEffect(() => {
		setSelectedId(null)
		setDynamicActivity(null)
		setDynamicError(null)
		setIsLoadingDynamic(false)
		latestDynamicRequest.current = null
	}, [chapterID])

	if (!chapter) {
		return null
	}

	const handleActivityStart = async (
		activity: any,
		event?: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
		skipPreview?: boolean,
	) => {
		setSelectedId(activity.id)

		if (!isDynamicActivity(activity)) {
			latestDynamicRequest.current = null
			setDynamicActivity(null)
			setDynamicError(null)
			setIsLoadingDynamic(false)
			return
		}

		if (skipPreview) {
			return
		}

		event?.preventDefault()

		// prevent duplicate fetches when reselecting the same activity
		if (dynamicActivity?.activity_uuid === activity.activity_uuid) {
			return
		}

		const activityUuid: string = activity.activity_uuid
		latestDynamicRequest.current = activityUuid
		setIsLoadingDynamic(true)
		setDynamicError(null)

		try {
			const detailedActivity = await getActivity(
				activityUuid,
				null,
				access_token,
			)

			// API may return error payloads with a detail field
			if ('detail' in (detailedActivity ?? {})) {
				throw new Error(
					typeof detailedActivity.detail === 'string'
						? detailedActivity.detail
						: 'Unable to load activity content.',
				)
			}

			if (latestDynamicRequest.current === activityUuid) {
				setDynamicActivity(detailedActivity)
			}
		} catch (error: any) {
			if (latestDynamicRequest.current === activityUuid) {
				setDynamicActivity(null)
				setDynamicError(error?.message ?? 'Unable to load activity content.')
			}
		} finally {
			if (latestDynamicRequest.current === activityUuid) {
				setIsLoadingDynamic(false)
			}
		}
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

					const isPreviewing =
						selectedId === activity.id &&
						dynamicActivity?.activity_uuid === activity.activity_uuid &&
						!isLoadingDynamic &&
						!dynamicError
					const isSelected = activity.id === selectedActivity?.id
					const isPreviewActive =
						isDynamicActivity(activity) &&
						selectedId === activity.id &&
						latestDynamicRequest.current === activity.activity_uuid
					const shouldShowMarkComplete =
						isPreviewActive &&
						isSelected &&
						!isSelectedActivityCompleted() &&
						state !== 'done'

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
								onStartActivity={(evt) =>
									handleActivityStart(activity, evt, isPreviewing)
								}
								onMarkComplete={shouldShowMarkComplete ? handleMarkComplete : undefined}
								overrideButtonText={isPreviewing ? 'Expand' : undefined}
								isCompleted={
									isDynamicActivity(activity) && isSelected
										? isSelectedActivityCompleted()
										: state === 'done'
								}
							/>
						</div>
					)
				})}
			</div>

			{shouldShowDynamicPreview && (
				<div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
					<div className="mb-4">
						<h3 className="text-lg font-semibold text-gray-900">
							{selectedActivity?.name ?? 'Dynamic Page'}
						</h3>
						{selectedActivity?.description && (
							<p className="mt-1 text-sm text-muted-foreground">
								{selectedActivity.description}
							</p>
						)}
					</div>
					<div className="max-h-[420px] overflow-y-auto rounded-xl border border-gray-100 bg-gray-50">
						{isLoadingDynamic && (
							<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Loading activity…
							</div>
						)}
						{!isLoadingDynamic && dynamicError && (
							<div className="p-4 text-sm text-red-600">{dynamicError}</div>
						)}
						{!isLoadingDynamic && !dynamicError && dynamicActivity && (
							<Canva
								activity={dynamicActivity}
								content={dynamicActivity.content}
							/>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
