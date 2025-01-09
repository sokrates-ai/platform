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
import { Hexagon, MousePointer } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter'
import { useLHSession } from '@components/Contexts/LHSessionContext'

import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

//
// Sigma.js
//

import Graph from "graphology";
import { useSigma, SigmaContainer, useLoadGraph, useRegisterEvents } from "@react-sigma/core";
import "@react-sigma/core/lib/react-sigma.min.css";
import { useWorkerLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import { useLayoutCircular } from "@react-sigma/layout-circular";
import styled from 'styled-components'
const sigmaStyle = { height: "100%", width: "100%", 'background-color': 'transparent'};

type DisplayGraphProps = {
    chapters: any[]
    setChapterID: Function
    chapterID: number,
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
            graph.addDirectedEdge(from, to, { size: 3 })
        }
    }

    loadGraph(graph);
    assign();
  }, [loadGraph]);

  return null;
};

export const NewGraph = (props: DisplayGraphProps) => {
    const initialNodes = []
    for (let i = 0; i < props.chapters.length; i++) {
        const current = props.chapters[i]
        console.log(current)

        initialNodes.push({
            id: `${current.id}`,
            position: {
                x: 10,
                y: i * 100,
            },
            data: {
                label: current.name
            }
        })
    }

    // [
    //     { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
    //     { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
    // ];

    const initialEdges = [];
    for (let chapter of props.chapters) {
        for (let pred of chapter.predecessors) {
            // console.log(`PRED=${pred}`)
            let from = pred
            let to = chapter.id
            // console.log(from, to)
            // graph.addDirectedEdge(from, to, { size: 3 })
            initialEdges.push({
                id: `${from}:${to}`,
                source: `${from}`,
                target: `${to}`,
            })
        }
    }
    // const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

    return (
    <ReactFlow nodes={initialNodes} edges={initialEdges} />
    )
}

export const DisplayGraph = (props: DisplayGraphProps) => {
 const GraphEvents = () => {
    const sigma = useSigma();

    useEffect(() => {
      const handleNodeClick = (event: any) => {
        const { node } = event;
        const nodeClicked = parseInt(node)
        // console.log("Node clicked:", nodeClicked);
        props.setChapterID(nodeClicked)
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
      <LoadGraph chapters={props.chapters} setChapterID={props.setChapterID} chapterID={props.chapterID} />
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

const BlurVignette = styled.div`
  --radius: 44px;
  --inset: 18px;
  --transition-length: 60px;
  --blur: 50px;


  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  -webkit-backdrop-filter: blur(var(--blur));
  backdrop-filter: blur(var(--blur));
  --r: max(var(--transition-length), calc(var(--radius) - var(--inset)));
  --corner-size: calc(var(--r) + var(--inset)) calc(var(--r) + var(--inset));
  --corner-gradient: transparent 0px,
    transparent calc(var(--r) - var(--transition-length)), black var(--r);
  --fill-gradient: black, black var(--inset),
    transparent calc(var(--inset) + var(--transition-length)),
    transparent calc(100% - var(--transition-length) - var(--inset)),
    black calc(100% - var(--inset));
  --fill-narrow-size: calc(100% - (var(--inset) + var(--r)) * 2);
  --fill-farther-position: calc(var(--inset) + var(--r));
  -webkit-mask-image: linear-gradient(to right, var(--fill-gradient)),
    linear-gradient(to bottom, var(--fill-gradient)),
    radial-gradient(at bottom right, var(--corner-gradient)),
    radial-gradient(at bottom left, var(--corner-gradient)),
    radial-gradient(at top left, var(--corner-gradient)),
    radial-gradient(at top right, var(--corner-gradient));
  -webkit-mask-size: 100% var(--fill-narrow-size), var(--fill-narrow-size) 100%,
    var(--corner-size), var(--corner-size), var(--corner-size),
    var(--corner-size);
  -webkit-mask-position: 0 var(--fill-farther-position), var(--fill-farther-position) 0,
    0 0, 100% 0, 100% 100%, 0 100%;
  -webkit-mask-repeat: no-repeat;
`;

const EditCourseStructure = (props: EditCourseStructureProps) => {
  // TODO: typing?
  const [chapterID, setChapterID] = useState(-1);

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
  if (!course_structure || !course_structure.chapters) return <PageLoading></PageLoading>

  const currentChapter = course_structure.chapters.find((c: any) => {
      const matches = c.id === chapterID
      // console.log(typeof c.id, typeof chapterID)
      // console.log(`c.id=${c.id}, chapterID=${chapterID} | chap=${JSON.stringify(c)} | matches=${matches}`)
      return matches
  })


  return (
    <div className="flex flex-row h-full">

    <div className='flex flex-col justify-center h-full w-2/5'>
      { /* <DisplayGraph chapters={course_structure.chapters} setChapterID={setChapterID} chapterID={chapterID}/> */}
      <NewGraph chapters={course_structure.chapters} setChapterID={setChapterID} chapterID={chapterID} />

      <div>
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
            <div className="w-44 mt-10 py-5 max-w-screen-2xl mx-auto bg-cyan-800 text-white rounded-xl shadow-sm px-6 items-center flex flex-row h-10">
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
      </div>
    </div>

       <div className='w-3/5 p-10 bg-gray-200'>
      {winReady && currentChapter ? (

        <DragDropContext onDragEnd={updateStructure}>
        <ChapterElement
            key={ currentChapter.chapter_uuid}
            chapterIndex={0}
            orgslug={props.orgslug}
            course_uuid={course_uuid}
            chapter={currentChapter}
        />
        </DragDropContext>
      ) : (
        <div className='flex flex-col justify-center items-center h-full'>

            <MousePointer className='text-gray-400 mb-3' size={80} />

            <h2 className='text-gray-500 text-4xl mb-3'>
                No Chapter Selected
            </h2>

            <h6 className='text-gray-400 text-2xl'>
                Use the content graph on the left to select a chapter.
            </h6>
        </div>
      )}
    </div>
</div>
  )
}

export default EditCourseStructure
