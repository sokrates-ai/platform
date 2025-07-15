'use client'
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession } from 'next-auth/react';
import React, { useContext, createContext } from 'react'

export const SessionContext = createContext({}) as any

function SokratesSessionProvider({ children }: { children: React.ReactNode }) {
    const session = useSession();

    if (session && session.status == 'loading') {
        return <PageLoading />
    }

    else if (session) {
        return (
            <SessionContext.Provider value={session}>
                {children}
            </SessionContext.Provider>
        )
    }
}

export function useSokratesSession() {
    return useContext(SessionContext)
}

export default SokratesSessionProvider