export const LEARNHOUSE_HTTP_PROTOCOL =
  process.env.NEXT_PUBLIC_LEARNHOUSE_HTTPS === 'true' ? 'https://' : 'http://'
const LEARNHOUSE_API_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_API_URL}`
export const LEARNHOUSE_BACKEND_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL}`
export const LEARNHOUSE_DOMAIN = process.env.NEXT_PUBLIC_LEARNHOUSE_DOMAIN
// export const LEARNHOUSE_TOP_DOMAIN =
//   process.env.NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN

export const isDevEnv = process.env.NODE_ENV != 'production'


export function LEARNHOUSE_TOP_DOMAIN(): string {
    // NOTE: This is stupid because nextJS will try to fetch environment variables at build time!!!
    let N = 'N'
    let domain = process.env['NEXT_PUBLIC_LEARNHOUSE_BASE_TOP_DOMAI' + N]

    if (!domain) {
        throw new Error('NEXT_PUBLIC_LEARNHOUSE_BASE_TOP_DOMAIN is undefined')
    }

    return domain
}

export function LEARNHOUSE_BASE_URL(): string {
    // NOTE: This is stupid because nextJS will try to fetch environment variables at build time!!!
    let L = 'L'
    let url = process.env['NEXT_PUBLIC_LEARNHOUSE_BASE_UR' + L]

    if (!url) {
        throw new Error('NEXT_PUBLIC_LEARNHOUSE_BASE_URL is undefined')
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

    return url
}

/*
 * API base for fetches that provably run on the server.
 *
 * getAPIUrl() cannot be used for this. It branches on `typeof window`, which is
 * also true while server-rendering a *client* component - and several of those
 * build SWR keys from it that the browser then fetches. An internal hostname
 * baked into such a key is unreachable from a browser, so the branch has to be
 * chosen explicitly by the caller rather than inferred.
 *
 * Only server components may use this. Without it, every server-side fetch
 * leaves the container and re-enters over the public hostname, making the
 * reverse proxy terminate TLS twice per page render.
 *
 * Deliberately not NEXT_PUBLIC_: that would inline it into the client bundle.
 */
export const getServerAPIUrl = () => {
    const internal = process.env.LEARNHOUSE_INTERNAL_API_URL
    return internal && internal !== 'undefined' ? internal : getAPIUrl()
}

export const getAPIUrl = () => {
    let url: string | null = null

    if (isDevEnv || typeof window === 'undefined') {
        // TODO: i need to fix this
        url = LEARNHOUSE_API_URL
    } else {
        const fullhost = window.location.host;
        const proto = window.location.protocol;
        url = `${proto}//${fullhost}/api/v1/`
    }

    return url
}

export const getWebSocketUrl = () => {
    const apiUrl = getAPIUrl()
    if (!apiUrl) {
        return apiUrl
    }
    if (apiUrl.startsWith('https://')) {
        return apiUrl.replace('https://', 'wss://')
    }
    if (apiUrl.startsWith('http://')) {
        return apiUrl.replace('http://', 'ws://')
    }
    return apiUrl
}

export const getBackendUrl = () => LEARNHOUSE_BACKEND_URL

// Multi Organization Mode
export const isMultiOrgModeEnabled = () =>
  process.env.NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG === 'true' ? true : false

export const getUriWithOrg = (orgslug: string, path: string) => {
  const multi_org = isMultiOrgModeEnabled()
  const baseURL = getLearnhouseBaseURL()

  if (multi_org) {
    // HACK: this is probably not supported.
    return `${LEARNHOUSE_HTTP_PROTOCOL}${orgslug}.${LEARNHOUSE_DOMAIN}${path}`
  }

  const completePath = `${baseURL}${path}`
  return completePath
}

export const getUriWithoutOrg = (path: string) => {
  return `${path}`
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
