'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface NoTokenScreenProps {
    org: {
        name: string
        slug: string
    }
}

export default function NoTokenScreen({ org }: NoTokenScreenProps) {
    const [code, setCode] = useState('')
    const router = useRouter()

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!code) return
        router.push(
            `/signup?orgslug=${encodeURIComponent(org.slug)}&inviteCode=${encodeURIComponent(code)}`,
        )
    }

    return (
        <div className="bg-gradient-to-br from-[#f5f5f5] to-[#e5e5e5] border-2 border-[#707070] rounded-xl shadow-[0_4px_0_#454545] w-full max-w-md p-8">
            <h2 className="text-xl font-semibold text-center text-[#454545] mb-6">
                Invitation Required
            </h2>

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label htmlFor="inviteCode" className="block text-sm font-medium text-[#454545]">
                        Invitation Code
                    </label>
                    <Input
                        id="inviteCode"
                        name="inviteCode"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="ABCD-1234"
                        className="h-10 w-full border border-[#626262] rounded-md px-3"
                    />
                </div>

                <Button
                    type="submit"
                    disabled={!code}
                    className="w-full h-10 bg-[#e25a26] shadow-[0_4px_0_#c94918] text-white font-semibold rounded-md disabled:opacity-50"
                >
                    Continue
                </Button>
            </form>

            <p className="mt-6 text-center text-sm text-[#454545]">
                Don't have an invitation?{' '}
                <a
                    href="mailto:support@yourorg.com"
                    className="font-semibold text-[#e25a26] hover:underline"
                >
                    Contact your administrator
                </a>
            </p>
        </div>
    )
}
