'use client'
import learnhouseIcon from 'public/learnhouse_bigicon_1.png'
import Image from 'next/image'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { useEffect } from 'react'
import { MailWarning, Ticket, UserPlus, Loader2 } from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import UserAvatar from '@components/Objects/UserAvatar'
import OpenSignUpComponent from './OpenSignup'
import InviteOnlySignUpComponent from './InviteOnlySignUp'
import { useRouter, useSearchParams } from 'next/navigation'
import { validateInviteCode } from '@services/organizations/invites'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import toast from 'react-hot-toast'
import { joinOrg } from '@services/organizations/orgs'
import whiteLogo from 'public/white_logo.svg'
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

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
    <div className="grid md:grid-cols-2 min-h-screen">
      {/* Left side (dark background) */}
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
          <div className="text-center hidden md:block">
            <div className="flex items-center space-x-2">
              <p className="text-lg md:text-2xl">Create your</p>
              <Image
                quality={100}
                width={120}
                height={120}
                src={whiteLogo}
                alt="Logo"
                className="hover:opacity-80 transition-opacity"
              />
              <p className="text-lg md:text-2xl">Account today!</p>
            </div>
          </div>
        </div>
        <div className="hidden md:block"> {/* Spacer for desktop layout */}
        </div>
      </div>

      {/* Right side (white background) */}
      <div className="bg-white flex items-center justify-center p-6 md:p-10">
        <Toast />
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
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const router = useRouter()

  const join = async () => {
    setIsSubmitting(true)
    const res = await joinOrg({ org_id: org.id, user_id: session?.data?.user?.id, invite_code: props.inviteCode }, null, session.data?.tokens?.access_token)

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
    <Card className="w-full max-w-md shadow-none border-none">
      <CardHeader className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-center">
          Join {org?.name}
        </h2>
        <p className="text-sm text-muted-foreground text-center">
          Hi {session?.data?.username}, you're about to join this organization.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-6">
        <div className="flex items-center space-x-3">
          <UserAvatar rounded="rounded-xl" border="border-4" width={42} />
          <span className="text-lg font-medium">{session?.data?.username}</span>
        </div>

        <Button
          onClick={() => join()}
          className="flex items-center space-x-2 px-6"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            <>
              <UserPlus size={18} />
              <span>Join Organization</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

const NoTokenScreen = (props: any) => {
  const session = useLHSession() as any
  const org = useOrg() as any
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(true)
  const [inviteCode, setInviteCode] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleInviteCodeChange = (e: any) => {
    setInviteCode(e.target.value)
  }

  const validateCode = async () => {
    setIsSubmitting(true)
    let res = await validateInviteCode(org?.id, inviteCode, session?.user?.tokens.access_token)

    if (res.success) {
      toast.success(
        "Invite code is valid, you'll be redirected to the signup page in a few seconds"
      )
      setTimeout(() => {
        router.push(`/signup?inviteCode=${inviteCode}&orgslug=${org.slug}`)
      }, 2000)
    } else {
      toast.error('Invite code is invalid')
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (session && org) {
      setIsLoading(false)
    }
  }, [org, session])

  return (
    <Card className="w-full max-w-md shadow-none border-none">
      <CardHeader className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-center">
          Invitation Required
        </h2>
        <p className="text-sm text-muted-foreground text-center">
          An invitation code is required to join {org?.name}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <PageLoading />
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-2 text-red-800 bg-red-50 p-3 rounded-md">
              <MailWarning size={18} />
              <span className="text-sm">Please enter your invitation code</span>
            </div>

            <Input
              onChange={handleInviteCodeChange}
              className="w-full"
              placeholder="Enter your invitation code"
              type="text"
            />

            <Button
              onClick={validateCode}
              className="w-full flex items-center justify-center space-x-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Ticket size={18} className="mr-2" />
                  Verify Invitation
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SignUpClient