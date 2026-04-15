'use client'
import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { NavigationMenu, NavigationMenuList, NavigationMenuItem } from "@/components/ui/navigation-menu"
import logo_black from '@public/dark_logo.svg'
import Image from 'next/image'
import MenuLinks from '@components/Objects/Menus/OrgMenuLinks'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { usePathname } from 'next/navigation'
import { Shield } from 'lucide-react'




export const DashLeftMenu = (props: any) => {
  const { orgslug } = props
  const session = useSokratesSession() as any;
  const org = useOrg() as any
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const isUserAdmin = useAdminStatus() as any
  const pathname = usePathname()
  const isAdminRegion = pathname?.includes('/dash/admin')


  return (
    <>
      <div className="backdrop-blur-lg h-[60px] blur-3adminxl -z-10"></div>
      <div className="backdrop-blur-lg bg-white/90 fixed top-0 left-0 right-0 h-[60px] ring-1 ring-inset ring-gray-500/10 shadow-[0px_4px_16px_rgba(0,0,0,0.03)] z-50">
        <div className="flex items-center justify-between w-full px-6 h-full">
          <div className="flex items-center space-x-5 md:w-auto w-full">
            <div className="logo flex md:w-auto justify-start">
              <Link href={getUriWithOrg(orgslug, '/')}>
                <div className="flex w-auto h-9 rounded-md items-center m-auto py-1 justify-center">
                  {org?.logo_image ? (
                    <img
                      src={`${getOrgLogoMediaDirectory(org.org_uuid, org?.logo_image)}`}
                      alt="Learnhouse"
                      style={{ width: 'auto', height: '100%' }}
                      className="rounded-md"
                    />
                  ) : (
                    <LearnHouseLogo />
                  )}
                </div>
              </Link>
            </div>

            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  {isAdminRegion ? (
                    <Link
                      href={getUriWithOrg(orgslug, '/dash/admin')}
                      className="flex items-center space-x-2 text-[#909192] font-medium"
                    >
                      <Shield size={18} />
                      <span>Admin</span>
                    </Link>
                  ) : (
                    <MenuLinks orgslug={orgslug} />
                  )}
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

          </div>

          <div
            id="dash-topbar-slot"
            className="ml-6 flex min-w-0 flex-1 items-center"
          />

          {/* Profile functionality moved to OrgMenu */}
         
                  
        </div>
      </div>
      
      
    </>
  )
}

const LearnHouseLogo = () => (
  <Image
    width={120}
    className="mx-auto"
    src={logo_black}
    alt="HPI Sokrates"
  />
)

export default DashLeftMenu
