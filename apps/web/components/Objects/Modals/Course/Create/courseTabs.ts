export type CourseTab = {
  id: string
  name: string
  description?: string
  position?: number
  visibility?: boolean
  visibleAfter?: string | null
  isVisible?: boolean
}

export const DEFAULT_COURSE_TABS: CourseTab[] = [
  {
    id: 'tab-1',
    name: 'Content',
    description: 'Organize chapters and activities for this course.',
    visibility: true,
    visibleAfter: null,
  },
  {
    id: 'tab-2',
    name: 'Map',
    description: 'Design the spatial course map for learners.',
    visibility: true,
    visibleAfter: null,
  },
]
