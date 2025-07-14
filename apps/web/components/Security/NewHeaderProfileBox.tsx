"use client"
import Link from "next/link"
import { useLHSession } from "@components/Contexts/LHSessionContext"
import { useOrg } from "@components/Contexts/OrgContext"
import { getUriWithoutOrg } from "@services/config/config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Settings, LogOut, Home, Backpack,School,  Users } from "lucide-react"
import useAdminStatus from "@components/Hooks/useAdminStatus"
import { logout } from "@services/auth/auth"
import UserAvatar from "@components/Objects/UserAvatar"

export const NewHeaderProfileBox = () => {
  const session = useLHSession() as any
  const isUserAdmin = useAdminStatus()
  const org = useOrg() as any

  return (
    <div className="flex items-center">
      {session.status == "unauthenticated" && (
        <div className="flex text-sm text-gray-700 font-bold p-1.5 px-2 rounded-lg">
          <ul className="flex space-x-2 items-center">
            <li>
              <Link href={{ pathname: getUriWithoutOrg("/login"), query: org ? { orgslug: org.slug } : null }}>
                Login
              </Link>
            </li>
            <li className="bg-black rounded-lg shadow-md p-1.5 px-2.5 text-white text-xs sm:text-sm sm:p-2 sm:px-3">
              <Link href={{ pathname: getUriWithoutOrg("/signup"), query: org ? { orgslug: org.slug } : null }}>
                Sign up
              </Link>
            </li>
          </ul>
        </div>
      )}
      {session.status == "authenticated" && (
        <div className="flex items-center space-x-2">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer h-10 w-10 sm:h-12 sm:w-12">
                {/* <AvatarImage src="/path-to-avatar.jpg" alt="User Avatar" /> */}
                <UserAvatar use_with_session={true}></UserAvatar>
                <AvatarFallback>
                  {session.data.user.username ? session.data.user.username.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {/* Show username in dropdown on mobile */}
              <div className="sm:hidden px-2 py-1.5 text-sm font-medium text-muted-foreground">
                <div className="flex items-center">
                </div>
              </div>

              {isUserAdmin.isAdmin && (
                <Link href={"/"}>
                  <DropdownMenuItem>
                    <Home size={14} className="mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                </Link>
              )}

              <Link href={"/dash/user-account/settings/general"}>
                <DropdownMenuItem>
                  <Settings size={14} className="mr-2" />
                  Settings
                </DropdownMenuItem>
              </Link>

              <Link href={"/dash/exercises"}>
                <DropdownMenuItem>
                  <Backpack size={14} className="mr-2" />
                  Exercises
                </DropdownMenuItem>
              </Link>

              {isUserAdmin.isAdmin && (
                <Link href={"/dash/users/settings/users"}>
                  <DropdownMenuItem>
                    <Users size={14} className="mr-2" />
                    Users
                  </DropdownMenuItem>
                </Link>
              )}


              <Link href={"/dash/org/settings/general"}>
                <DropdownMenuItem>
                  < School size={14} className="mr-2" />
                  School
                </DropdownMenuItem>
              </Link>

              <DropdownMenuItem onClick={logout}>
                <LogOut size={14} className="mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

