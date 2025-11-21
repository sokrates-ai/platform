import { useTranslations } from 'next-intl'
import ExerciseThumbnail from '@components/Objects/Thumbnails/ExerciseThumbnail'

interface CourseListingProps {
  isUserAdmin: boolean
  exercises: any[]
  tags: any[]
  courses: any[]
  org: any
  orgslug: string
  TASKS_URL: string
  COURSES_URL: string
  TAGS_URL: string
  course_id: number
}

const CourseListing = (props: CourseListingProps) => {
  const t = useTranslations('CourseListing')

  if (!props.exercises || !props.tags || !props.courses) {
    return <div>{t('loading')}</div>
  }

  let filteredExercises = props.exercises.filter(
    (exercise: any) => exercise.course_id === props.course_id
  )
  if (props.course_id === -1) {
    filteredExercises = props.exercises.filter(
      (exercise: any) => exercise.course_id === null
    )
  }

  if (filteredExercises.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredExercises.map((exercise: any) => {
          return (
            <div key={exercise.id}>
              <ExerciseThumbnail
                orgId={props.org.id}
                orgslug={props.orgslug}
                exercise={exercise}
                mutateURL={props.TASKS_URL}
                tags={props.tags}
                courses={props.courses}
              />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      <div className="col-span-full flex justify-center items-center py-8">
        <div className="text-center">
          <div className="mb-4">
            <svg
              width="120"
              height="120"
              viewBox="0 0 295 295"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto"
            >
              {/* ... SVG content ... */}
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-600 mb-2">
            {t('noExercisesYet')}
          </h2>
          <p className="text-lg text-gray-400">
            {props.isUserAdmin
              ? t('createExerciseToAddContent')
              : t('noExerciseAvailableYet')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default CourseListing
