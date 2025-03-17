'use client'
import learnhouseIcon from 'public/learnhouse_bigicon_1.png'
import Image from 'next/image'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { useEffect } from 'react'
import { MailWarning, Ticket, UserPlus } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import UserAvatar from '@components/Objects/UserAvatar'
import OpenSignUpComponent from './OpenSignup'
import InviteOnlySignUpComponent from './InviteOnlySignUp'
import { useRouter, useSearchParams } from 'next/navigation'
import { validateInviteCode } from '@services/organizations/invites'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import toast from 'react-hot-toast'
import { BarLoader } from 'react-spinners'
import { joinOrg } from '@services/organizations/orgs'
import whiteLogo from 'public/white_logo.svg'
import { Separator } from "@/components/ui/separator"


interface SignUpClientProps {
  org: any
}

function SignUpClient(props: SignUpClientProps) {
  const session = useLHSession() as any
  const [joinMethod, setJoinMethod] = React.useState('open')
  const [inviteCode, setInviteCode] = React.useState('')
  const searchParams = useSearchParams()
  const inviteCodeParam = searchParams.get('inviteCode')

  useEffect(() => {
    if (props.org.config) {
      setJoinMethod(
        props.org?.config?.config?.features.members.signup_mode
      )
    }
    if (inviteCodeParam) {
      setInviteCode(inviteCodeParam)
    }
  }, [props.org, inviteCodeParam])

  return (
    <div className="grid grid-flow-col justify-stretch h-screen">
      <div
        className="bg-gradient-to-br from-gray-800 to-black flex flex-col justify-between p-6 md:p-10"
      >
        <div className="login-topbar flex justify-center md:justify-start">
          <Link prefetch href={getUriWithOrg(props.org.slug, '/')}>
            <Image
              quality={100}
              width={120}
              height={120}
              src={whiteLogo}
              alt="Logo"
              className="hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center text-white py-10 md:py-0">
          <div className="text-center">
            <h1 className="font-bold text-3xl md:text-6xl mb-3">Welcome!</h1>
            <Separator className="my-4 opacity-25" />
            <div className="flex items-center space-x-2">
              <p className="text-lg md:text-xl">Create your</p>
              <Image
                quality={100}
                width={100}
                height={100}
                src={whiteLogo}
                alt="Logo"
                className="hover:opacity-80 transition-opacity"
              />
              <p className="text-lg md:text-xl">Account</p>
            </div>
          </div>
        </div>
        <div className="hidden md:block"> {/* Spacer for desktop layout */}
        </div>
      </div>

      <div className="left-join-part bg-white flex flex-row">
        {joinMethod == 'open' &&
          (session.status == 'authenticated' ? (
            <LoggedInJoinScreen inviteCode={inviteCode} />
          ) : (
            <OpenSignUpComponent />
          ))}
        {joinMethod == 'inviteOnly' &&
          (inviteCode ? (
            session.status == 'authenticated' ? (
              <LoggedInJoinScreen inviteCode={inviteCode} />
            ) : (
              <InviteOnlySignUpComponent inviteCode={inviteCode} />
            )
          ) : (
            <NoTokenScreen />
          ))}
      </div>
    </div>
  )
}

const LoggedInJoinScreen = (props: any) => {
  const session = useLHSession() as any
  const org = useOrg() as any
  const invite_code = props.inviteCode
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSumbitting, setIsSubmitting] = React.useState(false)
  const router = useRouter()

  const join = async () => {
    setIsSubmitting(true)
    const res = await joinOrg({ org_id: org.id, user_id: session?.data?.user?.id, invite_code: props.inviteCode }, null, session.data?.tokens?.access_token)
    //wait for 1s
    if (res.success) {
      toast.success(
        res.data
      )
      setTimeout(() => {
        router.push(getUriWithOrg(org.slug, '/'))
      }, 2000)
      setIsSubmitting(false)
    } else {
      toast.error(res.data.detail)
      setIsLoading(false)
      setIsSubmitting(false)
    }

  }

  useEffect(() => {
    if (session && org) {
      setIsLoading(false)
    }
  }, [org, session])

  return (
    <div className="flex flex-row  items-center mx-auto">
      <Toast />
      <div className="flex space-y-7 flex-col justify-center items-center">
        <p className="pt-3 text-2xl font-semibold text-black/70 flex justify-center space-x-2 items-center">
          <span className="items-center">Hi</span>
          <span className="capitalize flex space-x-2 items-center">
            <UserAvatar rounded="rounded-xl" border="border-4" width={35} />
            <span>{session.data.username},</span>
          </span>
          <span>join {org?.name} ?</span>
        </p>
        <button onClick={() => join()} className="flex w-fit h-[35px] space-x-2 bg-black px-6 py-2 text-md rounded-lg font-semibold h-fit text-white items-center shadow-md">
          {isSumbitting ? <BarLoader
            cssOverride={{ borderRadius: 60 }}
            width={60}
            color="#ffffff"
          /> : <><UserPlus size={18} />
            <p>Join </p></>}
        </button>
      </div>
    </div>
  )
}

const NoTokenScreen = (props: any) => {
  const session = useLHSession() as any
  const org = useOrg() as any
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(true)
  const [inviteCode, setInviteCode] = React.useState('')
  const [messsage, setMessage] = React.useState('bruh')

  const handleInviteCodeChange = (e: any) => {
    setInviteCode(e.target.value)
  }

  const validateCode = async () => {
    setIsLoading(true)
    let res = await validateInviteCode(org?.id, inviteCode, session?.user?.tokens.access_token)
    //wait for 1s
    if (res.success) {
      toast.success(
        "Invite code is valid, you'll be redirected to the signup page in a few seconds"
      )
      setTimeout(() => {
        router.push(`/signup?inviteCode=${inviteCode}&orgslug=${org.slug}`)
      }, 2000)
    } else {
      toast.error('Invite code is invalid')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session && org) {
      setIsLoading(false)
    }
  }, [org, session])

  return (
    <div className="flex flex-row  items-center mx-auto">
      <Toast />
      {isLoading ? (
        <div className="flex space-y-7 flex-col w-[300px] justify-center items-center">
          <PageLoading />
        </div>
      ) : (
        <div className="flex space-y-7 flex-col justify-center items-center">
          <p className="flex space-x-2 text-lg font-medium text-red-800 items-center">
            <MailWarning size={18} />
            <span>An invite code is required to join {org?.name}</span>
          </p>
          <input
            onChange={handleInviteCodeChange}
            className="bg-white outline-2 outline outline-gray-200 rounded-lg px-5 w-[300px] h-[50px]"
            placeholder="Please enter an invite code"
            type="text"
          />
          <button
            onClick={validateCode}
            className="flex w-fit space-x-2 bg-black px-6 py-2 text-md rounded-lg font-semibold h-fit text-white items-center shadow-md"
          >
            <Ticket size={18} />
            <p>Submit </p>
          </button>
        </div>
      )}
    </div>
  )
}

export default SignUpClient
