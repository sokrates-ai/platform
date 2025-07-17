'use client'
import '@styles/globals.css'
import { SessionProvider } from 'next-auth/react'
import Watermark from '@components/Objects/Watermark'
import { OrgMenu } from '@components/Objects/Menus/OrgMenu'

export default function RootLayout({
	children,
	params,
}: {
	children: React.ReactNode
	params: any
}) {
	return (
		<div className="relative w-full min-h-screen overflow-hidden">
			<div className="fixed inset-0 bg-white z-[-1]" />
			<div className="fixed inset-0 bg-[url('/background-1.svg')] bg-repeat bg-auto opacity-15 z-0" />
			
			<div className="relative z-10">
				<SessionProvider>
					<OrgMenu orgslug={params?.orgslug}></OrgMenu>
					{children}
				</SessionProvider>
			</div>
		</div>
	)
}
