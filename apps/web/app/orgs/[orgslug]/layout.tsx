'use client'
import { OrgProvider } from '@components/Contexts/OrgContext'
import { FeatureFlagsProvider } from '@components/Hooks/useFeatureFlag'
import Footer from '@components/Objects/Footer'
import NextTopLoader from 'nextjs-toploader';
import '@styles/globals.css'
// import Onboarding from '@components/Objects/Onboarding/Onboarding';

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: any
}) {
  return (
    <div>
      <OrgProvider orgslug={params.orgslug}>
        <FeatureFlagsProvider>
          <NextTopLoader shadow={false} color="#E25A26" initialPosition={0.3} height={4}  easing={'ease'} speed={500} showSpinner={false} />
          {/* <Onboarding /> */}
          {children}
          <Footer />
        </FeatureFlagsProvider>
      </OrgProvider>
    </div>
  )
}
