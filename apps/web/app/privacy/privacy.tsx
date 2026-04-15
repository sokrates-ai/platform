'use client'

import React from 'react'
import LegalPage from '@components/Pages/LegalPage'

const summary = [
  'We collect account details and profile data provided by you or Hasso Plattner Institut (HPI).',
  'Sokrates is hosted on a German hosting provider and on HPI infrastructure, so these operators could see what we do.',
  'PostHog session replays and crash reports may be accessed by the Sokrates developers and PostHog.',
  'Data sent to Sokrates may be used to train or fine-tune in-house HPI machine learning models to improve learning.',
  'Data is retained as long as possible, but Sokrates is not liable for partial or complete data loss.',
]

const sections = [
  {
    title: 'Information we collect',
    paragraphs: [
      'The information we collect depends on how HPI uses Sokrates and how you interact with the platform.',
    ],
    bullets: [
      'Account and profile data such as name, email address, role, and HPI affiliation.',
      'Learning content and submissions you create, upload, or share in courses and assignments.',
      'Usage data like pages viewed, actions taken, and feature interactions.',
      'Device and log data such as browser type, IP address, and timestamps for security and diagnostics.',
      'Support communications if you contact us directly.',
    ],
  },
  {
    title: 'Hosting and infrastructure',
    paragraphs: [
      'Sokrates is hosted on a German hosting provider and on HPI infrastructure. Operators of these systems may be able to see platform activity to ensure uptime, security, and maintenance.',
    ],
  },
  {
    title: 'Session replay and crash reporting',
    paragraphs: [
      'Sokrates uses PostHog to collect session replays and crash reports. The Sokrates developers and PostHog may access this information to diagnose issues and improve the platform.',
    ],
  },
  {
    title: 'Machine learning use',
    paragraphs: [
      'Any data sent to the Sokrates server and stored in its databases can be used to train or fine-tune in-house HPI machine learning models.',
      'This information is never sold outside of HPI and is strictly limited to HPI-internal projects aimed at enhancing the student learning experience.',
    ],
  },
  {
    title: 'How we use information',
    bullets: [
      'Provide, maintain, and improve the Sokrates learning experience.',
      'Personalize course delivery, progress tracking, and feedback workflows.',
      'Secure the platform, prevent abuse, and troubleshoot issues.',
      'Communicate service updates and respond to support requests.',
    ],
  },
  {
    title: 'How we share information',
    paragraphs: [
      'We share information only as needed to operate the platform and support HPI\'s learning workflows.',
    ],
    bullets: [
      'With HPI so instructors and administrators can manage learning programs.',
      'With service providers who host infrastructure, analytics, or communications on our behalf.',
      'When required by law, regulation, or to protect the rights and safety of users.',
    ],
  },
  {
    title: 'Data retention and loss',
    paragraphs: [
      'We retain personal information for as long as possible to support learning operations and HPI\'s needs.',
      'Sokrates is not liable for partial or complete data loss of the server, even though we take steps to prevent it.',
    ],
  },
  {
    title: 'Conduct expectations',
    paragraphs: [
      'Sokrates tries to respect the "dont be an asshole" policy. Please keep interactions constructive and respectful.',
    ],
  },
  {
    title: 'Your choices and rights',
    paragraphs: [
      'You can access, correct, or delete certain information through your account settings or by contacting the HPI administrator.',
      'Depending on where you live, you may have additional rights. HPI or Sokrates support can help you exercise them.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'We use administrative, technical, and organizational safeguards to protect information. No system is completely secure, so we encourage you to use strong passwords and protect your access links.',
    ],
  },
  {
    title: 'Updates to this policy',
    paragraphs: [
      'We may update this policy as the platform evolves. When changes are material, we will provide notice through the service or via HPI.',
    ],
  },
  {
    title: 'Questions or concerns',
    paragraphs: [
      'HPI remains the best first contact for privacy questions. They can escalate to Sokrates support if needed.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="This policy explains what data Sokrates collects, how it is used, and the choices available to you."
      intro="We aim to keep this transparent and readable. HPI's data processing agreement may provide additional details."
      badgeLabel="Privacy"
      summary={summary}
      meta={[
        { label: 'Version', value: '1.0' },
        { label: 'Scope', value: 'Personal data' },
      ]}
      sections={sections}
      relatedLinks={[{ label: 'Terms & Conditions', href: '/terms' }]}
      contactBody="Privacy requests are handled through the HPI admin team. They can coordinate with Sokrates support for anything beyond account changes."
      footnote="This overview does not replace contractual privacy commitments between Sokrates and HPI."
    />
  )
}
