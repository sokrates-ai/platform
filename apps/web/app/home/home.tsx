'use client'
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import UserAvatar from '@components/Objects/UserAvatar';
import { getAPIUrl, getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import { ArrowRightCircle, Info } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import SokratesLogo from 'public/dark_logo.svg'
import React, { useEffect } from 'react'
import useSWR from 'swr';

// TODO: fix organization issues.

function HomeClient() {
  const session = useSokratesSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { data: orgs } = useSWR(`${getAPIUrl()}orgs/user/page/1/limit/10`, (url: string) => swrFetcher(url, access_token))

  useEffect(() => {
  }, [session, orgs])
  return (
    <div className="flex flex-col items-center px-4 pb-12 sm:pb-16">
      <div className="flex gap-4 mx-auto font-semibold text-2xl sm:text-3xl pt-10 sm:pt-16 items-center bg-black rounded-b-2xl px-5 pb-4">
        <Image
          quality={100}
          width={60}
          height={60}
          src={SokratesLogo}
          alt=""
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mx-auto font-semibold text-xl sm:text-2xl pt-10 sm:pt-16 items-center text-center">
        <span>Hello,</span>
        <UserAvatar />
        <span className="capitalize">
          {session?.data?.user.first_name} {session?.data?.user.last_name}
        </span>
      </div>
      <div className="flex mx-auto font-semibold text-xs sm:text-sm mt-8 sm:mt-12 items-center uppercase bg-slate-200 text-gray-600 px-3 py-2 rounded-md">
        Your Organizations
      </div>
      {orgs && orgs.length == 0 && (
        <div className="flex flex-col sm:flex-row mx-auto my-5 gap-3 bg-rose-200 rounded-lg px-4 py-3 max-w-md w-full">
          <Info />
          <span className="text-sm">
            It seems you're not part of an organization yet, join one to be able to see it here: TODO: fix this
          </span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center mx-auto pt-6 sm:pt-10 rounded-lg w-full max-w-md sm:max-w-none gap-3">
        {orgs && orgs.map((org: any) => (
          <Link
            href={getUriWithOrg(org.slug, '/')}
            key={org.id}
            className="flex gap-2 w-full sm:w-auto justify-between items-center outline outline-1 outline-slate-200 px-3 py-3 rounded-lg"
          >
            <div className="truncate">Sokrates - HPI</div>
            <ArrowRightCircle />
          </Link>
        ))}
      </div>
      <div className="flex cursor-pointer mx-auto font-semibold text-lg sm:text-2xl pt-10 sm:pt-16 items-center">
        <span onClick={() => signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })}>Sign out</span>
      </div>
    </div>
  )
}

export default HomeClient
