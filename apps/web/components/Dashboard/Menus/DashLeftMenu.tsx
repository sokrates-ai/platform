'use client'
import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { Button } from '@components/ui/button'
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink } from "@/components/ui/navigation-menu"
import { Tooltip, TooltipContent,TooltipProvider,TooltipTrigger } from '@components/ui/tooltip'
import { Backpack, Home,School,  Users } from 'lucide-react'
import logo_black from '@public/black_logo.svg'
import Image from 'next/image'
import MenuLinks from '@components/Objects/Menus/OrgMenuLinks'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { NewHeaderProfileBox } from '@components/Security/NewHeaderProfileBox'



export const DashLeftMenu = (props: any) => {
  const { orgslug } = props
  const session = useLHSession() as any
  const org = useOrg() as any
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const isUserAdmin = useAdminStatus() as any


  return (
    <>
      <div className="backdrop-blur-lg h-[60px] blur-3adminxl -z-10"></div>
      <div className="backdrop-blur-lg bg-white/90 fixed top-0 left-0 right-0 h-[60px] ring-1 ring-inset ring-gray-500/10 shadow-[0px_4px_16px_rgba(0,0,0,0.03)] z-50">
        <div className="flex items-center justify-between w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-16 h-full">
          <div className="flex items-center space-x-5 md:w-auto w-full">
            <div className="logo flex md:w-auto w-full justify-center">
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
                    <MenuLinks orgslug={orgslug} />
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                        <Link href={'/dash'} >
                            <Button variant="ghost" size="icon">
                            <Home size={18} />
                            </Button>
                          </Link>
                    </TooltipTrigger>
                    <TooltipContent
                    >Dashboard</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                        <Link href={'/dash/exercises'} >
                            <Button variant="ghost" size="icon">
                            <Backpack size={18} />
                            </Button>
                          </Link>
                    </TooltipTrigger>
                    <TooltipContent
                    >Exercises</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                        <Link href={'/dash/users/settings/users'} >
                            <Button variant="ghost" size="icon">
                            <Users size={18} />
                            </Button>
                          </Link>
                    </TooltipTrigger>
                    <TooltipContent
                    >Users</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                        <Link href={'/dash/org/settings/general'} >
                            <Button variant="ghost" size="icon">
                            <School size={18} />
                            </Button>
                          </Link>
                    </TooltipTrigger>
                    <TooltipContent
                    >school</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

          </div>


          <NewHeaderProfileBox></NewHeaderProfileBox>
         
                  
        </div>
      </div>
      
      
    </>
  )
}

const LearnHouseLogo = () => (
  <Image
    width={40}
    className="mx-auto"
    src={logo_black}
    alt="HPI Sokrates"
  />
)

export default DashLeftMenu
