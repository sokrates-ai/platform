'use client'
import { Backpack, BookCopy, Home, School, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'

function DashMobileMenu() {
  const session = useSokratesSession() as any;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg text-white shadow-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-2">
        <AdminAuthorization authorizationMode="component">
          <ToolTip content={'Home'} slateBlack sideOffset={8} side="top">
            <Link href={`/`} className="flex flex-col items-center p-2">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
          </ToolTip>
          <ToolTip content={'Courses'} slateBlack sideOffset={8} side="top">
            <Link href={`/dash/courses`} className="flex flex-col items-center p-2">
              <BookCopy size={20} />
              <span className="text-xs mt-1">Courses</span> 
            </Link>
          </ToolTip>
          <ToolTip content={'Assignments'} slateBlack sideOffset={8} side="top">
            <Link href={`/dash/assignments`} className="flex flex-col items-center p-2">
              <Backpack size={20} />
              <span className="text-xs mt-1">Assignments</span>
            </Link>
          </ToolTip>
          <ToolTip content={'Users'} slateBlack sideOffset={8} side="top">
            <Link href={`/dash/users/settings/users`} className="flex flex-col items-center p-2">
              <Users size={20} />
              <span className="text-xs mt-1">Users</span>
            </Link>
          </ToolTip>
          <ToolTip content={'Organization'} slateBlack sideOffset={8} side="top">
            <Link href={`/dash/org/settings/general`} className="flex flex-col items-center p-2">
              <School size={20} />
              <span className="text-xs mt-1">Org</span>
            </Link>
          </ToolTip>
        </AdminAuthorization>
        <ToolTip content={session.data.user.username + "'s Settings"} slateBlack sideOffset={8} side="top">
          <Link href={'/dash/user-account/settings/general'} className="flex flex-col items-center p-2">
            <Settings size={20} />
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </ToolTip>
      </div>
    </div>
  )
}

export default DashMobileMenu
