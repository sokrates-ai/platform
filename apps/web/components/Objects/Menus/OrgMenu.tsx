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

// Farbschema-Variablen
const GRADIENT = 'linear-gradient(135deg,var(--color-SokratesLightGray) 0%,var(--color-SokratesWhite) 100%)'
const GRADIENT_PRIDE = 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 9%, #ffd2d9 9%, #ffd2d9 18%, #b7e8ee 18%, #b7e8ee 27%, #e2a175 27%, #e2a175 36%, #787878 36%, #787878 45%, #ff8177 45%, #ff8177 55%, #ffbe8e 55%, #ffbe8e 64%, #fff8a8 64%, #fff8a8 73%, #bfde8f 73%, #bfde8f 82%, #91a1cf 82%, #91a1cf 91%, #be7abd 91%, #be7abd 100%)'
const BORDER = '2px solid var(--color-SokratesGrayBorder)'
const SHADOW = '0 2px 0 var(--color-SokratesBlackBoxShadow)'
const DROP_SHADOW = 'drop-shadow(0px 2px 2px rgba(69, 69, 69, 0.15))'

export const OrgMenu = ({ orgslug }: { orgslug: string }) => {
  const session = useSokratesSession() as any
  const org = useOrg() as any
  const isUserAdmin = useAdminStatus() as any

  const roleBadge = React.useMemo(() => {
    if (session?.status !== 'authenticated') return null
    const roles = session?.data?.roles || []
    const orgId = org?.id
    const rolesForOrg = orgId
      ? roles.filter((role: any) => role?.org?.id === orgId)
      : roles
    const hasAdmin = rolesForOrg.some(
      (role: any) =>
        role?.role?.role_uuid === 'role_global_admin' || role?.role?.id === 1,
    )
    if (hasAdmin) return 'ADMIN'
    const hasMaintainer = rolesForOrg.some(
      (role: any) =>
        role?.role?.role_uuid === 'role_global_maintainer' ||
        role?.role?.id === 2,
    )
    if (hasMaintainer) return 'MAINTAINER'
    const hasTutor = rolesForOrg.some(
      (role: any) =>
        role?.role?.role_uuid === 'role_global_tutor' || role?.role?.id === 4,
    )
    if (hasTutor) return 'TUTOR'
    return null
  }, [session?.status, session?.data?.roles, org?.id])

  const logout = () =>
    (window.location.href = getUriWithoutOrg('/login?orgslug=' + org?.slug))

  // Unauthenticated
  if (session?.status !== 'authenticated') {
    return (
      <header className="fixed inset-x-0 z-50 flex justify-center top-8 px-4 sm:px-0">
        <div className="relative w-full sm:w-3/4 md:w-2/3 lg:w-1/2">
          <div
            className="relative flex h-12 sm:h-14 md:h-16 lg:h-[71px] w-full
                         items-center px-6 text-SokratesBlackBoxShadow/90"
            style={{
              background: GRADIENT_PRIDE,
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
            <div className="ml-auto flex items-center gap-6">
              <Link href={getUriWithoutOrg('/login?orgslug=' + orgslug)}>
                <Button variant="outline">Login</Button>
              </Link>
              <Link href={getUriWithoutOrg('/signup?orgslug=' + orgslug)}>
                <Button className="bg-SokratesOrangeShadow hover:bg-SokratesOrangeShadow/90">
                  Sign up
                </Button>
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
        <div className="relative grid w-full grid-cols-[1fr_auto_auto] items-center">
          <LeftRail
            orgslug={orgslug}
            org={org}
            session={session}
          />
          <Avatar
            session={session}
            org={org}
            isUserAdmin={isUserAdmin}
            onLogout={logout}
          />
          <RightRail roleBadge={roleBadge} />
        </div>
      </div>
    </header>
  )
}


// RAIL SEGMENTS

function LeftRail({
  orgslug,
  org,
  session,
}: any) {
  return (
    <div
      className="relative flex h-12 sm:h-14 md:h-16 lg:h-[71px] w-full
                 items-center pl-4 sm:pl-6 pr-6 sm:pr-8 text-SokratesBlackBoxShadow/90"
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
          {session?.data?.user?.coins ?? -1}
        </Badge>
      </div>
    </div>
  )
}

function RightRail({ roleBadge }: { roleBadge: string | null }) {
  return (
    <div
      className="relative flex h-12 sm:h-14 md:h-16 lg:h-[71px] min-w-[40px] sm:min-w-[100px] lg:min-w-[110px] items-center justify-end px-3 sm:px-4"
      style={railStyle('right')}
    >
      {roleBadge ? (
        <Badge
          className="whitespace-nowrap"
          style={{ backgroundColor: '#E25A26', borderColor: '#E25A26', color: 'white' }}
        >
          {roleBadge}
        </Badge>
      ) : null}
    </div>
  )
}


/* ─── AVATAR ──────────────────────────────────────────────────────────────── */

function Avatar({ session, org, isUserAdmin, onLogout }: any) {
  const [xp, setXp] = React.useState(0)

  React.useEffect(() => {
    const xp_ = session?.data?.user?.level_progress ?? -1
    const timer = setTimeout(() => {
        setXp(xp_)
    }, 200)
    return () => clearTimeout(timer)
  }, [session?.data?.user?.level_progress])

  const pct = Math.max(0, Math.min(1, xp / 100))
  const strokeWidth = 6

  return (
    <div className="relative z-10 -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8">
      <div className="relative aspect-square w-24 sm:w-28 md:w-32 lg:w-[150px]">
        {/* SVG progress ring (behind the avatar) */}
        <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: 'rotate(90deg)' }}
        aria-hidden
        >
        {/* track */}
        <circle
            cx={50}
            cy={50}
            r={42}
            stroke="#eaeaea"
            strokeWidth={strokeWidth}
            fill="none"
        />

        {/* glow ring */}
        <circle
            cx={50}
            cy={50}
            r={42}
            stroke="#e25a26"
            strokeWidth={strokeWidth + 6} // strokeWidth + 6
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 42}
            strokeDashoffset={2 * Math.PI * 42 * (1 - pct)}
            style={{
            transition: 'stroke-dashoffset 700ms ease, opacity 700ms ease, filter 700ms ease',
            opacity: pct > 0 ? 0.6 : 0,
            }}
        />

        {/* solid progress ring */}
        <circle
            cx={50}
            cy={50}
            r={42}
            stroke="#e25a26"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 42}
            strokeDashoffset={2 * Math.PI * 42 * (1 - pct)}
            style={{
            transition: 'stroke-dashoffset 700ms ease',
            willChange: 'stroke-dashoffset'
            }}
        />
        </svg>

        <AvatarDropdownMenu
          session={session}
          org={org}
          isUserAdmin={isUserAdmin}
          onLogout={onLogout}
        >
          <div
            className="absolute inset-[9%] rounded-full overflow-hidden border-2 cursor-pointer"
            style={{
              borderColor: 'var(--color-SokratesGrayBorder)',
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
          className="absolute bottom-2 left-1/2 translate-x-[-50%] translate-y-1/2 rounded-md border px-3 lg:px-6 py-1 lg:py-0.5 shadow bg-SokratesLightGray border-SokratesGrayBorder"
          style={{ boxShadow: SHADOW }}
        >
          <span className="block text-xs sm:text-sm font-bold leading-none text-SokratesBlackBoxShadow">
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
    background: side === 'left'
      ? GRADIENT_PRIDE
      : GRADIENT,
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
    className={
      "flex items-center text-[10px] sm:text-xs bg-SokratesWhite border border-SokratesGrayBorder px-2 sm:px-3 py-1 font-bold rounded-lg select-none " +
      (className || "")
    }
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
