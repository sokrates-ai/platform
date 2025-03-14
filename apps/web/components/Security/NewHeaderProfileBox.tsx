
'use client'
import React, { useEffect } from 'react'
import styled from 'styled-components'
import Link from 'next/link'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithoutOrg } from '@services/config/config'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {Settings,LogOut, Home } from 'lucide-react'
import useAdminStatus from '@components/Hooks/useAdminStatus'

const logout = () => {
  // Placeholder function for logout
};

export const NewHeaderProfileBox = () => {
    const session = useLHSession() as any
    const isUserAdmin = useAdminStatus()
    const org = useOrg() as any

    return(
        <ProfileArea>
        {session.status == 'unauthenticated' && (
            <div className="flex text-sm text-gray-700 font-bold p-1.5 px-2 rounded-lg">
              <ul className="flex space-x-3 items-center">
                <li>
                  <Link
                    href={{ pathname: getUriWithoutOrg('/login'), query: org ? { orgslug: org.slug } : null }} >Login</Link>
                </li>
                <li className="bg-black rounded-lg shadow-md p-2 px-3 text-white">
                  <Link href={{ pathname: getUriWithoutOrg('/signup'), query: org ? { orgslug: org.slug } : null }}>Sign up</Link>
                </li>
              </ul>
            </div>
          )}
        {session.status == 'authenticated' && (
        


        <div className="hidden md:flex space-x-2" >
        
        <div className='flex items-center space-x-2' >
          <p className='text-sm capitalize'>{session.data.user.username}</p>
          {isUserAdmin.isAdmin && <div className="text-[10px] bg-rose-300 px-2 font-bold rounded-md shadow-inner py-1">ADMIN</div>}
        </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="cursor-pointer">
                <AvatarImage src="/path-to-avatar.jpg" alt="User Avatar" />
                <AvatarFallback>
                  U
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">

            {isUserAdmin?

             (
             
              <Link href={'/dash'}>
              <DropdownMenuItem>
                <Home size={14}/>
                <a href="/profile">Dashboard</a>
              </DropdownMenuItem>
              </Link>
               ) : ( "" )
            
            }
              <Link href={'/dash/user-account/settings/general'}>
              <DropdownMenuItem>
                <Settings size={14}/>
                <a href="/settings">Settings</a>
              </DropdownMenuItem>
              </Link>

              <DropdownMenuItem onClick={logout}>
               <LogOut size={14}/> 
               Logout
              </DropdownMenuItem>
            </DropdownMenuContent>

          </DropdownMenu>
        </div>
        )}
        </ProfileArea>

    )
}


const ProfileArea = styled.div`
  display: flex;
  place-items: stretch;
  place-items: center;
`

