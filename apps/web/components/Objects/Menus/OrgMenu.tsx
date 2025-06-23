'use client'
import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { NavigationMenu, NavigationMenuList, NavigationMenuItem } from "@/components/ui/navigation-menu"
import logo_black from '@public/black_logo.svg'
import MenuLinks from './OrgMenuLinks'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { NewHeaderProfileBox } from '@components/Security/NewHeaderProfileBox'

export const OrgMenu = (props: any) => {
  const { orgslug } = props
  const session = useLHSession() as any
  const org = useOrg() as any
  const isUserAdmin = useAdminStatus() as any
  
  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200/30 bg-white/80 backdrop-blur-md"
        style={{background: "linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 9%, #ffd2d9 9%, #ffd2d9 18%, #b7e8ee 18%, #b7e8ee 27%, #e2a175 27%, #e2a175 36%, #787878 36%, #787878 45%, #ff8177 45%, #ff8177 55%, #ffbe8e 55%, #ffbe8e 64%, #fff8a8 64%, #fff8a8 73%, #bfde8f 73%, #bfde8f 82%, #91a1cf 82%, #91a1cf 91%, #be7abd 91%, #be7abd 100%)"}}>
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href={getUriWithOrg(orgslug, "/")} className="flex items-center">
              <div className="flex h-9 w-auto items-center justify-center rounded-md gap-1">
                {org?.logo_image ? (
                  <img
                    src={`${getOrgLogoMediaDirectory(org.org_uuid, org?.logo_image)}`}
                    alt="Organization logo"
                    style={{ width: "auto", height: "100%" }}
                    className="rounded-md"
                  />
                ) : (
                  <LearnHouseLogo />
                )}

                  <img
                    src={`/hpi_new.png`}
                    alt="Organization logo"
                    style={{ width: "auto", height: "100%" }}
                    className="rounded-md"
                  />
              </div>
            </Link>
          </div>

          <div className="flex items-center">
            <NewHeaderProfileBox />
          </div>
        </div>
      </div>
      <div className="h-16"></div>
    </>
  )
}

const LearnHouseLogo = () => (
  <Image
    width={120}
    className="mx-auto"
    src={logo_black || "/placeholder.svg"}
    alt="HPI Sokrates"
  />
)

export default OrgMenu
