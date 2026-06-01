export interface WorkspaceSpec {
  language?: string
  starterCode?: string
  pythonPath?: string
  extraPaths?: string[]
  typeCheckingMode?: "off" | "basic" | "strict"
  diagnosticMode?: "openFilesOnly" | "workspace"
}

export type MobileConsoleTab = "results" | "terminal" 