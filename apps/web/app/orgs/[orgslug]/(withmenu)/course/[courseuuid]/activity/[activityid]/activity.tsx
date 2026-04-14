'use client'
import { getAPIUrl } from '@services/config/config'
import Canva from '@components/Objects/Activities/DynamicCanva/DynamicCanva'
import VideoActivity from '@components/Objects/Activities/Video/Video'
import { BookOpenCheck, Check, CheckCircle, Loader2, UserRoundPen } from 'lucide-react'
import { markActivityAsComplete } from '@services/courses/activity'
import DocumentPdfActivity from '@components/Objects/Activities/DocumentPdf/DocumentPdf'
import { useRouter } from 'next/navigation'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { useOrg } from '@components/Contexts/OrgContext'
import { CourseProvider } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import React, { useEffect } from 'react'
import { getAssignmentFromActivityUUID, getFinalGrade, submitAssignmentForGrading } from '@services/courses/assignments'
import AssignmentStudentActivity from '@components/Objects/Activities/Assignment/AssignmentStudentActivity'
import { AssignmentProvider } from '@components/Contexts/Assignments/AssignmentContext'
import { AssignmentsTaskProvider } from '@components/Contexts/Assignments/AssignmentsTaskContext'
import AssignmentSubmissionProvider, { useAssignmentSubmission } from '@components/Contexts/Assignments/AssignmentSubmissionContext'
import toast from 'react-hot-toast'
import { mutate } from 'swr'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { useMediaQuery } from 'usehooks-ts'
import WorkspaceActivity from '@components/Objects/Activities/Workspace/WorkspaceActivity'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import { swrFetcher } from '@services/utils/ts/requests'
import { isActivityDone } from '@components/Pages/Courses/utils'



interface ActivityClientProps {
  activityid: string
  courseuuid: string
  orgslug: string
  activity: any
  course: any
  backlink: string
}

function ActivityClient(props: ActivityClientProps) {
  const activityid = props.activityid
  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const activity = props.activity
  const course = props.course
  const org = useOrg() as any
  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [bgColor, setBgColor] = React.useState('bg-white')
  const [assignment, setAssignment] = React.useState(null) as any;
  const [markStatusButtonActive, setMarkStatusButtonActive] = React.useState(false);


  function getChapterNameByActivityId(course: any, activity_id: any) {
    for (let i = 0; i < course.chapters.length; i++) {
      let chapter = course.chapters[i]
      for (let j = 0; j < chapter.activities.length; j++) {
        let activity = chapter.activities[j]
        if (activity.id === activity_id) {
          return chapter.name
        }
      }
    }
    return null // return null if no matching activity is found
  }

  const getAssignmentUI = React.useCallback(async () => {
    const assignment = await getAssignmentFromActivityUUID(
      activity.activity_uuid,
      access_token
    )
    setAssignment(assignment.data)
  }, [activity.activity_uuid, access_token])

  useEffect(() => {
    if (activity.activity_type == 'TYPE_DYNAMIC') {
      setBgColor('bg-white nice-shadow');
    }
    else if (activity.activity_type == 'TYPE_ASSIGNMENT') {
      setMarkStatusButtonActive(false);
      setBgColor('bg-white nice-shadow');
      getAssignmentUI();
    }
    else {
      setBgColor('bg-zinc-950');
    }
  }, [activity, getAssignmentUI])

  const containerTopSpacing = React.useMemo(() => {
    if (activity?.activity_type === 'TYPE_DYNAMIC') {
      return 'mt-24 lg:mt-28'
    }
    return 'mt-16 lg:mt-20'
  }, [activity?.activity_type])

  return (
    <>
      <CourseProvider courseuuid={course?.course_uuid}>
        <div
          className={cn(
            'container max-w-6xl mx-auto py-6 px-4 space-y-6',
            containerTopSpacing,
          )}
        >
          {/* <ActivityIndicators
            course_uuid={courseuuid}
            current_activity={activityid}
            orgslug={orgslug}
            course={course}
          />

          <Separator className="my-4" /> */}

          {/* Activity Content */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <Badge variant="outline" className="font-medium">
                    Chapter: {getChapterNameByActivityId(course, activity.id)}
                  </Badge>
                  <h1 className="text-2xl font-bold first-letter:uppercase">
                    {activity.name}
                  </h1>
                </div>

                {activity && activity.published === true && (
                  <AuthenticatedClientElement checkMethod="authentication">
                    <div className="flex items-center gap-2">
                      {activity.activity_type !== 'TYPE_ASSIGNMENT' && (
                        <>
                          <MarkStatus
                            activity={activity}
                            activityid={activityid}
                            course={course}
                            orgslug={orgslug}
                          />
                        </>
                      )}
                      {activity.activity_type === 'TYPE_ASSIGNMENT' && (
                        <AssignmentSubmissionProvider assignment_uuid={assignment?.assignment_uuid}>
                          <AssignmentTools
                            assignment={assignment}
                            activity={activity}
                            activityid={activityid}
                            course={course}
                            orgslug={orgslug}
                          />
                        </AssignmentSubmissionProvider>
                      )}
                    </div>
                  </AuthenticatedClientElement>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {activity && activity.published === false ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
                  <h3 className="font-semibold text-lg text-destructive">
                    This activity is not published yet
                  </h3>
                </div>
              ) : (
                <>
                  {activity && activity.published === true && (
                    <>
                      <div className="rounded-lg bg-card p-6">
                        {activity.activity_type === 'TYPE_DYNAMIC' && (
                          <div className="text-lg sm:text-[1.15rem] lg:text-[1.25rem] leading-relaxed text-slate-900">
                            <Canva content={activity.content} activity={activity} />
                          </div>
                        )}
                        {activity.activity_type === 'TYPE_VIDEO' && (
                          <VideoActivity course={course} activity={activity} />
                        )}
                        {activity.activity_type === 'TYPE_DOCUMENT' && (
                          <DocumentPdfActivity
                            course={course}
                            activity={activity}
                          />
                        )}
                        {activity.activity_type === 'TYPE_WORKSPACE' && (
                          <WorkspaceActivity
                            course={course}
                            activity={activity}
                            access_token={access_token}
                            backlink={props.backlink}
                          />
                        )}
                        {activity.activity_type === 'TYPE_ASSIGNMENT' && (
                          <>
                            {assignment ? (
                              <AssignmentProvider assignment_uuid={assignment?.assignment_uuid}>
                                <AssignmentsTaskProvider>
                                  <AssignmentSubmissionProvider assignment_uuid={assignment?.assignment_uuid}>
                                      <AssignmentStudentActivity />
                                    </AssignmentSubmissionProvider>
                                  </AssignmentsTaskProvider>
                                </AssignmentProvider>
                              ) : (
                                <div></div>
                              )}
                            </>
                          )}
                        </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Bottom spacing */}
          <div className="h-24"></div>
        </div>
      </CourseProvider>
    </>
  )
}

export function MarkStatus(props: {
  activity: any
  activityid: string
  course: any
  orgslug: string
}) {
  const router = useRouter()
  const session = useSokratesSession() as any;
  const isMobile = useMediaQuery('(max-width: 768px)')
  const accessToken = session?.data?.tokens?.access_token
  const { data: trail, mutate: mutateTrail } = useSWR(
    accessToken ? `${getAPIUrl()}trail` : null,
    (url: string) => swrFetcher(url, accessToken)
  )
  const [isMarking, setIsMarking] = React.useState(false)
  const [completedOverride, setCompletedOverride] = React.useState<boolean | null>(null)

  const courseForProgress = React.useMemo(() => {
    if (!trail) {
      return props.course
    }
    return { ...props.course, trail }
  }, [props.course, trail])
  const isCompleted =
    completedOverride ??
    isActivityDone(
      courseForProgress,
      props.activity?.activity_uuid ?? props.activityid ?? props.activity?.id
    )

  // TODO: hit this route from the workspace!
  async function markActivityAsCompleteFront() {
    if (isMarking || isCompleted) {
      return
    }
    setIsMarking(true)
    try {
      await markActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        'activity_' + props.activityid,
        accessToken
      )
      setCompletedOverride(true)
      if (mutateTrail) {
        await mutateTrail()
      }
      router.refresh()
    } finally {
      setIsMarking(false)
    }
  }

  const isDynamicPage =
    props.activity?.activity_type === 'TYPE_DYNAMIC' ||
    props.activity?.activity_sub_type === 'SUBTYPE_DYNAMIC_PAGE'

  if (isDynamicPage) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={markActivityAsCompleteFront}
          disabled={isCompleted || isMarking}
          className={cn(
            'rounded-full px-5 py-2 text-xs font-bold shadow-sm transition flex items-center gap-2',
            isCompleted
              ? 'bg-emerald-600 text-white cursor-not-allowed'
              : isMarking
                ? 'bg-gray-700 text-white cursor-not-allowed'
                : 'bg-gray-800 text-white hover:bg-gray-700'
          )}
        >
          {isMarking ? <Loader2 size={17} className="animate-spin" /> : <Check size={17}></Check>}
          {!isMobile && (
            <span>{isCompleted ? 'Completed' : isMarking ? 'Marking...' : 'Mark as complete'}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <>
      {isCompleted ? (
        <div className="bg-emerald-600 rounded-full px-5 drop-shadow-md flex items-center space-x-2 p-2.5 text-white cursor-not-allowed transition delay-150 duration-300 ease-in-out">
          <i>
            <Check size={17}></Check>
          </i>{' '}
          <i className="not-italic text-xs font-bold">Completed</i>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            'bg-gray-800 rounded-full px-5 drop-shadow-md flex items-center space-x-2 p-2.5 text-white transition delay-150 duration-300 ease-in-out',
            isMarking ? 'opacity-80 cursor-not-allowed' : 'hover:cursor-pointer'
          )}
          onClick={isMarking ? undefined : markActivityAsCompleteFront}
          disabled={isMarking}
        >
          <i>
            {isMarking ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Check size={17}></Check>
            )}
          </i>{' '}
          {!isMobile && (
            <i className="not-italic text-xs font-bold">
              {isMarking ? 'Marking...' : 'Mark as complete'}
            </i>
          )}
        </button>
      )}
    </>
  )
}

function AssignmentTools(props: {
  activity: any
  activityid: string
  course: any
  orgslug: string
  assignment: any
}) {
  const submission = useAssignmentSubmission() as any
  const session = useSokratesSession() as any;
  const [finalGrade, setFinalGrade] = React.useState(null) as any;
  const assignmentUUID = props.assignment?.assignment_uuid
  const userId = session.data?.user?.id
  const accessToken = session.data?.tokens?.access_token

  const submitForGradingUI = async () => {
    if (props.assignment) {
      const res = await submitAssignmentForGrading(
        props.assignment?.assignment_uuid,
        session.data?.tokens?.access_token
      )
      if (res.success) {
        toast.success('Assignment submitted for grading')
        mutate(`${getAPIUrl()}assignments/${props.assignment?.assignment_uuid}/submissions/me`,)
      }
      else {
        toast.error('Failed to submit assignment for grading')
      }
    }
  }

  const getGradingBasedOnMethod = React.useCallback(async () => {
    const res = await getFinalGrade(
      userId,
      assignmentUUID,
      accessToken
    );

    if (res.success) {
      const { grade, max_grade, grading_type } = res.data;
      let displayGrade;

      switch (grading_type) {
        case 'ALPHABET':
          displayGrade = convertNumericToAlphabet(grade, max_grade);
          break;
        case 'NUMERIC':
          displayGrade = `${grade}/${max_grade}`;
          break;
        case 'PERCENTAGE':
          const percentage = (grade / max_grade) * 100;
          displayGrade = `${percentage.toFixed(2)}%`;
          break;
        default:
          displayGrade = 'Unknown grading type';
      }

      // Use displayGrade here, e.g., update state or display it
      setFinalGrade(displayGrade);
    } else {
    }
  }, [assignmentUUID, accessToken, userId]);

  // Helper function to convert numeric grade to alphabet grade
  function convertNumericToAlphabet(grade: any, maxGrade: any) {
    const percentage = (grade / maxGrade) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  useEffect(() => {
    if (submission && submission.length > 0 && submission[0].submission_status === 'GRADED') {
      getGradingBasedOnMethod();
    }
  }, [submission, getGradingBasedOnMethod])

  if (!submission || submission.length === 0) {
    return (
      <ConfirmationModal
        confirmationButtonText="Submit Assignment"
        confirmationMessage="Are you sure you want to submit your assignment for grading? Once submitted, you will not be able to make any changes."
        dialogTitle="Submit your assignment for grading"
        dialogTrigger={
          <div className="bg-cyan-800 rounded-full px-5 drop-shadow-md flex items-center space-x-2 p-2.5 text-white hover:cursor-pointer transition delay-150 duration-300 ease-in-out">
            <BookOpenCheck size={17} />
            <span className="text-xs font-bold">Submit for grading</span>
          </div>
        }
        functionToExecute={submitForGradingUI}
        status="info"
      />
    )
  }

  if (submission[0].submission_status === 'SUBMITTED') {
    return (
      <div className="bg-amber-800 rounded-full px-5 drop-shadow-md flex items-center space-x-2 p-2.5 text-white transition delay-150 duration-300 ease-in-out">
        <UserRoundPen size={17} />
        <span className="text-xs font-bold">Grading in progress</span>
      </div>
    )
  }

  if (submission[0].submission_status === 'GRADED') {
    return (
      <div className="bg-teal-600 rounded-full px-5 drop-shadow-md flex items-center space-x-2 p-2.5 text-white transition delay-150 duration-300 ease-in-out">
        <CheckCircle size={17} />
        <span className="text-xs flex space-x-2 font-bold items-center"><span>Graded </span> <span className='bg-white text-teal-800 px-1 py-0.5 rounded-md'>{finalGrade}</span></span>
      </div>
    )
  }

  // Default return in case none of the conditions are met
  return null
}

export default ActivityClient
