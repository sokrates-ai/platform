'use client'
import { OrgProvider } from '@components/Contexts/OrgContext'
import ErrorUI from '@components/Objects/StyledElements/Error/Error'
import { useSearchParams } from 'next/navigation'
import AuthBgLayout from '@components/Pages/AuthLayout'


export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const searchParams = useSearchParams()
    const orgslug = searchParams.get('orgslug')
    if (orgslug) {
        return (
            <OrgProvider orgslug={orgslug}>
                <AuthBgLayout>
                    {children}
                </AuthBgLayout>
            </OrgProvider>
        )
    } else {
        return <ErrorUI message='Organization not specified' submessage='Please access this page from an Organization' />
    }
}