'use client';
import DashLeftMenu from '@components/Dashboard/Menus/DashLeftMenu';
import DashMobileMenu from '@components/Dashboard/Menus/DashMobileMenu';
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { SessionProvider } from 'next-auth/react'
import React from 'react'
import { useMediaQuery } from 'usehooks-ts';

function ClientAdminLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: any
}) {
    const isMobile = useMediaQuery('(max-width: 768px)')

    return (
        <SessionProvider>
            <AdminAuthorization authorizationMode="page">
                <div className="flex flex-col md:flex-row min-h-screen">
                    {isMobile ? (
                        <DashMobileMenu />
                    ) : (
                        <DashLeftMenu />
                    )}
                    <div className={`flex w-full ${isMobile ? 'pb-24 pt-2' : ''}`}>{children}</div>
                </div>
            </AdminAuthorization>
        </SessionProvider>
    )
}

export default ClientAdminLayout
