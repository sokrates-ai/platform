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
import { AvatarProgressRing} from "@components/Objects/Menus/AvatarProgressRing";

export const OrgMenu = (props: any) => {
  const { orgslug } = props
  const session = useLHSession() as any
  const org = useOrg() as any
  const isUserAdmin = useAdminStatus() as any
  
  return (
    <>
      <div className="w-full flex justify-center sticky top-12 z-50">
        <div
          className="
            w-2/5
            mx-auto
            bg-white/90
            rounded-2xl
            shadow-[0px_4px_16px_rgba(0,0,0,0.06)]
            border-2 border-[#707070]
            flex items-center justify-between
            px-6 py-2
            h-16
            backdrop-blur-lg
            overflow-visible
          "
          style={{ 
            
            background: 'linear-gradient(70deg, #E8E8E8 -68.25%, #F5F5F5 41.43%)'
          }}
        >
          <div className="flex items-center gap-6">
            <Link href={getUriWithOrg(orgslug, "/")} className="flex items-center">
              <div className="flex h-9 w-auto items-center justify-center rounded-md">
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
              </div>
            </Link>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <MenuLinks orgslug={orgslug} />
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex items-center gap-4">
          <AvatarProgressRing
                level={20}
                progress={session.data.user?.level_progress || 45}
              >
                <NewHeaderProfileBox />
          </AvatarProgressRing>
          </div>
        </div>
      </div>
      {/* Abstandhalter für sticky */}
      
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