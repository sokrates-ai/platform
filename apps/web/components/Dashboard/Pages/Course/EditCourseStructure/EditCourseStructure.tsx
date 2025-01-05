'use client'
import { getAPIUrl } from '@services/config/config'
import { revalidateTags } from '@services/utils/ts/requests'
import React, { useEffect, useState, FC } from 'react'
import { DragDropContext, Droppable } from 'react-beautiful-dnd'
import { mutate } from 'swr'
import ChapterElement from './DraggableElements/ChapterElement'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { createChapter } from '@services/courses/chapters'
import { useRouter } from 'next/navigation'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import { Hexagon } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter'
import { useLHSession } from '@components/Contexts/LHSessionContext'

//
// Sigma.js
//

import Graph from "graphology";
import { useSigma, SigmaContainer, useLoadGraph, useRegisterEvents } from "@react-sigma/core";
import "@react-sigma/core/lib/react-sigma.min.css";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { useLayoutCircular } from "@react-sigma/layout-circular";
const sigmaStyle = { height: "500px", width: "100%" };

type DisplayGraphProps = {
    chapters: any[]
}

const Fa2: FC = () => {
  const { start, kill } = useWorkerLayoutForceAtlas2({ settings: { slowDown: 10 } });

  useEffect(() => {
    // start FA2
    start();

    setTimeout(kill, 500)

    // Kill FA2 on unmount
    return () => {
      kill();
    };
  }, [start, kill]);

  return null;
};

export const LoadGraph = (props: DisplayGraphProps) => {
  const loadGraph = useLoadGraph();
  const { assign } = useLayoutCircular();

  const sigma = useSigma();

  useEffect(() => {
    const graph = new Graph();

    for (let chapter of props.chapters) {
        console.log(chapter)
        graph.addNode(chapter.id, { x: 0, y: 0, size: 15, label: chapter.name, color: "#FA4F40" });
    }

    for (let chapter of props.chapters) {
        for (let pred of chapter.predecessors) {
            console.log(`PRED=${pred}`)
            let from = pred
            let to = chapter.id
            console.log(from, to)
            graph.addDirectedEdge(from, to, { size: 2 })
        }
    }

    loadGraph(graph);
    assign();
  }, [loadGraph]);

  return null;
};

export const DisplayGraph = (props: DisplayGraphProps) => {
 const GraphEvents = () => {
    const sigma = useSigma();

    useEffect(() => {
      const handleNodeClick = (event: any) => {
        const { node } = event;
        console.log("Node clicked:", node);
        // Perform your actions here
      };

      // Register the clickNode event
      sigma.on("clickNode", handleNodeClick);

      // Cleanup to avoid memory leaks
      return () => {
        sigma.off("clickNode", handleNodeClick);
      };
    }, [sigma]);

    return null; // No UI, just event handling
  };

  return (
    <SigmaContainer style={sigmaStyle} settings={{ allowInvalidContainer: true }} >
      <LoadGraph chapters={props.chapters} />
      <GraphEvents/>
      <Fa2></Fa2>
    </SigmaContainer>
  );
};

//
// End sigma.js
//


type EditCourseStructureProps = {
  orgslug: string
  course_uuid?: string
}

export type OrderPayload =
  | {
      chapter_order_by_ids: [
        {
          chapter_id: string
          activities_order_by_ids: [
            {
              activity_id: string
            },
          ]
        },
      ]
    }
  | undefined

const EditCourseStructure = (props: EditCourseStructureProps) => {
  const router = useRouter()
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  // Check window availability
  const [winReady, setwinReady] = useState(false)

  const dispatchCourse = useCourseDispatch() as any

  const [order, setOrder] = useState<OrderPayload>()
  const course = useCourse() as any
  const course_structure = course ? course.courseStructure : {}
  const course_uuid = course ? course.courseStructure.course_uuid : ''

  // New Chapter creation
  const [newChapterModal, setNewChapterModal] = useState(false)

  const closeNewChapterModal = async () => {
    setNewChapterModal(false)
  }

  // Submit new chapter
  const submitChapter = async (chapter: any) => {
    await createChapter(chapter,access_token)
    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    setNewChapterModal(false)
  }

  const updateStructure = (result: any) => {
    const { destination, source, draggableId, type } = result
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )
      return
    if (type === 'chapter') {
      const newChapterOrder = Array.from(course_structure.chapters)
      newChapterOrder.splice(source.index, 1)
      newChapterOrder.splice(
        destination.index,
        0,
        course_structure.chapters[source.index]
      )
      dispatchCourse({
        type: 'setCourseStructure',
        payload: { ...course_structure, chapters: newChapterOrder },
      })
      dispatchCourse({ type: 'setIsNotSaved' })
    }
    if (type === 'activity') {
      const newChapterOrder = Array.from(course_structure.chapters)
      const sourceChapter = newChapterOrder.find(
        (chapter: any) => chapter.chapter_uuid === source.droppableId
      ) as any
      const destinationChapter = newChapterOrder.find(
        (chapter: any) => chapter.chapter_uuid === destination.droppableId
      )
        ? newChapterOrder.find(
            (chapter: any) => chapter.chapter_uuid === destination.droppableId
          )
        : sourceChapter
      const activity = sourceChapter.activities.find(
        (activity: any) => activity.activity_uuid === draggableId
      )
      sourceChapter.activities.splice(source.index, 1)
      destinationChapter.activities.splice(destination.index, 0, activity)
      dispatchCourse({
        type: 'setCourseStructure',
        payload: { ...course_structure, chapters: newChapterOrder },
      })
      dispatchCourse({ type: 'setIsNotSaved' })
    }
  }

  useEffect(() => {
    setwinReady(true)
  }, [props.course_uuid, course_structure, course])

  if (!course) return <PageLoading></PageLoading>

  return (
    <div className="flex flex-col">

      <DisplayGraph chapters={course_structure.chapters}/>

      <div className="h-6"></div>
      {winReady ? (
        <DragDropContext onDragEnd={updateStructure}>
          <Droppable type="chapter" droppableId="chapters">
            {(provided) => (
              <div
                className="space-y-4"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {course_structure.chapters &&
                  course_structure.chapters.map((chapter: any, index: any) => {
                    return (
                      <ChapterElement
                        key={chapter.chapter_uuid}
                        chapterIndex={index}
                        orgslug={props.orgslug}
                        course_uuid={course_uuid}
                        chapter={chapter}
                      />

                    )
                  })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* New Chapter Modal */}
          <Modal
            isDialogOpen={newChapterModal}
            onOpenChange={setNewChapterModal}
            minHeight="sm"
            dialogContent={
              <NewChapterModal
                course={course ? course.courseStructure : null}
                closeModal={closeNewChapterModal}
                submitChapter={submitChapter}
              ></NewChapterModal>
            }
            dialogTitle="Create chapter"
            dialogDescription="Add a new chapter to the course"
            dialogTrigger={
              <div className="w-44 my-16 py-5 max-w-screen-2xl mx-auto bg-cyan-800 text-white rounded-xl shadow-sm px-6 items-center flex flex-row h-10">
                <div className="mx-auto flex space-x-2 items-center hover:cursor-pointer">
                  <Hexagon
                    strokeWidth={3}
                    size={16}
                    className="text-white text-sm "
                  />
                  <div className="font-bold text-sm">Add Chapter</div>
                </div>
              </div>
            }
          />
        </DragDropContext>
      ) : (
        <></>
      )}
    </div>
  )
}

export default EditCourseStructure
