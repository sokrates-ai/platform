'use client'
import { getAPIUrl } from '@services/config/config'
import { revalidateTags } from '@services/utils/ts/requests'
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { DragDropContext } from 'react-beautiful-dnd'
import { mutate } from 'swr'
import ChapterElement from './DraggableElements/ChapterElement'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { createChapter, updateChapterEdge } from '@services/courses/chapters'
import { useRouter } from 'next/navigation'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import { Hexagon, X } from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { AnimatePresence, motion } from 'framer-motion'

import dagre from 'dagre';
import { Background, BackgroundVariant, Handle, MarkerType, MiniMap, NodeProps, Position, addEdge, useEdgesState, useNodesState, Node, Edge } from '@xyflow/react';
const ReactFlow = dynamic(() => import('@xyflow/react').then((mod) => mod.ReactFlow), {
  ssr: false,
});
import '@xyflow/react/dist/style.css';
import './graph.css';

import styled from 'styled-components'
import dynamic from 'next/dynamic'
import { Button } from "@components/ui/button";
import { Card, CardContent } from '@components/ui/card';
import { CourseTab, CourseTabSelector } from '@components/Objects/Modals/Course/Create/CourseTabSelector';

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------

type DisplayGraphProps = {
    chapters: any[]
    setChapterID: Function
    chapterID: number,
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

// -----------------------------------------------------------------------------
// STYLED COMPONENTS
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

type EditCourseStructureProps = {
  orgslug: string;
  course_uuid?: string;
  tabs: CourseTab[];
  selectedTabId: string;
  onTabsChange: (tabs: CourseTab[]) => void;
  onTabChange: (tabId: string) => void;
  tabContent: {
    chapters: any[];
  };
  onTabContentChange: (tabId: string, chapters: any[]) => void;
};

const EditCourseStructure = (props: EditCourseStructureProps) => {
  const {
    tabs,
    selectedTabId,
    onTabsChange,
    onTabChange,
    tabContent,
    onTabContentChange,
  } = props;
  // Local state management ----------------------------------------------------
  const [chapterID, setChapterID] = useState(-1);
  const [winReady, setWinReady] = useState(false);
  const [newChapterModal, setNewChapterModal] = useState(false);
  const [order, setOrder] = useState<OrderPayload>();
  const [triggerAutoLayout, setTriggerAutoLayout] = useState(false);

  // External hooks ------------------------------------------------------------
  const router = useRouter();
  const session = useSokratesSession() as any;  const access_token = session?.data?.tokens?.access_token;

  const course = useCourse() as any;
  const course_structure = course ? course.courseStructure : {};
  const course_uuid = course ? course.courseStructure.course_uuid : '';
  const dispatchCourse = useCourseDispatch() as any;
  const tabChapters = tabContent?.chapters ?? [];

  // Refs for ReactFlow instance and container
  const reactFlowRef = React.useRef<HTMLDivElement>(null) as React.MutableRefObject<HTMLDivElement | null>;
  const reactFlowInstanceRef = React.useRef<any>(null) as React.MutableRefObject<any>;

  // ---------------------------------------------------------------------------
  // CHAPTER CRUD OPERATIONS
  // ---------------------------------------------------------------------------

  const closeNewChapterModal = async () => setNewChapterModal(false);

  const submitChapter = async (chapter: any) => {
    const chapterPayload = {
      ...chapter,
      tab_uuid: selectedTabId,
    };
    await createChapter(chapterPayload, access_token);
    mutate(`${getAPIUrl()}courses/${course_uuid}/meta`);
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
    setNewChapterModal(false);
    // Optimistic UI update so the node appears immediately
    const nextChapters = [
      ...tabChapters,
      {
        ...chapterPayload,
        activities: Array.isArray(chapter.activities) ? [...chapter.activities] : [],
      },
    ];
    onTabContentChange(selectedTabId, nextChapters);
  };

  const modifyChapterEdge = async (
    fromChapterID: number,
    toChapterID: number,
    deleteEdge: boolean,
  ) => {
    await updateChapterEdge(
      course_uuid,
      {
        from_chapter_id: fromChapterID,
        to_chapter_id: toChapterID,
        delete: deleteEdge,
      },
      access_token,
    );

    mutate(`${getAPIUrl()}courses/${course_uuid}/meta`);
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();

    const updatedChapters = tabChapters.map((chapter: any) => {
      if (chapter.id !== toChapterID) {
        return chapter;
      }
      const nextPredecessors = deleteEdge
        ? chapter.predecessors.filter((p: number) => p !== fromChapterID)
        : [...chapter.predecessors, fromChapterID];
      return {
        ...chapter,
        predecessors: Array.from(new Set(nextPredecessors)),
      };
    });
    onTabContentChange(selectedTabId, updatedChapters);
  };

  // ---------------------------------------------------------------------------
  // LEGACY DRAG‑AND‑DROP ORDERING (kept for list view)
  // ---------------------------------------------------------------------------

  const updateStructure = (result: any) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

  if (type === 'chapter') {
      const newChapterOrder = [...tabChapters];
      const [moved] = newChapterOrder.splice(source.index, 1);
      if (moved) {
        newChapterOrder.splice(destination.index, 0, moved);
        onTabContentChange(selectedTabId, newChapterOrder);
        dispatchCourse({ type: 'setIsNotSaved' });
      }
    }

    if (type === 'activity') {
      const newChapterOrder = tabChapters.map((chapter: any) => ({
        ...chapter,
        activities: [...(chapter.activities ?? [])],
      }));
      const sourceChapter = newChapterOrder.find((c: any) => c.chapter_uuid === source.droppableId) as any;
      const destinationChapter = newChapterOrder.find((c: any) => c.chapter_uuid === destination.droppableId) ?? sourceChapter;
      if (!sourceChapter || !destinationChapter) return;
      const activity = sourceChapter.activities.find((a: any) => a.activity_uuid === draggableId);
      if (!activity) return;
      sourceChapter.activities.splice(source.index, 1);
      destinationChapter.activities.splice(destination.index, 0, activity);
      onTabContentChange(selectedTabId, newChapterOrder);
      dispatchCourse({ type: 'setIsNotSaved' });
    }
  };

  // ---------------------------------------------------------------------------
  // GRAPH COMPONENT (ReactFlow + Dagre)
  // ---------------------------------------------------------------------------

  const CustomNode: React.FC<NodeProps> = (props: any) => (
    <div
      className={`flex flex-col items-center bg-white shadow-md rounded-lg p-4 transform -translate-x-1/2 hover:shadow-lg transition-shadow ${props.selected ? 'border-indigo-600 ring-4 ring-indigo-200 selected-node' : 'border-gray-200'} border`}
      style={{ minWidth: '180px', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
    >
      <p className="font-medium text-center text-gray-800">{props.data.label}</p>
      <Handle type="source" position={Position.Bottom} className="w-8 h-8 bg-indigo-500 border-2 border-white" style={{ bottom: '-16px' }} />
      <Handle type="target" position={Position.Top} className="w-8 h-8 bg-gray-400 border-2 border-white" style={{ top: '-16px' }} />
    </div>
  );

  const NewGraph = ({ chapters, setChapterID, chapterID, reactFlowRef, reactFlowInstanceRef, triggerAutoLayout }: DisplayGraphProps & { reactFlowRef: React.MutableRefObject<HTMLDivElement | null>, reactFlowInstanceRef: React.MutableRefObject<any>, triggerAutoLayout: boolean }) => {
    // ----------------------- Local state ------------------------------------
    const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<any>>([]);
    const [graphError, setGraphError] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [layoutApplied, setLayoutApplied] = useState(false);

    // ----------------------- Dagre helpers ----------------------------------
    const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    const nodeWidth = 180;
    const nodeHeight = 80;

    const getLayouted = (n: any[], e: any[]) => {
      dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 150, edgesep: 80 });
      n.forEach((node: any) => dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }));
      e.forEach((edge: any) => dagreGraph.setEdge(edge.source, edge.target));
      dagre.layout(dagreGraph);
      const layoutedNodes = n.map((node: any) => {
        const { x, y } = dagreGraph.node(node.id);
        return {
          ...node,
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom,
          position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 },
        };
      });
      return { nodes: layoutedNodes, edges: e };
    };

    const onLayoutInternal = () => {
      if (!nodes.length) return;
      const { nodes: lNodes, edges: lEdges } = getLayouted(nodes, edges);
      setIsAnimating(true);
      setNodes(lNodes);
      setEdges(lEdges);
      setLayoutApplied(true);
      setTimeout(() => setIsAnimating(false), 500);
    };

    // ----------------------- Effects ----------------------------------------

    // (re)build graph elements whenever chapter data changes
    useEffect(() => {
      const newNodes = chapters.map((c: any) => ({
        id: `${c.id}`,
        type: 'customNode',
        position: { x: 0, y: 0 },
        data: { label: c.name, id: c.id },
        draggable: true,
      }));

      const newEdges: any = [];
      chapters.forEach((c: any) => {
        (c.predecessors || []).forEach((p: number) =>
          newEdges.push({
            id: `${p}:${c.id}`,
            source: `${p}`,
            target: `${c.id}`,
            markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
            style: { strokeWidth: 3, stroke: '#6366f1' },
            animated: true,
          }),
        );
      });

      setNodes(newNodes);
      setEdges(newEdges);
    }, [chapters]);

    // Highlight selected node without rebuilding layout
    const highlightedNodes = useMemo(() =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === String(chapterID),
        className: `${isAnimating ? 'position-transition' : ''} ${n.id === String(chapterID) ? 'selected-node' : ''}`,
      })),
      [nodes, chapterID, isAnimating]
    );

    // trigger auto‑layout only once after nodes are ready OR after chapters changed
    useEffect(() => {
      if (!layoutApplied && nodes.length) onLayoutInternal();
    }, [layoutApplied, nodes]);

    // trigger auto-layout when requested by parent (button click)
    useEffect(() => {
      if (triggerAutoLayout) {
        setLayoutApplied(false);
      }
    }, [triggerAutoLayout]);

    // ----------------------- ReactFlow handlers -----------------------------

    const hasRunRef = useRef(false);

    const onInit = (instance: any) => {
      (reactFlowInstanceRef as any).current = instance;
      // expose helpers for external toolbar
      if (reactFlowRef.current) {
        (reactFlowRef.current as any).onLayoutInternal = onLayoutInternal;
        (reactFlowRef.current as any).reactFlowInstanceRef = reactFlowInstanceRef;
      }
      // Only fitView on very first mount
      if (!hasRunRef.current) {
        instance.fitView({ duration: 400, padding: 0.2 });
        hasRunRef.current = true;
      }
    };

    const onNodeClick = (_: any, node: any) => setChapterID(Number(node.id));

    const onEdgesChangeWrapped = useCallback(
      async (params: any) => {
        const action = params[0];
        if (action.type !== 'remove') {
          onEdgesChange(params);
          return;
        }
        const [from, to] = action.id.split(':').map((v: string) => Number(v));
        await modifyChapterEdge(from, to, true);
        onEdgesChange(params);
      },
      [onEdgesChange],
    );

    const onConnect = useCallback(
      async (params: any) => {
        const fromID = Number(params.source);
        const toID = Number(params.target);
        try {
          await modifyChapterEdge(fromID, toID, false);
          setEdges((eds) =>
            addEdge(
              {
                ...params,
                markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20, color: '#6366f1' },
                animated: true,
                style: { strokeWidth: 3, stroke: '#6366f1' },
              },
              eds,
            ),
          );
        } catch (e: any) {
          if (e.message === 'Unprocessable Entity') {
            setGraphError('Cyclic dependency');
            setTimeout(() => setGraphError(null), 1000);
          }
        }
      },
      [setEdges],
    );

    const onNodesDelete = () => {} // prevent node deletion completely

    // ----------------------- Render -----------------------------------------

    return (
      <div className="h-full w-full" ref={reactFlowRef} data-graph-autolayout>
        <ReactFlow
          nodes={highlightedNodes}
          edges={edges}
          nodeTypes={useMemo(() => ({ customNode: CustomNode }), [])}
          onNodesChange={onNodesChange}
          onNodesDelete={onNodesDelete}
          onEdgesChange={onEdgesChangeWrapped}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onInit={onInit}
          nodesDraggable
          maxZoom={4}
          minZoom={1}
          style={{ borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}
          proOptions={{ hideAttribution: true }}
        >
          {/* mini status indicator */}
          <div
            className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-2 shadow-sm border border-gray-100"
            title={graphError ?? 'Graph semantics are valid'}
          >
            <div
              className={`w-3 h-3 rounded-full ${graphError ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ boxShadow: graphError ? '0 0 8px rgba(239, 68, 68, 0.6)' : '0 0 8px rgba(16, 185, 129, 0.6)' }}
            />
            <span className="text-xs font-medium text-gray-600">{graphError ? 'Error' : 'Valid'}</span>
          </div>

          <MiniMap
            nodeColor={() => '#6366f1'}
            maskColor="rgba(99,102,241,0.1)"
            style={{ bottom: 16, right: 16, top: 'auto', background: 'rgba(255,255,255,0.8)', borderRadius: '0.75rem', border: '1px solid rgba(229,231,235,1)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#6366f1" />
        </ReactFlow>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // LIFECYCLE / RENDER LOGIC FOR MAIN COMPONENT
  // ---------------------------------------------------------------------------

  useEffect(() => setWinReady(true), [props.course_uuid, tabChapters, course]);

  if (!course) return <PageLoading />;

  const currentChapter = tabChapters.find((c: any) => c.id === chapterID);
  const sidePanelOpen = winReady && currentChapter;

  useEffect(() => {
    if (!tabChapters.some((chapter: any) => chapter.id === chapterID)) {
      setChapterID(-1);
    }
  }, [tabChapters, chapterID]);

  return (
    <div className="relative flex h-full w-full overflow-hidden gap-6 px-6 py-6" data-selected-tab={selectedTabId}>
      <Card className="h-full w-64 shrink-0">
        <CardContent className="h-full overflow-hidden px-4 py-6">
          <CourseTabSelector
            className="h-full overflow-y-auto"
            tabs={tabs}
            activeTab={selectedTabId}
            onTabsChange={onTabsChange}
            onActiveTabChange={onTabChange}
            orientation="vertical"
            renderTabContent={() => null}
          />
        </CardContent>
      </Card>
      <div className="flex-1 overflow-hidden">
        {/* MAIN GRID */}
        <motion.div
          className="grid h-full w-full"
          animate={{ gridTemplateColumns: sidePanelOpen ? '1fr 0.6fr' : '1fr 0fr' }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          style={{ gridTemplateColumns: sidePanelOpen ? '1fr 0.6fr' : '1fr 0fr' }}
        >
          {/* GRAPH AREA */}
          <div className="relative h-full w-full bg-white">
            <NewGraph
              chapters={tabChapters}
              setChapterID={setChapterID}
              chapterID={chapterID}
              reactFlowRef={reactFlowRef}
              reactFlowInstanceRef={reactFlowInstanceRef}
              triggerAutoLayout={triggerAutoLayout}
            />

            {/* FLOATING TOOLBAR */}
            <div className="pointer-events-none absolute left-1/2 bottom-8 z-30 -translate-x-1/2">
              <div className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-xl rounded-2xl px-6 py-3 flex items-center gap-4 border border-gray-200 transition-all">
                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => reactFlowInstanceRef.current?.zoomOut?.()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-l-md p-2 transition-all"
                    title="Zoom Out"
                  >
                    —
                  </button>
                  <button
                    onClick={() => reactFlowInstanceRef.current?.zoomIn?.()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-r-md p-2 transition-all"
                    title="Zoom In"
                  >
                    +
                  </button>
                </div>
                {/* Fit view */}
                <button
                  onClick={() => reactFlowInstanceRef.current?.fitView?.({ duration: 300, padding: 0.2 })}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md p-2 transition-all"
                  title="Fit View"
                >
                  ⛶
                </button>
                {/* Auto layout */}
                <Button
                  variant="secondary"
                  onClick={() => setTriggerAutoLayout((v) => !v)}
                  className="hover:bg-indigo-100 font-medium rounded px-4 py-2 text-xs shadow transition-all"
                  title="Auto Layout"
                >
                  Auto Layout
                </Button>
                {/* Add chapter */}
                <Button
                  variant={"secondary"}
                  onClick={() => setNewChapterModal(true)}
                  className="hover:bg-cyan-100 font-medium rounded px-4 py-2 text-xs shadow transition-all flex items-center gap-2"
                >
                  <Hexagon strokeWidth={2} size={14} className="" />
                  Add Chapter
                </Button>
              </div>
            </div>
          </div>

          {/* SIDE PANEL */}
          <AnimatePresence>
            {sidePanelOpen && (
              <motion.div
                key="side-panel"
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                className="relative h-full w-full bg-gray-100 border-l border-gray-200 shadow-xl flex flex-col"
                style={{ minWidth: 0 }}
              >
                <button
                  className="absolute top-4 right-4 z-50 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-full p-1 shadow"
                  onClick={() => setChapterID(-1)}
                >
                  <X></X>
                </button>
                <div className="p-10 h-full overflow-y-auto">
                  <DragDropContext onDragEnd={updateStructure}>
                    <ChapterElement
                      key={currentChapter.chapter_uuid}
                      chapterIndex={0}
                      orgslug={props.orgslug}
                      course_uuid={course_uuid}
                      chapter={currentChapter}
                    />
                  </DragDropContext>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* NEW CHAPTER MODAL */}
      <Modal
        isDialogOpen={newChapterModal}
        onOpenChange={setNewChapterModal}
        minHeight="sm"
        dialogContent={<NewChapterModal course={course ? course.courseStructure : null} closeModal={closeNewChapterModal} submitChapter={submitChapter} />}
        dialogTitle="Create chapter"
        dialogDescription="Add a new chapter to the course"
        dialogTrigger={null}
      />
    </div>
  );
};

export default EditCourseStructure;
