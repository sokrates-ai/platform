import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { CheckCircle, LockIcon, Rocket, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import WorkspaceActivity from '@components/Objects/Activities/Workspace/WorkspaceActivity'
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests'
import WorkspaceActivityBody from './WorkspaceActivityBody'
import { stateConfig } from './stateConfig'

interface Props {
  activity: any
  orgslug: string
  course: any
  state: ACTIVITY_STATE
  access_token: string
}

export type ACTIVITY_STATE = 'locked' | 'available' | 'done'

function ChapterActivity(props: Props) {
  const activity = props.activity
  const orgslug = props.orgslug
  const course = props.course
  const state = props.state

  let isWorkspaceMulti =
    activity.activity_type === 'TYPE_WORKSPACE' &&
    activity.content.task_ids &&
    activity.content.task_ids.length > 1


  const courseUuid = course.course_uuid.replace('course_', '')
  console.log('courseUuid', courseUuid)

  const activityUrl =
    getUriWithOrg(orgslug, '') +
    `/course/${courseUuid}/activity/${activity.activity_uuid.replace(
      'activity_',
      ''
    )}${isWorkspaceMulti ? '?task_id=TASK_ID_PLACEHOLDER' : ''}`

  const {
    icon,
    badge,
    buttonText,
    mobileButtonText,
    buttonVariant,
    buttonIcon,
    borderColor,
  } = stateConfig[state]

  return (
    <Card
      className="w-full border-l-4 hover:shadow transition-all duration-200 mb-3"
      style={{
        borderLeftColor: borderColor,
      }}
    >
      <CardContent className={`p-3 sm:p-4`}>
        <div
          className={`flex flex-col w-full ${
            !isWorkspaceMulti ? 'sm:flex-row' : 'w-full'
          } sm:items-center justify-between gap-3`}
        >
          <div
            className={`flex ${
              isWorkspaceMulti ? 'flex-col w-full' : ''
            } items-center space-x-3`}
          >
            <div className="flex items-center justify-center flex-shrink-0 gap-3">
              {icon}
              <span className="font-medium">{activity.name}</span>
            </div>

            {isWorkspaceMulti ? (
              <WorkspaceActivityBody
                baseUrl={activityUrl}
                activity={activity}
                orgslug={orgslug}
                course={course}
                state={state}
                access_token={props.access_token}
              ></WorkspaceActivityBody>
            ) : (
              <></>
            )}
          </div>

          {!isWorkspaceMulti ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 ml-8 sm:ml-0">
                    <div className="hidden sm:block">{badge}</div>
                    <Button
                      variant={buttonVariant}
                      size="sm"
                      className={`${
                        state === 'locked'
                          ? 'opacity-70 cursor-not-allowed'
                          : ''
                      } whitespace-nowrap`}
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
                  {state === 'locked'
                    ? 'Complete previous activities to unlock'
                    : state === 'done'
                    ? 'You have completed this activity'
                    : 'Start this activity'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <></>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ChapterActivity
