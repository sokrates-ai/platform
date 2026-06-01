import type { Extension } from "@codemirror/state"
import { languageServer, PyrightInitializationOptions } from "codemirror-languageserver"

export function makePythonLspExtensions({
  serverUri,
  rootUri,
  documentUri,
  initializationOptions,
}: {
  serverUri: `ws://${string}` | `wss://${string}`
  rootUri: string
  documentUri: string
  initializationOptions: PyrightInitializationOptions
}): Extension[] {
  const lsp = languageServer({
    serverUri,
    rootUri,
    documentUri,
    languageId: "python",
    workspaceFolders: [{ name: "workspace", uri: rootUri }],
    initializationOptions,
    allowHTMLContent: true,
  } as unknown as Parameters<typeof languageServer>[0])
  return Array.isArray(lsp) ? lsp : [lsp]
} 