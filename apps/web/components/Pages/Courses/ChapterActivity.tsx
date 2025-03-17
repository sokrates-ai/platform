import { getUriWithOrg } from '@services/config/config'
import { CheckCircle, LockIcon, Rocket, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
	activity: any
	orgslug: string
	courseId: string
	state: ACTIVITY_STATE
}

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

function ChapterActivity(props: Props) {
	const activity = props.activity
	const orgslug = props.orgslug
	const courseid = props.courseId
	const state = props.state

	const activityUrl = getUriWithOrg(orgslug, '') +
		`/course/${courseid}/activity/${activity.activity_uuid.replace('activity_', '')}`

	const stateConfig = {
		'available': {
			icon: <Rocket size={18} className="text-primary" />,
			badge: <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Available</Badge>,
			buttonText: "Start",
			mobileButtonText: "Start",
			buttonVariant: "default" as const,
			buttonIcon: <ArrowRight size={16} className="ml-2" />
		},
		'locked': {
			icon: <LockIcon size={18} className="text-muted-foreground" />,
			badge: <Badge variant="outline" className="bg-muted text-muted-foreground">Locked</Badge>,
			buttonText: "Locked",
			mobileButtonText: "Locked",
			buttonVariant: "outline" as const,
			buttonIcon: <LockIcon size={16} className="ml-2" />
		},
		'done': {
			icon: <CheckCircle size={18} className="text-green-600" />,
			badge: <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Completed</Badge>,
			buttonText: "Review",
			mobileButtonText: "Review",
			buttonVariant: "secondary" as const,
			buttonIcon: <ArrowRight size={16} className="ml-2" />
		}
	}

	const { icon, badge, buttonText, mobileButtonText, buttonVariant, buttonIcon } = stateConfig[state]

	return (
		<Card className="w-full border-l-4 hover:shadow transition-all duration-200 mb-3"
			style={{
				borderLeftColor: state === 'done' ? 'rgb(22, 163, 74)' :
					state === 'available' ? 'rgb(37, 99, 235)' :
						'rgb(229, 231, 235)'
			}}>
			<CardContent className="p-3 sm:p-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-center space-x-3">
						<div className="flex items-center justify-center flex-shrink-0">
							{icon}
						</div>
						<span className="font-medium">{activity.name}</span>
					</div>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 ml-8 sm:ml-0">
									<div className="hidden sm:block">{badge}</div>
									<Button
										variant={buttonVariant}
										size="sm"
										className={`${state === 'locked' ? 'opacity-70 cursor-not-allowed' : ''} whitespace-nowrap`}
										asChild={state !== 'locked'}
									>
										{state !== 'locked' ? (
											<Link href={activityUrl} className="flex items-center">
												<span className="hidden sm:inline">{buttonText}</span>
												<span className="sm:hidden">{mobileButtonText}</span>
												{buttonIcon}
											</Link>
										) : (
											<span className="flex items-center">
												<span className="hidden sm:inline">{buttonText}</span>
												<span className="sm:hidden">{mobileButtonText}</span>
												{buttonIcon}
											</span>
										)}
									</Button>
								</div>
							</TooltipTrigger>
							<TooltipContent>
								{state === 'locked' ? 'Complete previous activities to unlock' :
									state === 'done' ? 'You have completed this activity' :
										'Start this activity'}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</CardContent>
		</Card>
	)
}

export default ChapterActivity