'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { usePostHog } from 'posthog-js/react'
import { Suspense } from 'react';

function PosthogIdentity(){
    const { data: session, status } = useLHSession();
    const posthog = usePostHog();

    if(status == "unauthenticated" || status == "loading"){
        posthog.reset();
        return null;
    }

    const email = session?.user?.email;
    const username = session?.user.username;
    const userId = session?.user.user_uuid;
    if(
      typeof email === "string" 
      && typeof username === "string" 
      && typeof userId === "string"
    ){
        posthog.identify(
            userId,
            { email: email, name: username},
        )
    }
    return null
}


// Wrap this in Suspense to avoid the `useSearchParams` usage above
// from de-opting the whole app into client-side rendering
// See: https://nextjs.org/docs/messages/deopted-into-client-rendering
export default function SuspendedPosthogIdentity() {
  return <Suspense fallback={null}>
    <PosthogIdentity />
  </Suspense>
}