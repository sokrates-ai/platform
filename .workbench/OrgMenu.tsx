'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { AvatarDropdownMenu } from './AvatarDropdownMenu'

import logo_black from '@public/dark_logo.svg'

const GRADIENT = 'linear-gradient(135deg,#f7f7f7 0%,#eaeaea 100%)'
const BORDER = '2px solid #707070'
const SHADOW = '0 2px 0 #454545'

const AVATAR_WIDTH = { base: 50, sm: 50, md: 128, lg: 135 } // px
const AVATAR_POS = 0.8

export const OrgMenu = ({ orgslug }: { orgslug: string }) => {
  const session = useSokratesSession() as any
  const org = useOrg() as any
  const isUserAdmin = useAdminStatus() as any

  const logout = () =>
    (window.location.href = getUriWithoutOrg('/login?orgslug=' + org?.slug))

  const avatarPx = (() => {
    if (typeof window === 'undefined') return AVATAR_WIDTH.base
    const w = window.innerWidth
    return w >= 1024
      ? AVATAR_WIDTH.lg
      : w >= 768
        ? AVATAR_WIDTH.md
        : w >= 640
          ? AVATAR_WIDTH.sm
          : AVATAR_WIDTH.base
  })()

  const safePadding = `calc(23% + ${avatarPx / 2}px)`

  return (
    <header className="fixed top-12 inset-x-0 z-50 flex justify-center">
      <div className="relative w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
        <div
          className="relative flex items-center h-12 sm:h-14 md:h-16 lg:h-[71px] px-4 sm:px-6 lg:px-8 rounded-[0.75rem] overflow-visible"
          style={{
            background: GRADIENT,
            border: BORDER,
            boxShadow: SHADOW,
            paddingRight: safePadding
          }}
        >
          <Link href={getUriWithOrg(orgslug, '/')}>
            <div className="flex h-6 sm:h-7 md:h-8 lg:h-[26.8px] items-center">
              {org?.logo_image ? (
                <img
                  src={getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)}
                  alt="Organisation logo"
                  className="h-full w-auto select-none"
                  draggable={false}
                />
              ) : (
                <FallbackLogo />
              )}
            </div>
          </Link>

          {/* badges */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Badge>
              <span className="mr-1">🪙</span>
              {session?.data?.user?.hintCoins ?? 42}
            </Badge>
            {isUserAdmin?.isAdmin && <Badge>Admin</Badge>}
          </div>

          <Avatar
            session={session}
            org={org}
            isUserAdmin={isUserAdmin}
            onLogout={logout}
          />
        </div>
      </div>
    </header>
  )
}


function Avatar({ session, org, isUserAdmin, onLogout }: any) {
  const xp = session?.data?.user?.xp ?? 0.42
  const next = session?.data?.user?.nextLevelXp ?? 1
  const pct = Math.min(1, xp / next)
  const deg = 360 * pct

  return (
    <div
      className="
        absolute z-10
        top-1/2 -translate-y-1/2 -translate-x-1/2
        w-32        sm:w-28     md:w-32     lg:w-[150px]
      "
      style={{ left: `${AVATAR_POS * 100}%` }}
    >
      <div className="relative w-full aspect-square">
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{
            borderColor: '#707070',
            boxShadow: SHADOW,
            background: [
              `conic-gradient(from 180deg at 50% 50%, #e25a26 0deg, #ed865e ${deg}deg, transparent ${deg}deg)`,
              GRADIENT
            ].join(',')
          }}
        />
        <AvatarDropdownMenu
          session={session}
          org={org}
          isUserAdmin={isUserAdmin}
          onLogout={onLogout}
        >
          <div
            className="absolute inset-[6%] rounded-full overflow-hidden border-2 cursor-pointer"
            style={{
              borderColor: '#707070',
              background: 'linear-gradient(135deg,#fff,#f3f3f3)'
            }}
          >
            <img
              src="/sokrates-walking.svg"
              alt="Sokrates mascot"
              className="absolute inset-0 p-4 w-full h-full object-contain"
              draggable={false}
            />
          </div>
        </AvatarDropdownMenu>

        <div
          className="absolute bottom-2 left-1/2 translate-x-[-50%] translate-y-1/2 rounded-md border px-3 lg:px-6 py-1 lg:py-0.5 shadow bg-[#f4f4f4]"
          style={{ borderColor: '#707070', boxShadow: SHADOW }}
        >
          <span className="block text-xs sm:text-sm font-bold leading-none text-[#454545]">
            {session?.data?.user?.level ?? 0}
          </span>
        </div>
      </div>
    </div>
  )
}

const Badge = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center text-[10px] sm:text-xs bg-white border border-[#707070] px-2 sm:px-3 py-1 font-bold rounded-lg select-none">
    {children}
  </div>
)

const FallbackLogo = () => (
  <Image
    width={120}
    className="h-full w-auto"
    src={logo_black || '/placeholder.svg'}
    alt="HPI Sokrates"
  />
)

export default OrgMenu
