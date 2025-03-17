"use client"
import Link from "next/link"
import { useLHSession } from "@components/Contexts/LHSessionContext"
import { useOrg } from "@components/Contexts/OrgContext"
import { getUriWithoutOrg } from "@services/config/config"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Settings, LogOut, Home } from "lucide-react"
import useAdminStatus from "@components/Hooks/useAdminStatus"
import { logout } from "@services/auth/auth"

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
          <div className="hidden sm:flex items-center space-x-2">
            <p className="text-sm capitalize">{session.data.user.username}</p>
            {isUserAdmin.isAdmin && (
              <div className="text-[10px] bg-rose-300 px-2 font-bold rounded-md shadow-inner py-1">ADMIN</div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer h-8 w-8 sm:h-10 sm:w-10">
                <AvatarImage src="/path-to-avatar.jpg" alt="User Avatar" />
                <AvatarFallback>
                  {session.data.user.username ? session.data.user.username.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {/* Show username in dropdown on mobile */}
              <div className="sm:hidden px-2 py-1.5 text-sm font-medium text-muted-foreground">
                <div className="flex items-center">
                  <p className="capitalize">{session.data.user.username}</p>
                  {isUserAdmin.isAdmin && (
                    <span className="text-[10px] bg-rose-300 px-2 font-bold rounded-md shadow-inner py-0.5 ml-1 inline-flex items-center">
                      ADMIN
                    </span>
                  )}
                </div>
              </div>

              {isUserAdmin.isAdmin && (
                <Link href={"/dash"}>
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

