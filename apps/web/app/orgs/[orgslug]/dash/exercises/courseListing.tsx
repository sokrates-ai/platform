import Modal from "@components/Objects/StyledElements/Modal/Modal"
import ExerciseThumbnail from "@components/Objects/Thumbnails/ExerciseThumbnail"
import AuthenticatedClientElement from "@components/Security/AuthenticatedClientElement"
import { prependOnceListener } from "process"

interface CourseListingProps {
    isUserAdmin: boolean,
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
    if (!props.exercises || !props.tags || !props.courses) {
        return <div>Loading...</div>
    }

    if (props.exercises.length > 0) {
        return (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" >{
            props.exercises.filter((exercise: any) => exercise.course_id === props.course_id).map((exercise: any) => {
                const tags = props.tags.filter((tag: any) => exercise.tags.find((tag2: any) => tag2 === tag.value))
                console.log('tags', tags)
                return (<div key={exercise.id}>
                    <ExerciseThumbnail
                        // customLink={`/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`}
                        // course={course}
                        orgId={props.org.id}
                        orgslug={props.orgslug}
                        exercise={exercise}
                        mutateURL={props.TASKS_URL}
                        tags={tags}
                        courses={props.courses}
                    />
                </div>)
            })
        }</div>)
    }

    return (<div>{
        (
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
                        No exercises yet
                    </h2>
                    <p className="text-lg text-gray-400">
                        {props.isUserAdmin ? (
                            "Create an exercise to add content"
                        ) : (
                            "No exercise available yet"
                        )}
                    </p>
                </div>
            </div>
        )
    }</div>)
}

export default CourseListing;