'use client'
import React from 'react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { HeaderProfileBox } from '@components/Security/HeaderProfileBox'
import MenuLinks from './MenuLinks'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import logo_black from '@public/black_logo.png'
import Image from 'next/image'

export const Menu = (props: any) => {
  const orgslug = props.orgslug
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [feedbackModal, setFeedbackModal] = React.useState(false)
  const org = useOrg() as any;
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)

  function closeFeedbackModal() {
    setFeedbackModal(false)
  }

  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <>
      <div className="backdrop-blur-lg h-[60px] blur-3xl -z-10"></div>
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
            <div className="hidden md:flex">
              <MenuLinks orgslug={orgslug} />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex">
              <HeaderProfileBox />
            </div>
            <button
              className="md:hidden text-gray-600 focus:outline-none"
              onClick={toggleMenu}
            >
              {isMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      <div
        className={`fixed inset-x-0 z-40 bg-white/80 backdrop-blur-lg md:hidden shadow-lg transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'top-[60px] opacity-100' : '-top-full opacity-0'
        }`}
      >
        <div className="flex flex-col px-4 py-3 space-y-4 justify-center items-center">
          <div className='py-4'>
            <MenuLinks orgslug={orgslug} />
          </div>
          <div className="border-t border-gray-200">
            <HeaderProfileBox />
          </div>
        </div>
      </div>
    </>
  )
}

const LearnHouseLogo = () => {
    return (
        <Image
            width={100}
            className="mx-auto"
            src={logo_black}
            alt=""
        />
    )
}
