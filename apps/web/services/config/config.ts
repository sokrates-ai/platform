export const LEARNHOUSE_HTTP_PROTOCOL =
  process.env.NEXT_PUBLIC_LEARNHOUSE_HTTPS === 'true' ? 'https://' : 'http://'
const LEARNHOUSE_API_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_API_URL}`
export const LEARNHOUSE_BACKEND_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL}`
export const LEARNHOUSE_DOMAIN = process.env.NEXT_PUBLIC_LEARNHOUSE_DOMAIN
export const LEARNHOUSE_TOP_DOMAIN =
  process.env.NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN

export const isDevEnv = process.env.NODE_ENV != 'production'


export function LEARNHOUSE_BASE_URL(): string {
    // NOTE: This is stupid because nextJS will try to fetch environment variables at build time!!!
    let L = 'L'
    let url = process.env['NEXT_PUBLIC_LEARNHOUSE_BASE_UR' + L]

    console.log(`server BASE_URL=${url}`)
    if (!url) {
        // console.error("NEXT_PUBLIC_LEARNHOUSE_BASE_URL undefined")
        return "error"
    }
    return url
}

function getLearnhouseBaseURL(): string {
    let url: string | null = null

    if (isDevEnv || typeof window === 'undefined') {
        // TODO: i need to fix this
        url = LEARNHOUSE_BASE_URL()
        // console.error("RUNNING IN SERVER MODE: " + url)
    } else {
        const fullhost = window.location.host;
        const proto = window.location.protocol;
        url = `${proto}//${fullhost}`
    }

    console.log(`base_URL=${url}`)
    return url
}

export const getAPIUrl = () => {
    let url: string | null = null

    if (isDevEnv || typeof window === 'undefined') {
        // TODO: i need to fix this
        url = LEARNHOUSE_API_URL
        // console.error("(API) RUNNING IN SERVER MODE: " + url)
    } else {
        const fullhost = window.location.host;
        const proto = window.location.protocol;
        url = `${proto}//${fullhost}/api/v1/`
    }

    console.log(`API_URL=${url}`)
    return url
}

export const getBackendUrl = () => LEARNHOUSE_BACKEND_URL

// Multi Organization Mode
export const isMultiOrgModeEnabled = () =>
  process.env.NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG === 'true' ? true : false

export const getUriWithOrg = (orgslug: string, path: string) => {
  const multi_org = isMultiOrgModeEnabled()
  const baseURL = getLearnhouseBaseURL()

  if (multi_org) {
      console.log("ERROR: is multi ORG")
    // HACK: this is probably not supported.
    return `${LEARNHOUSE_HTTP_PROTOCOL}${orgslug}.${LEARNHOUSE_DOMAIN}${path}`
  }

  const completePath = `${baseURL}${path}`
  console.log(`GOT COMPLETE PATH: ${completePath}`)
  return completePath
}

export const getUriWithoutOrg = (path: string) => {
  const multi_org = isMultiOrgModeEnabled()

  console.warn("THIS IS OBSOLETE; remove this")
    return `${path}`

  if (multi_org) {
    return `${LEARNHOUSE_HTTP_PROTOCOL}${LEARNHOUSE_DOMAIN}${path}`
  }
  return `${LEARNHOUSE_HTTP_PROTOCOL}${LEARNHOUSE_DOMAIN}${path}`
}

export const getOrgFromUri = () => {
  const multi_org = isMultiOrgModeEnabled()
  if (multi_org) {
    getDefaultOrg()
  } else {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname

      return hostname.replace(`.${LEARNHOUSE_DOMAIN}`, '')
    }
  }
}

export const getDefaultOrg = () => {
  return process.env.NEXT_PUBLIC_LEARNHOUSE_DEFAULT_ORG
}
