import fs from 'node:fs/promises'
import path from 'node:path'
import AdminTabs from './AdminTabs'

type AdminPageProps = {
  params: {
    orgslug: string
  }
}

type VersionInfo = {
  version: string
  source: string
}

const formatValue = (value?: string | null) =>
  value && value.trim().length > 0 ? value : 'unknown'

const formatTimestamp = (value?: string | null) => {
  const normalized = value?.trim()
  if (!normalized) return 'unknown'
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return normalized
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`
}

const versionCandidates = (cwd: string) => [
  { label: 'apps/web/package.json', filePath: path.join(cwd, 'apps', 'web', 'package.json') },
  { label: '../apps/web/package.json', filePath: path.join(cwd, '..', 'apps', 'web', 'package.json') },
  { label: '../../apps/web/package.json', filePath: path.join(cwd, '..', '..', 'apps', 'web', 'package.json') },
  { label: 'package.json', filePath: path.join(cwd, 'package.json') },
  { label: '../package.json', filePath: path.join(cwd, '..', 'package.json') },
  { label: '../../package.json', filePath: path.join(cwd, '..', '..', 'package.json') },
]

const readProductVersion = async (): Promise<VersionInfo> => {
  const cwd = process.cwd()
  for (const candidate of versionCandidates(cwd)) {
    try {
      const raw = await fs.readFile(candidate.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed?.version && typeof parsed.version === 'string') {
        return { version: parsed.version, source: candidate.label }
      }
    } catch {
      continue
    }
  }

  return { version: 'unknown', source: 'not found' }
}

export const runtime = 'nodejs'

export default async function AdminPage({ params }: AdminPageProps) {
  const productVersion = await readProductVersion()

  const debugItems = [
    { label: 'Product version', value: productVersion.version },
    { label: 'Version source', value: productVersion.source },
    { label: 'Build time', value: formatTimestamp(process.env.NEXT_PUBLIC_BUILD_TIME ?? process.env.BUILD_TIME) },
    { label: 'Org slug', value: params.orgslug },
    { label: 'Node environment', value: formatValue(process.env.NODE_ENV) },
    { label: 'Node.js version', value: formatValue(process.version) },
    { label: 'Hosting mode', value: formatValue(process.env.NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG) },
    { label: 'Default org', value: formatValue(process.env.NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG) },
    { label: 'API URL', value: formatValue(process.env.NEXT_PUBLIC_LEARNHOUSE_API_URL) },
    { label: 'Backend URL', value: formatValue(process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL) },
  ]

  return (
    <div className="h-full w-full bg-SokratesLightGray">
      <div className="pl-10 pr-10 tracking-tight bg-SokratesWhite shadow-[0px_4px_16px_rgba(0,0,0,0.02)]">
        <div className="h-7"></div>
        <div className="my-2 py-3">
          <div className="w-100 flex flex-col space-y-1">
            <div className="pt-3 flex font-bold text-4xl tracking-tighter text-SokratesBlackBoxShadow">
              Admin
            </div>
            <div className="flex font-medium text-SokratesGrayBorder2 text-md">
              Manage hosting details and organization users
            </div>
          </div>
        </div>
      </div>
      <div className="h-6"></div>
      <div className="px-10 pb-10">
        <AdminTabs debugItems={debugItems} />
      </div>
    </div>
  )
}
