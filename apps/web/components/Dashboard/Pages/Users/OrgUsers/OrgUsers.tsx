import { useSokratesSession } from '@components/Contexts/SokratesSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import RolesUpdate from '@components/Objects/Modals/Dash/OrgUsers/RolesUpdate'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import { getAPIUrl } from '@services/config/config'
import { removeUserFromOrg } from '@services/organizations/orgs'
import { swrFetcher } from '@services/utils/ts/requests'
import { EllipsisVertical, KeyRound, LogOut, ScanEye } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import toast from 'react-hot-toast'
import useSWR, { mutate } from 'swr'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'

function OrgUsers() {
  const org = useOrg() as any
  const session = useSokratesSession() as any;
  const router = useRouter()
  const access_token = session?.data?.tokens?.access_token;
  const { data: orgUsers } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/users` : null,
    (url: string) => swrFetcher(url, access_token)
  )
  const { data: onlineStatusData } = useSWR(
    access_token ? `${getAPIUrl()}users/online-status` : null,
    (url: string) => swrFetcher(url, access_token),
    { refreshInterval: 10000 }
  )
  const [rolesModal, setRolesModal] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState(null) as any
  const [isLoading, setIsLoading] = React.useState(true)
  const [impersonatingUserId, setImpersonatingUserId] = React.useState<number | null>(null)

  const handleRolesModal = (user_uuid: any) => {
    setSelectedUser(user_uuid)
    setRolesModal(!rolesModal)
  }

  const openRolesModal = (user_uuid: any) => {
    setSelectedUser(user_uuid)
    setRolesModal(true)
  }

  const handleRemoveUser = async (user_id: any) => {
    const res = await removeUserFromOrg(org.id, user_id,access_token)
    if (res.status === 200) {
      await mutate(`${getAPIUrl()}orgs/${org.id}/users`)
    } else {
      toast.error('Error ' + res.status + ': ' + res.data.detail)
    }
  }

  const handleImpersonateUser = async (user_id: number) => {
    if (!access_token || !org?.id) {
      toast.error('Unable to impersonate: missing session or organization.')
      return
    }

    setImpersonatingUserId(user_id)
    const res = await signIn('credentials', {
      redirect: false,
      impersonate_user_id: user_id,
      org_id: org.id,
      admin_access_token: access_token,
      callbackUrl: '/redirect_from_auth',
    })

    if (res?.error) {
      toast.error('Impersonation failed. Please try again.')
      setImpersonatingUserId(null)
      return
    }

    router.push('/redirect_from_auth')
  }

  useEffect(() => {
    if (orgUsers) {
      setIsLoading(false)
    }
  }, [org, orgUsers])

  const getRoleBadge = (role: any) => {
    const roleUuid = role?.role_uuid
    const roleId = role?.id
    if (roleUuid === 'role_global_student' || roleId === 3) {
      return { label: 'student', className: 'bg-blue-100 text-blue-700' }
    }
    if (roleUuid === 'role_global_tutor' || roleId === 4) {
      return { label: 'tutor', className: 'bg-amber-100 text-amber-700' }
    }
    if (roleUuid === 'role_global_admin' || roleId === 1) {
      return { label: 'admin', className: 'bg-rose-100 text-rose-700' }
    }
    if (roleUuid === 'role_global_maintainer' || roleId === 2) {
      return { label: 'maintainer', className: 'bg-emerald-100 text-emerald-700' }
    }
    const fallbackLabel = role?.name ? role.name.toLowerCase() : 'role'
    return { label: fallbackLabel, className: 'bg-gray-100 text-gray-700' }
  }

  const onlineStatusMap = React.useMemo(() => {
    const entries = onlineStatusData?.users ?? []
    return new Map(entries.map((entry: any) => [entry.user_id, entry.online]))
  }, [onlineStatusData])

  return (
    <div>
      {isLoading ? (
        <div>
          <PageLoading />
        </div>
      ) : (
        <>
          <Toast></Toast>
          <div className="h-6"></div>
          <div className="ml-10 mr-10 mx-auto bg-white rounded-xl shadow-sm px-4 py-4  ">
            <div className="flex flex-col bg-gray-50 -space-y-1  px-5 py-3 rounded-md mb-3 ">
              <h1 className="font-bold text-xl text-gray-800">Active users</h1>
              <h2 className="text-gray-500  text-md">
                {' '}
                Manage your organization users, assign roles and permissions{' '}
              </h2>
            </div>
            <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
              <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
                <tr className="font-bolder text-sm">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4 text-center">Badge</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <>
                <tbody className="mt-5 bg-white rounded-md">
                  {orgUsers?.map((user: any) => {
                    const firstName = user?.user?.first_name?.trim?.() ?? ''
                    const lastName = user?.user?.last_name?.trim?.() ?? ''
                    const fullName = `${firstName} ${lastName}`.trim()
                    const displayName = fullName.length > 0 ? fullName : user?.user?.username
                    const roleBadge = getRoleBadge(user?.role)
                    const isOnline = onlineStatusMap.get(user.user.id) ?? false
                    return (
                      <tr
                        key={user.user.id}
                        className="border-b border-gray-200 border-dashed"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate">
                              {displayName}
                            </span>
                            <span className="shrink-0 rounded-full bg-neutral-100 p-1 px-2 text-xs font-semibold text-neutral-400">
                              @{user.user.username}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${roleBadge.className}`}
                          >
                            {roleBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              isOnline
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            />
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="hidden lg:flex space-x-2 items-end">
                            <button
                              type="button"
                              className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-blue-700 rounded-md font-bold items-center text-sm text-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                              onClick={() => handleImpersonateUser(user.user.id)}
                              disabled={impersonatingUserId === user.user.id}
                            >
                              <ScanEye className="w-4 h-4" />
                              <span>
                                {impersonatingUserId === user.user.id
                                  ? 'Impersonating...'
                                  : 'Impersonate'}
                              </span>
                            </button>
                            <Modal
                              isDialogOpen={
                                rolesModal && selectedUser === user.user.user_uuid
                              }
                              onOpenChange={() =>
                                handleRolesModal(user.user.user_uuid)
                              }
                              minHeight="no-min"
                              dialogContent={
                                <RolesUpdate
                                  alreadyAssignedRole={user.role.role_uuid}
                                  setRolesModal={setRolesModal}
                                  user={user}
                                />
                              }
                              dialogTitle="Update Role"
                              dialogDescription={
                                'Update @' + user.user.username + "'s role"
                              }
                              dialogTrigger={
                                <button className="flex space-x-2 hover:cursor-pointer p-1 px-3 bg-yellow-700 rounded-md font-bold items-center text-sm text-yellow-100">
                                  <KeyRound className="w-4 h-4" />
                                  <span> Edit Role</span>
                                </button>
                              }
                            />

                            <ConfirmationModal
                              confirmationButtonText="Remove User"
                              confirmationMessage="Are you sure you want remove this user from the organization?"
                              dialogTitle={'Delete ' + user.user.username + ' ?'}
                              dialogTrigger={
                                <button className="mr-2 flex space-x-2 hover:cursor-pointer p-1 px-3 bg-rose-700 rounded-md font-bold items-center text-sm text-rose-100">
                                  <LogOut className="w-4 h-4" />
                                  <span> Remove from organization</span>
                                </button>
                              }
                              functionToExecute={() => {
                                handleRemoveUser(user.user.id)
                              }}
                              status="warning"
                            ></ConfirmationModal>
                          </div>
                          <div className="flex lg:hidden justify-end">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="p-2 bg-gray-100 rounded-md text-gray-600 hover:bg-gray-200"
                                  aria-label="Open user actions"
                                >
                                  <EllipsisVertical className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                  onSelect={() => handleImpersonateUser(user.user.id)}
                                  disabled={impersonatingUserId === user.user.id}
                                >
                                  <ScanEye className="w-4 h-4" />
                                  <span>
                                    {impersonatingUserId === user.user.id
                                      ? 'Impersonating...'
                                      : 'Impersonate'}
                                  </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => openRolesModal(user.user.user_uuid)}
                                >
                                  <KeyRound className="w-4 h-4" />
                                  <span>Edit Role</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <ConfirmationModal
                                    confirmationButtonText="Remove User"
                                    confirmationMessage="Are you sure you want remove this user from the organization?"
                                    dialogTitle={'Delete ' + user.user.username + ' ?'}
                                    dialogTrigger={
                                      <button className="w-full text-left flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">
                                        <LogOut className="w-4 h-4" />
                                        <span>Remove from organization</span>
                                      </button>
                                    }
                                    functionToExecute={() => {
                                      handleRemoveUser(user.user.id)
                                    }}
                                    status="warning"
                                  ></ConfirmationModal>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default OrgUsers
