'use client'
import { getAPIUrl } from '@services/config/config'
import { revalidateTags } from '@services/utils/ts/requests'
import React, { useEffect, useState, FC, useCallback } from 'react'
import { DragDropContext, Droppable } from 'react-beautiful-dnd'
import { mutate } from 'swr'
import ChapterElement from './DraggableElements/ChapterElement'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { createChapter, updateChapterEdge } from '@services/courses/chapters'
import { useRouter } from 'next/navigation'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import { Hexagon, MousePointer } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter'
import { useLHSession } from '@components/Contexts/LHSessionContext'

import dagre from 'dagre';
import { Background, BackgroundVariant, Controls, MiniMap, addEdge, useEdgesState, useNodesState } from '@xyflow/react';
const ReactFlow = dynamic(() => import('@xyflow/react').then((mod) => mod.ReactFlow), {
  ssr: false,
});
import '@xyflow/react/dist/style.css';
import './graph.css';

import styled from 'styled-components'
import dynamic from 'next/dynamic'
const sigmaStyle = { height: "100%", width: "100%", 'background-color': 'transparent'};

type DisplayGraphProps = {
    chapters: any[]
    setChapterID: Function
    chapterID: number,
}


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

export type ChapterEdgeModification =
  | {
        from_chapter_id: number,
        to_chapter_id: number,
        delete: boolean,
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

  // Submit new chapter.
  const submitChapter = async (chapter: any) => {
    const res = await createChapter(chapter,access_token)
    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    setNewChapterModal(false)
    course_structure.chapters.push(chapter)
  }

  // Add / remove chapter edges.
  // TODO: use this.
  const modifyChapterEdge = async (fromChapterID: number, toChapterID: number, deleteEdge: boolean) => {
    const res = await updateChapterEdge(course_uuid, {
        from_chapter_id: fromChapterID,
        to_chapter_id: toChapterID,
        delete: deleteEdge,
    },access_token)

    console.log(res)

    mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    setNewChapterModal(false)

    const thisChapterIndex = course_structure.chapters.findIndex((c: any) => c.id === toChapterID)
    if (!deleteEdge) {
        course_structure.chapters[thisChapterIndex].predecessors.push(fromChapterID)
    } else {
        course_structure.chapters[thisChapterIndex].predecessors = course_structure.chapters[thisChapterIndex].predecessors.filter((p: number) => p != fromChapterID)
    }
  }

  // TODO: refactor this -> remove old, redundant chapter reordering.
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

  //
  // GRAPH.
  //

const NewGraph = (props: DisplayGraphProps) => {
    const initialNodes: any = []
    const initialEdges: any = [];

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // State to track if layout has been applied.
    const [isLayouted, setIsLayouted] = useState(false);

    // For node position animations.
    const [isAnimating, setIsAnimating] = useState(false);

    // Prevent double animation.
    const [layoutApplied, setLayoutApplied] = useState(false); // Track if the layout is already applied

    for (let i = 0; i < props.chapters.length; i++) {
        const current = props.chapters[i]

        initialNodes.push({
            id: `${current.id}`,
            position: {
                x: 0,
                y: 0
            },
            data: {
                label: current.name
            },
            draggable: true,
        })
    }

    for (let chapter of props.chapters) {
        if (!chapter.predecessors)
            continue
        for (let pred of chapter.predecessors) {
            let from = pred
            let to = chapter.id
            initialEdges.push({
                id: `${from}:${to}`,
                source: `${from}`,
                target: `${to}`,
            })
        }
    }

    //
    // Auto layout with dagre.
    //

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 150;
    const nodeHeight = 50;

    const getLayoutedNodesAndEdges = (nodes: any[], edges: any[], direction = 'TB') => {
        dagreGraph.setGraph({ rankdir: direction }); // TB (top-bottom), LR (left-right)

        // Add nodes to Dagre graph
        nodes.forEach((node: any) => {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        });

        // Add edges to Dagre graph
        edges.forEach((edge: any) => {
            dagreGraph.setEdge(edge.source, edge.target);
        });

        // Run Dagre layout
        dagre.layout(dagreGraph);

        // Update node positions
        const layoutedNodes = nodes.map((node: any) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2, // Center the node
                y: nodeWithPosition.y - nodeHeight / 2,
            },
            };
        });

        return { nodes: layoutedNodes, edges };
    };

    const onLayout = useCallback(() => {
        // Only apply layout if it's not already applied to avoid the animation running twice.
        if (layoutApplied) {
            console.log('layout was applied')
            return
        }

        console.log("ON LAYOUT")

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedNodesAndEdges(
            nodes,
            edges,
            'TB' // Change to 'LR' for left-to-right layout
        );

        setIsAnimating(true);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

        // Set layout applied.
        setLayoutApplied(true);

        // Remove animation class after animation duration.
        setTimeout(() => {
            setIsAnimating(false);
        }, 500); // Match with animation duration.
    }, [nodes, edges, setLayoutApplied, setNodes, setEdges, setIsAnimating]);

    //
    // End auto layout.
    //

    // const nodeChangeWrapper = useCallback(
    //     async (params: any[])  => {
    //         console.log(params)
    //
    //         for (let event of params) {
    //             if (event.type === 'position') {
    //                 console.log('layout not applied')
    //                 setLayoutApplied(false)
    //             }
    //         }
    //
    //         onNodesChange(params)
    //     },
    //     [setNodes]
    // )

    const onNodeClick = useCallback((event: any, node: any) => {
        console.log('Node selected:', node);
        props.setChapterID(parseInt(node.id))
        // Perform additional actions here
    }, []);

    // TODO: how am I going to attach an error message in case this thing dies?
    const onEdgesChangeWrapped = useCallback(
        async (params: any)  => {
            const _type = params[0].type
            const isDelete = params[0].type === "remove"

            if (!isDelete) {
                console.warn(`EDGE CHANGE HANDLER: not called due to deletion; returning early (${_type})`)
                onEdgesChange(params)
                return
            }

            const id: string = params[0].id

            const idSplit = id.split(':')

            if (idSplit.length !== 2) {
                throw(`Edge ID split does not contain 2 elements; giving up (${idSplit})`)
            }

            const fromID = parseInt(idSplit[0])
            const toID = parseInt(idSplit[1])
            console.log(`ID: ${id} | from=${fromID} | to=${toID}`)

            console.log("edges wrapped", params[0], id, isDelete)

            let res = await modifyChapterEdge(
                fromID,
                toID,
                true,
            )

            console.log(res)

            onEdgesChange(params)
        },
        [setEdges]
    )

    const onConnect = useCallback(
        async (params: any) => {
            console.log('on connect', params)

            const fromNodeID = parseInt(params.source)
            const toNodeID = parseInt(params.target)

            let res = await modifyChapterEdge(
                fromNodeID,
                toNodeID,
                false,
            )

            console.log(res)

            setEdges((eds) => addEdge(params, eds))
        },
        [setEdges],
    );

    const onNodesDelete = useCallback((nodesToDelete: any) => {
        console.log('Attempt to delete nodes:', nodesToDelete);
        // Suppress node deletion
    }, []);

    // Run the auto-layout once the graph loads.
    // Only run once to prevent cycle.
    useEffect(() => {
        if (!isLayouted) {
            console.log("INITIAL")
            onLayout();
            setIsLayouted(true); // Ensure the layout is only applied once
        }
    }, [onLayout, setIsLayouted]);

    return (
        <ReactFlow
            nodes={nodes.map((node) => ({
                ...node,
                className: isAnimating ? 'position-transition' : '', // Add / Remove animation class.
            }))}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodesDelete={onNodesDelete}
            onEdgesChange={onEdgesChangeWrapped}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodesDraggable={true}
            fitView
            //deleteKeyCode={null} // Disable delete key
        >
            <Controls
                style={{
                    background: 'rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(2px)',
                    borderRadius: '0.4rem',
                    border: "2px solid rgba(0, 0, 0, 0.1)",
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px',
                    gap: '10px', // Adds spacing between controls
                }}
            >
                {/* Custom Auto Layout Button */}
                <button
                    onClick={onLayout}
                    style={{
                        background: '#007BFF',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'center',
                    }}
                >
                    Auto Layout
                </button>
            </Controls>
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
    )
}

  //
  // END GRAPH.
  //

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
