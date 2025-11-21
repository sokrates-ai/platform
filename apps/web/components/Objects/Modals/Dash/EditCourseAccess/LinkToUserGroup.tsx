'use client';
import { useCourse } from '@components/Contexts/CourseContext';
import { useSokratesSession } from '@components/Contexts/SokratesSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import { linkResourcesToUserGroup } from '@services/usergroups/usergroups';
import { swrFetcher } from '@services/utils/ts/requests';
import { Info } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect } from 'react'
import toast from 'react-hot-toast';
import useSWR, { mutate } from 'swr'
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl'

type LinkToUserGroupProps = {
    setUserGroupModal: any
}

function LinkToUserGroup(props: LinkToUserGroupProps) {
    const t = useTranslations('LinkToUserGroup')
    const course = useCourse() as any
    const org = useOrg() as any
    const session = useSokratesSession() as any;
    const access_token = session?.data?.tokens?.access_token;
    const courseStructure = course.courseStructure

    const { data: usergroups } = useSWR(
        courseStructure && org ? `${getAPIUrl()}usergroups/org/${org.id}` : null,
        (url: string) => swrFetcher(url, access_token)
    )
    const [selectedUserGroup, setSelectedUserGroup] = React.useState(null) as any

    const handleLink = async () => {
        const res = await linkResourcesToUserGroup(selectedUserGroup, courseStructure.course_uuid, access_token)
        if (res.status === 200) {
            props.setUserGroupModal(false)
            toast.success(t('toast.linked'))
            mutate(`${getAPIUrl()}usergroups/resource/${courseStructure.course_uuid}`)
        }
        else {
            toast.error(t('toast.error', { status: res.status, detail: res.data.detail }))
        }
    }

    useEffect(() => {
        if (usergroups && usergroups.length > 0) {
            setSelectedUserGroup(usergroups[0].id)
        }
    }, [usergroups])

    return (
        <div className='flex flex-col space-y-1 '>
            <div className='flex bg-yellow-100 text-yellow-900 mx-auto w-fit mt-3 px-4 py-2 space-x-2 text-sm rounded-full items-center'>
                <Info size={19} />
                <h1 className=' font-medium'>
                    {t('notice')}
                </h1>
            </div>
            <div className='p-4 flex-row flex justify-between items-center'>
                {usergroups?.length >= 1 &&
                    <div className='py-1'>
                        <span className='px-3 text-gray-400 font-bold rounded-full py-1 bg-gray-100 mx-3'>
                            {t('labels.usergroupName')}
                        </span>
                        <select
                            onChange={(e) => setSelectedUserGroup(e.target.value)}
                            defaultValue={selectedUserGroup}
                            aria-label={t('labels.usergroupName')}
                        >
                            {usergroups && usergroups.map((group: any) => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                        </select>
                    </div>}
                {usergroups?.length == 0 &&
                    <div className='flex space-x-3 items-center'>
                        <span className='px-3 text-yellow-700 font-bold rounded-full py-1 mx-3'>
                            {t('noGroups')}
                        </span>
                        <Link
                            className='px-3 text-blue-700 font-bold rounded-full py-1 bg-blue-100 mx-1'
                            target='_blank'
                            href={getUriWithOrg(org.slug, '/dash/users/settings/usergroups')}
                            aria-label={t('createGroup')}
                        >
                            {t('createGroup')}
                        </Link>
                    </div>}
                <div className='py-3'>
                    <Button
                        onClick={handleLink}
                        className='text-white font-bold px-4 py-2 rounded-md shadow'
                        aria-label={t('buttons.link')}
                    >
                        {t('buttons.link')}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default LinkToUserGroup