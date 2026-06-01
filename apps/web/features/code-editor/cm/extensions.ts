import type { Extension } from "@codemirror/state"
import { Prec } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { autocompletion, completionKeymap, acceptCompletion, completionStatus, startCompletion } from "@codemirror/autocomplete"
import { indentMore } from "@codemirror/commands"
import { vscodeKeymap } from "@replit/codemirror-vscode-keymap"
import { python as pythonLang } from "@codemirror/lang-python"

import { sanitizeDocumentation } from "./sanitizeDocumentation"
import { sokratesTheme, completionTheme, completionMobileFix } from "./theme"

const startCompletionKeys = Prec.highest(
  keymap.of([
    {
      key: "Ctrl-Space",
      preventDefault: true,
      run: (view) => {
        startCompletion(view)
        return true
      },
    },
    {
      key: "Mod-Space",
      preventDefault: true,
      run: (view) => {
        startCompletion(view)
        return true
      },
    },
  ])
)

const tabAcceptOrIndent = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      preventDefault: true,
      run: (view) => {
        const status = completionStatus(view.state)
        if (status === "active") return acceptCompletion(view)
        return indentMore(view)
      },
    },
  ]),
)

const completionBehavior: Extension = [
  autocompletion({
    activateOnTyping: true,
    icons: true,
    maxRenderedOptions: 200,
  }),
  completionTheme,
  completionMobileFix,
  startCompletionKeys,
  keymap.of([
    ...vscodeKeymap,
    ...completionKeymap,
  ]),
  tabAcceptOrIndent,
]

export function buildExtensions({
  language = "python",
  lspExts = [] as Extension[] | undefined,
  collabExt,
}: {
  language?: string
  lspExts?: Extension[]
  collabExt?: Extension
}): Extension[] {
  const exts: Extension[] = [sokratesTheme, completionBehavior, sanitizeDocumentation]
  if (collabExt) exts.push(collabExt)
  if (Array.isArray(lspExts)) exts.push(...lspExts)
  if (language === "python") exts.unshift(pythonLang())
  return exts
} 