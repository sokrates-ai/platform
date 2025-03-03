import { Metadata } from 'next'
import React from 'react'
import ClientAdminLayout from './ClientAdminLayout'

export const metadata: Metadata = {
  title: 'Sokrates Dashboard',
}

function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: any
}) {
  return (
    <>
      <ClientAdminLayout
        params={params}>
        {children}
      </ClientAdminLayout>
    </>
  )
}

export default DashboardLayout
