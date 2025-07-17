'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

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
const DROP_SHADOW = 'drop-shadow(0px 2px 2px rgba(69, 69, 69, 0.15))'

export const OrgMenu = ({ orgslug }: { orgslug: string }) => {
  const session = useSokratesSession() as any
  const org = useOrg() as any
  const isUserAdmin = useAdminStatus() as any

  const logout = () =>
    (window.location.href = getUriWithoutOrg('/login?orgslug=' + org?.slug))

  // Unauthenticated
  if (session?.status !== 'authenticated') {
    return (
      <header className="fixed inset-x-0 z-50 flex justify-center top-4 px-4 sm:px-0">
        <div className="relative w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
          <div
            className="relative flex h-12 sm:h-14 md:h-16 lg:h-[71px] w-full
                         items-center px-6 text-[#454545]/90"
            style={{
              background: GRADIENT,
              border: BORDER,
              boxShadow: SHADOW,
              filter: DROP_SHADOW,
              borderRadius: '0.75rem',
            }}
          >
            {/* logo */}
            <Link href={getUriWithOrg(orgslug, '/')}>
              <div className="flex h-5 sm:h-7 md:h-8 lg:h-[26.8px] items-center">
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

            {/* Login / Sign up */}
            <div className="ml-auto flex items-center gap-3">
              <Link href={getUriWithoutOrg('/login?orgslug=' + orgslug)}>
                <Button variant="outline">Login</Button>
              </Link>
              <Link href={getUriWithoutOrg('/signup?orgslug=' + orgslug)}>
                <Button>Sign up</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
    )
  }

  // Authenticated
  return (
    <header className="fixed inset-x-0 z-50 flex justify-center top-4 px-4 sm:px-0">
      <div className="relative w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
        <div className="relative grid w-full grid-cols-[1fr_auto_40px] sm:grid-cols-[1fr_auto_100px] lg:grid-cols-[1fr_auto_110px] items-center">
          <LeftRail
            orgslug={orgslug}
            org={org}
            session={session}
            isUserAdmin={isUserAdmin}
          />
          <Avatar
            session={session}
            org={org}
            isUserAdmin={isUserAdmin}
            onLogout={logout}
          />
          <RightRail />
        </div>
      </div>
    </header>
  )
}


// RAIL SEGMENTS

function LeftRail({ orgslug, org, session, isUserAdmin }: any) {
  return (
    <div
      className="relative flex h-12 sm:h-14 md:h-16 lg:h-[71px] w-full
                 items-center pl-4 sm:pl-6 pr-6 sm:pr-8 text-[#454545]/90"
      style={railStyle('left')}
    >
      {/* logo */}
      <Link href={getUriWithOrg(orgslug, '/')}>
        <div className="flex h-5 sm:h-7 md:h-8 lg:h-[26.8px] items-center">
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
      <div className="flex items-center pr-1 lg:pr-5 gap-2 sm:gap-3 ml-auto">
        <Badge>
          <span className="mr-1">🪙</span>
          {session?.data?.user?.hintCoins ?? 42}
        </Badge>
        {isUserAdmin?.isAdmin && (
          <Badge className="hidden xl:flex" style={{ backgroundColor: '#E25A26', borderColor: '#E25A26', color: 'white' }}>
            Admin
          </Badge>
        )}
      </div>
    </div>
  )
}

function RightRail() {
  return (
    <div
      className="relative h-12 sm:h-14 md:h-16 lg:h-[71px] w-full"
      style={railStyle('right')}
    />
  )
}


/* ─── AVATAR ──────────────────────────────────────────────────────────────── */

function Avatar({ session, org, isUserAdmin, onLogout }: any) {
  const xp = session?.data?.user?.xp ?? 0.42
  const next = session?.data?.user?.nextLevelXp ?? 1
  const pct = Math.min(1, xp / next)
  const deg = 360 * pct

  return (
    <div className="relative z-10 -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8">
      <div className="relative aspect-square w-24 sm:w-28 md:w-32 lg:w-[150px]">
        {/* progress ring */}
        <div
          className="absolute inset-0 rounded-full border-2"
          style={{
            borderColor: '#707070',
            boxShadow: SHADOW,
            background: [
              `conic-gradient(from 180deg at 50% 50%, #e25a26 0deg, #E25A26 ${deg}deg, transparent ${deg}deg)`,
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

        {/* level badge */}
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


/* ─── SHARED STYLES & HELPERS ─────────────────────────────────────────────── */

function railStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    background: GRADIENT,
    border: BORDER,
    boxShadow: SHADOW,
    filter: DROP_SHADOW,
    borderRadius: side === 'left'
      ? '0.75rem 0 0 0.75rem'
      : '0 0.75rem 0.75rem 0',
  } as React.CSSProperties
}

const Badge = ({
  children,
  style,
  className,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) => (
  <div
    className={`flex items-center text-[10px] sm:text-xs bg-white border border-[#707070] px-2 sm:px-3 py-1 font-bold rounded-lg select-none ${className || ''}`}
    style={style}
  >
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
