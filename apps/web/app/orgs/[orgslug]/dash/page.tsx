import { redirect } from 'next/navigation'

type DashProps = {
  params: { orgslug: string }
}

export default function DashPage({ params }: DashProps) {
  redirect(`/`)
}
