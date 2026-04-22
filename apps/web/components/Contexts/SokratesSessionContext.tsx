'use client'
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession } from 'next-auth/react';
import React, { useContext, createContext, useEffect, useMemo, useState } from 'react'

export const SessionContext = createContext({}) as any

function SokratesSessionProvider({ children }: { children: React.ReactNode }) {
    const session = useSession();
    const [rewardOverride, setRewardOverride] = useState<{
        coins?: number
        level?: number
        level_progress?: number
    } | null>(null)

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent)?.detail
            if (!detail || typeof detail !== 'object') {
                return
            }
            setRewardOverride((current) => ({
                ...(current ?? {}),
                ...detail,
            }))
        }
        window.addEventListener('reward_update', handler as EventListener)
        return () => {
            window.removeEventListener('reward_update', handler as EventListener)
        }
    }, [])

    useEffect(() => {
        if (session?.data?.user?.id) {
            setRewardOverride(null)
        }
    }, [session?.data?.user?.id])

    const sessionValue = useMemo(() => {
        if (!session?.data?.user || !rewardOverride) {
            return session
        }
        return {
            ...session,
            data: {
                ...session.data,
                user: {
                    ...session.data.user,
                    ...rewardOverride,
                },
            },
        }
    }, [rewardOverride, session])

    if (session && session.status == 'loading') {
        return <PageLoading />
    }

    else if (session) {
        return (
            <SessionContext.Provider value={sessionValue}>
                {children}
            </SessionContext.Provider>
        )
    }
}

export function useSokratesSession() {
    return useContext(SessionContext)
}

export default SokratesSessionProvider
