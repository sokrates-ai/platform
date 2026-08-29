import DOMPurify from 'dompurify'
import { z } from 'zod'

export const JSON_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024
export const JSON_IMPORT_MAX_PROBLEMS = 500

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  }, 'Must be an absolute HTTP or HTTPS URL')

const problemSchema = z
  .object({
    id: z.union([
      z.number().finite(),
      z.string().trim().min(1).max(128),
    ]).optional(),
    title: z.string().trim().min(1).max(200),
    status: z.string().trim().min(1).max(100).optional(),
    plainText: z.string().max(100_000).optional(),
    html: z.string().max(250_000).optional(),
    imageUrl: httpUrl.optional(),
    chapterName: z.string().trim().min(1).max(200).optional(),
    checkpointLevel: z.enum(['bronze', 'silver', 'gold']).optional(),
  })
  .strict()

const documentSchema = z
  .object({
    version: z.literal(1),
    sourceUrl: httpUrl.optional(),
    problems: z
      .array(problemSchema)
      .min(1, 'Add at least one problem')
      .max(
        JSON_IMPORT_MAX_PROBLEMS,
        `A JSON import can contain at most ${JSON_IMPORT_MAX_PROBLEMS} problems`,
      ),
  })
  .strict()

export type JsonCourseImportProblem = z.infer<typeof problemSchema>

export type JsonCourseImportDocument = {
  version: 1
  sourceUrl?: string
  problems: JsonCourseImportProblem[]
}

export type JsonImportIssue = {
  path: string
  message: string
}

export type JsonImportParseResult =
  | { success: true; data: JsonCourseImportDocument; issues: [] }
  | { success: false; data: null; issues: JsonImportIssue[] }

const formatPath = (path: Array<string | number>): string => {
  if (!path.length) return 'document'
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') return `${result}[${segment}]`
    return result ? `${result}.${segment}` : segment
  }, '')
}

const getJsonSyntaxIssue = (text: string, error: unknown): JsonImportIssue => {
  const message = error instanceof Error ? error.message : 'Invalid JSON syntax'
  const positionMatch = message.match(/position\s+(\d+)/i)
  if (!positionMatch) return { path: 'document', message }

  const position = Number(positionMatch[1])
  const beforeError = text.slice(0, position)
  const lines = beforeError.split('\n')
  return {
    path: `line ${lines.length}, column ${lines.at(-1)!.length + 1}`,
    message,
  }
}

const htmlHasMeaningfulText = (html: string): boolean => {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return Boolean(document.body.textContent?.replace(/\s+/g, ' ').trim())
}

export const parseJsonCourseImport = (text: string): JsonImportParseResult => {
  if (!text.trim()) {
    return {
      success: false,
      data: null,
      issues: [{ path: 'document', message: 'Paste JSON or select a file' }],
    }
  }

  let candidate: unknown
  try {
    candidate = JSON.parse(text)
  } catch (error) {
    return {
      success: false,
      data: null,
      issues: [getJsonSyntaxIssue(text, error)],
    }
  }

  const parsed = documentSchema.safeParse(candidate)
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      issues: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    }
  }

  const issues: JsonImportIssue[] = []
  const seenIds = new Set<string>()
  const problems = parsed.data.problems.map((problem, index) => {
    if (problem.id !== undefined) {
      const idKey = `${typeof problem.id}:${String(problem.id)}`
      if (seenIds.has(idKey)) {
        issues.push({
          path: `problems[${index}].id`,
          message: `Duplicate problem ID: ${String(problem.id)}`,
        })
      }
      seenIds.add(idKey)
    }

    const plainText = problem.plainText?.trim()
    const sanitizedHtml = problem.html
      ? DOMPurify.sanitize(problem.html, {
          FORBID_TAGS: [
            'script',
            'style',
            'noscript',
            'iframe',
            'object',
            'embed',
            'img',
            'video',
            'audio',
          ],
        }).trim()
      : undefined
    const hasHtmlText = sanitizedHtml
      ? htmlHasMeaningfulText(sanitizedHtml)
      : false

    if (problem.checkpointLevel && problem.chapterName) {
      issues.push({
        path: `problems[${index}].chapterName`,
        message: 'Checkpoints are map markers and cannot define a chapter name',
      })
    }
    if (
      !problem.checkpointLevel &&
      !plainText &&
      !hasHtmlText &&
      !problem.imageUrl
    ) {
      issues.push({
        path: `problems[${index}]`,
        message: 'Add plainText, meaningful HTML, or an imageUrl',
      })
    }

    return {
      ...problem,
      title: problem.title.trim(),
      ...(problem.status ? { status: problem.status.trim() } : {}),
      ...(plainText ? { plainText } : { plainText: undefined }),
      ...(sanitizedHtml ? { html: sanitizedHtml } : { html: undefined }),
      ...(problem.chapterName
        ? { chapterName: problem.chapterName.trim() }
        : {}),
    }
  })

  if (issues.length) return { success: false, data: null, issues }

  return {
    success: true,
    data: {
      version: 1,
      ...(parsed.data.sourceUrl
        ? { sourceUrl: parsed.data.sourceUrl }
        : {}),
      problems,
    },
    issues: [],
  }
}

export const JSON_IMPORT_EXAMPLE = JSON.stringify(
  {
    version: 1,
    sourceUrl: 'https://example.com/course',
    problems: [
      {
        id: 'problem-1',
        title: 'Growth rates',
        plainText: 'Arrange these functions by asymptotic growth.',
        chapterName: 'Asymptotic notation',
      },
      {
        id: 'checkpoint-1',
        title: 'Bronze checkpoint',
        checkpointLevel: 'bronze',
      },
    ],
  },
  null,
  2,
)
