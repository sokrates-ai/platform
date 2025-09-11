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
    <div className='flex flex-col'>

      <div className='flex space-x-4 mx-auto font-semibold text-3xl pt-16 items-center bg-black rounded-b-2xl'>
        <Image
          quality={100}
          width={60}
          height={60}
          src={SokratesLogo}
          alt=""
        />
      </div>

      <div className='flex space-x-4 mx-auto font-semibold text-2xl pt-16 items-center'><span>Hello,</span> <UserAvatar /> <span className='capitalize'>{session?.data?.user.first_name} {session?.data?.user.last_name}</span></div>
      <div className='flex space-x-4 mx-auto font-semibold text-sm mt-12 items-center uppercase bg-slate-200 text-gray-600 px-3 py-2 rounded-md'>Your Organizations</div>
      {orgs && orgs.length == 0 && <div className='flex mx-auto my-5 space-x-3 bg-rose-200 rounded-lg px-3 py-2'>
        <Info />
        <span>It seems you're not part of an organization yet, join one to be able to see it here: TODO: fix this</span>
      </div>}
      <div className='flex mx-auto pt-10 rounded-lg'>
        {orgs && orgs.map((org: any) => (
          <Link href={getUriWithOrg(org.slug, '/')} key={org.id} className='flex space-x-2 mx-auto w-fit justify-between items-center outline outline-1 outline-slate-200 px-3 py-2 rounded-lg'>
            <div>Sokrates - HPI</div>
            <ArrowRightCircle />
          </Link>
        ))}
      </div>
      <div className='flex cursor-pointer space-x-4 mx-auto font-semibold text-2xl pt-16 items-center'><span onClick={() => signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })}>Sign out</span></div>

    </div>
  )
}

export default HomeClient
