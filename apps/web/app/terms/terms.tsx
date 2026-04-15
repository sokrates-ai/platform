'use client'

import React from 'react'
import Link from 'next/link'
import LegalPage from '@components/Pages/LegalPage'

const summary = [
  'Use Sokrates only for authorized, lawful educational purposes at Hasso Plattner Institut (HPI).',
  'Do not attempt to hack, probe, or use the system in unintended ways.',
  'Report security or technical issues to Timo Koetzing or Mik Mueller.',
  'HPI code of conduct applies to all free-text content and interactions.',
  'Moodle remains the source of truth for official data.',
]

const sections = [
  {
    title: 'Scope of these terms',
    paragraphs: [
      'These terms govern access to the Sokrates platform and related services. By creating an account, signing in, or using the service, you agree to follow them.',
      'If HPI has a separate agreement with Sokrates, that agreement may supersede or add to these terms for HPI users.',
    ],
  },
  {
    title: 'Accounts and access',
    paragraphs: [
      'Accounts are typically provisioned and managed by HPI. You are responsible for activity that happens under your credentials.',
    ],
    bullets: [
      'Provide accurate profile information and keep it up to date.',
      'Keep passwords and access links confidential and use multi-factor authentication when offered.',
      'Let HPI know right away if you suspect unauthorized access.',
    ],
  },
  {
    title: 'Acceptable use',
    paragraphs: [
      'Use the service in ways that respect other learners, instructors, and platform integrity.',
    ],
    bullets: [
      'Do not attempt to access accounts, data, or systems you are not authorized to use.',
      'Do not try to hack the system or use it in unintended ways.',
      'Do not disrupt or degrade the service, including by probing, scraping, or overloading it.',
      'Do not upload or share content that is unlawful, harmful, or infringes intellectual property rights.',
    ],
  },
  {
    title: 'Code of conduct',
    paragraphs: [
      <>
        The HPI code of conduct applies to Sokrates. You can review it at{' '}
        <Link href="https://hpi.de" className="underline underline-offset-4">
          hpi.de
        </Link>
        .
      </>,
    ],
    bullets: [
      'Any free-text forms, comments, or uploads must not include content that violates the code of conduct.',
    ],
  },
  {
    title: 'Respectful collaboration',
    paragraphs: [
      'Be respectful to both the team behind Sokrates and to the tutors who use it.',
    ],
  },
  {
    title: 'Security and technical issues',
    paragraphs: [
      'If you encounter a security or technical problem, report it to Timo Koetzing or Mik Mueller.',
      'Please do not test vulnerabilities on production systems beyond what is necessary to confirm the issue.',
    ],
  },
  {
    title: 'Authoritative data',
    paragraphs: [
      'Sokrates is not the authoritative data instance for now. Moodle remains the source of truth for official records.',
    ],
  },
  {
    title: 'Your content and intellectual property',
    paragraphs: [
      'You retain ownership of content you create or upload. You grant Sokrates and HPI a limited license to host, process, display, and distribute that content solely to operate the service and deliver learning experiences.',
      'You are responsible for ensuring you have the necessary rights to any content you upload or share.',
    ],
  },
  {
    title: 'Service changes and availability',
    paragraphs: [
      'We continuously improve the platform and may add, modify, or remove features. We will try to provide notice before making material changes that affect your experience.',
      'Maintenance or unexpected outages may occasionally make the service unavailable.',
    ],
  },
  {
    title: 'Suspension and termination',
    paragraphs: [
      'We may suspend or terminate access if we reasonably believe there is a violation of these terms, a security risk, or a legal requirement to do so.',
      'HPI can also suspend or remove accounts under its own policies.',
    ],
  },
  {
    title: 'Disclaimers and limits',
    paragraphs: [
      'The service is provided on an "as available" basis. While we strive for reliability, we do not guarantee uninterrupted access or error-free operation.',
      'To the extent permitted by law, Sokrates is not liable for indirect, incidental, or consequential damages related to your use of the service.',
    ],
  },
  {
    title: 'Questions or concerns',
    paragraphs: [
      'If you have questions about these terms, start with HPI. They can coordinate with Sokrates support as needed.',
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      subtitle="These terms set the expectations for using Sokrates safely, respectfully, and as intended by Hasso Plattner Institut (HPI)."
      intro="We've kept this version readable. HPI's agreement with Sokrates may add additional obligations or controls."
      badgeLabel="Terms"
      summary={summary}
      meta={[
        { label: 'Version', value: '1.0' },
        { label: 'Applies to', value: 'All Sokrates users' },
      ]}
      sections={sections}
      relatedLinks={[{ label: 'Privacy Policy', href: '/privacy' }]}
      contactBody="HPI is the primary contact for account access, permissions, and learning workflows. For platform-level questions, they can reach Sokrates support."
      footnote="This summary is provided for clarity and does not replace any separate agreement between Sokrates and HPI."
    />
  )
}
