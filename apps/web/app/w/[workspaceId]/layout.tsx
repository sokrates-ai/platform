import type { ReactNode } from 'react'

import { SessionProvider as WorkspaceSessionProvider } from '@/shared/hooks/useSession'

export default function LegacyWorkspaceRouteLayout({
  children,
}: {
  children: ReactNode
}) {
  return <WorkspaceSessionProvider>{children}</WorkspaceSessionProvider>
}
