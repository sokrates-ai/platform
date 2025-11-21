"use client"
import Link from "next/link"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Settings, LogOut, Home, Backpack, School, Users } from "lucide-react"
import { getUriWithoutOrg } from '@services/config/config'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('AvatarDropdownMenu')

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
                  {t('dashboard')}
                </DropdownMenuItem>
              </Link>
            )}

            <Link href={'/dash/user-account/settings/general'}>
              <DropdownMenuItem>
                <Settings size={14} className="mr-2" />
                {t('settings')}
              </DropdownMenuItem>
            </Link>

            <Link href={"/dash/exercises"}>
              <DropdownMenuItem>
                <Backpack size={14} className="mr-2" />
                {t('exercises')}
              </DropdownMenuItem>
            </Link>

            {isUserAdmin?.isAdmin && (
              <Link href={"/dash/users/settings/users"}>
                <DropdownMenuItem>
                  <Users size={14} className="mr-2" />
                  {t('users')}
                </DropdownMenuItem>
              </Link>
            )}

            <Link href={"/dash/org/settings/general"}>
              <DropdownMenuItem>
                <School size={14} className="mr-2" />
                {t('school')}
              </DropdownMenuItem>
            </Link>

            <DropdownMenuItem onClick={onLogout}>
              <LogOut size={14} className="mr-2" />
              {t('logout')}
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
                {t('login')}
              </DropdownMenuItem>
            </Link>
            <Link href={{
              pathname: getUriWithoutOrg('/signup'),
              query: org ? { orgslug: org.slug } : null,
            }}>
              <DropdownMenuItem>
                <Users size={14} className="mr-2" />
                {t('signup')}
              </DropdownMenuItem>
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}