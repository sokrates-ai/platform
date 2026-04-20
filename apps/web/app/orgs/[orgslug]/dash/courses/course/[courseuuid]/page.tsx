'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { BookOpen, GraduationCap } from 'lucide-react'

import { CourseProvider } from '@components/Contexts/CourseContext'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import useCourseStaffStatus from '@components/Hooks/useCourseStaffStatus'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop'
import { getUriWithOrg } from '@services/config/config'

type CourseEntryPageProps = {
  params: {
    orgslug: string
    courseuuid: string
  }
}

function CourseEntryPage({ params }: CourseEntryPageProps) {
  const courseUuid = `course_${params.courseuuid}`

  return (
    <div className="grid h-screen w-full grid-rows-[auto,1fr] overscroll-x-none bg-SokratesLightGray">
      <CourseProvider courseuuid={courseUuid}>
        <CourseEntryLayout params={params} />
      </CourseProvider>
    </div>
  )
}

export default CourseEntryPage

function CourseEntryLayout({ params }: CourseEntryPageProps) {
  const session = useSokratesSession() as any
  const { isCourseStaff, loading } = useCourseStaffStatus()
  const router = useRouter()

  React.useEffect(() => {
    if (loading || session?.status === 'loading') return
    if (!isCourseStaff) {
      router.replace(
        getUriWithOrg(params.orgslug, `/course/${params.courseuuid}`)
      )
    }
  }, [
    isCourseStaff,
    loading,
    params.courseuuid,
    params.orgslug,
    router,
    session?.status,
  ])

  if (session?.status === 'loading' || loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <PageLoading />
      </div>
    )
  }

  if (!isCourseStaff) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
        Redirecting to course...
      </div>
    )
  }

  const overviewParams = {
    orgslug: params.orgslug,
    courseuuid: params.courseuuid,
    subpage: 'entry',
  }
  const coursePath = getUriWithOrg(
    params.orgslug,
    `/course/${params.courseuuid}`
  )
  const tutorPath = getUriWithOrg(
    params.orgslug,
    `/dash/courses/course/${params.courseuuid}/tutor`
  )

  return (
    <>
      <div className="z-10 bg-SokratesWhite px-10 pt-[60px] text-sm tracking-tight shadow-[0px_4px_16px_rgba(0,0,0,0.06)]">
        <CourseOverviewTop params={overviewParams} />
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="h-full overflow-auto"
      >
        <div className="px-10 py-8">
          <div className="flex min-h-[calc(100vh-220px)] items-center justify-center">
            <EntrySelectionGrid coursePath={coursePath} tutorPath={tutorPath} />
          </div>
        </div>
      </motion.div>
    </>
  )
}

function EntrySelectionGrid({
  coursePath,
  tutorPath,
}: {
  coursePath: string
  tutorPath: string
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex flex-col items-center gap-6 md:flex-row md:gap-10">
        <EntrySelectionCard
          href={coursePath}
          title="View course"
          icon={<BookOpen className="h-10 w-10 text-gray-500" />}
        />
        <div className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gray-400">
          Or
        </div>
        <EntrySelectionCard
          href={tutorPath}
          title="Tutor view"
          icon={<GraduationCap className="h-10 w-10 text-gray-500" />}
        />
      </div>
    </div>
  )
}

function EntrySelectionCard({
  href,
  title,
  icon,
}: {
  href: string
  title: string
  icon: React.ReactNode
}) {
  return (
    <Link
      prefetch
      href={href}
      className="group relative flex h-56 w-56 flex-col items-center justify-center gap-4 rounded-2xl border border-gray-400 bg-white text-center shadow-[0_26px_60px_rgba(15,23,42,0.22)] transition-all duration-200 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-SokratesOrange/40 md:h-64 md:w-64"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-300 bg-gray-50">
        {icon}
      </div>
      <div className="text-sm font-semibold text-gray-900">{title}</div>
    </Link>
  )
}
