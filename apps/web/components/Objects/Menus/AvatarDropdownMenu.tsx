"use client"
import React, { useMemo } from "react"
import Link from "next/link"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Settings, LogOut, Home, Backpack, School, Users } from "lucide-react"
import { getUriWithoutOrg } from '@services/config/config'

interface AvatarDropdownMenuProps {
  children: React.ReactNode
  session: any
  org: any
  isUserAdmin: any
  onLogout: () => void
}

export const AvatarDropdownMenu = ({ 
  children,
  session,
  org,
  isUserAdmin,
  onLogout
}: AvatarDropdownMenuProps) => {
  const canSeeExercises = useMemo(() => {
    if (session?.status !== 'authenticated') return false
    const roles = session?.data?.roles || []
    const orgId = org?.id
    const rolesForOrg = orgId ? roles.filter((role: any) => role?.org?.id === orgId) : roles
    return rolesForOrg.some((role: any) => (
      role?.role?.role_uuid === 'role_global_admin' ||
      role?.role?.role_uuid === 'role_global_maintainer' ||
      role?.role?.role_uuid === 'role_global_tutor' ||
      role?.role?.id === 1 ||
      role?.role?.id === 2 ||
      role?.role?.id === 4
    ))
  }, [session?.status, session?.data?.roles, org?.id])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center" className="w-48">
        {session?.status === 'authenticated' ? (
          <>
            {/* Show username in dropdown header */}
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b">
              {session.data.user.username}
            </div>

            {isUserAdmin?.isAdmin && (
              <Link href={'/'}>
                <DropdownMenuItem>
                  <Home size={14} className="mr-2" />
                  Dashboard
                </DropdownMenuItem>
              </Link>
            )}

            <Link href={'/dash/user-account/settings/general'}>
              <DropdownMenuItem>
                <Settings size={14} className="mr-2" />
                Settings
              </DropdownMenuItem>
            </Link>

            {canSeeExercises && (
              <Link href={"/dash/exercises"}>
                <DropdownMenuItem>
                  <Backpack size={14} className="mr-2" />
                  Exercises
                </DropdownMenuItem>
              </Link>
            )}

            {isUserAdmin?.isAdmin && (
              <Link href={"/dash/users/settings/users"}>
                <DropdownMenuItem>
                  <Users size={14} className="mr-2" />
                  Users
                </DropdownMenuItem>
              </Link>
            )}

            <Link href={"/dash/org/settings/general"}>
              <DropdownMenuItem>
                <School size={14} className="mr-2" />
                School
              </DropdownMenuItem>
            </Link>

            <DropdownMenuItem onClick={onLogout}>
              <LogOut size={14} className="mr-2" />
              Logout
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <Link href={{
              pathname: getUriWithoutOrg('/login'),
              query: org ? { orgslug: org.slug } : null,
            }}>
              <DropdownMenuItem>
                <LogOut size={14} className="mr-2" />
                Login
              </DropdownMenuItem>
            </Link>
            <Link href={{
              pathname: getUriWithoutOrg('/signup'),
              query: org ? { orgslug: org.slug } : null,
            }}>
              <DropdownMenuItem>
                <Users size={14} className="mr-2" />
                Sign up
              </DropdownMenuItem>
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 
