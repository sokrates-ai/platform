import { getUriWithOrg } from '@services/config/config'
import { CheckCircle, Circle, ArrowRightCircle } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface Props {
	course: any
	orgslug: string
	course_uuid: string
	current_activity?: any
}

function ActivityIndicators(props: Props) {
	const course = props.course
	const orgslug = props.orgslug
	const courseid = props.course_uuid.replace('course_', '')

	function isActivityDone(activity: any) {
		let run = props.course.trail?.runs.find(
			(run: any) => run.course_id == props.course.id
		)
		if (run) {
			return run.steps.find((step: any) => step.activity_id == activity.id)
		} else {
			return false
		}
	}

	function isActivityCurrent(activity: any) {
		let activity_uuid = activity.activity_uuid.replace('activity_', '')
		if (props.current_activity && props.current_activity == activity_uuid) {
			return true
		}
		return false
	}

	return (
		<div className="w-full mb-6 sm:mb-8 px-1">
			<ScrollArea className="w-full">
				<div className="flex space-x-4 sm:space-x-6 pb-2">
					{course.chapters.map((chapter: any, chapterIndex: number) => (
						<div key={chapter.id} className="flex flex-col min-w-fit">
							{/* <div className="text-xs sm:text-sm font-medium mb-2 text-muted-foreground">
								Ch {chapterIndex + 1}
							</div> */}
							<div className="flex items-center">
								{(chapter.activities ?? []).map((activity: any, activityIndex: number) => {
									const isDone = isActivityDone(activity)
									const isCurrent = isActivityCurrent(activity)

									const activityUrl = getUriWithOrg(orgslug, '') +
										`/course/${courseid}/activity/${activity.activity_uuid.replace('activity_', '')}`

									return (
										<React.Fragment key={activity.activity_uuid}>
											{activityIndex > 0 && (
												<Separator orientation="horizontal" className="h-[2px] w-3 sm:w-4 mx-1 bg-muted self-center" />
											)}
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Link href={activityUrl}>
															<div className={`flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full
                                ${isDone ? 'bg-green-100 text-green-700' :
																	isCurrent ? 'bg-primary text-white animate-pulse' :
																		'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
																{isDone ? (
																	<CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
																) : isCurrent ? (
																	<ArrowRightCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
																) : (
																	<Circle size={16} className="sm:w-[18px] sm:h-[18px]" />
																)}
															</div>
														</Link>
													</TooltipTrigger>
													<TooltipContent>
														<div className="text-sm font-medium">{activity.name}</div>
														<div className="text-xs text-muted-foreground">
															{isDone ? 'Completed' : isCurrent ? 'Current Activity' : 'Not Started'}
														</div>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</React.Fragment>
									)
								})}
							</div>
						</div>
					))}
				</div>
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</div>
	)
}

export default ActivityIndicators
