// import { createContext, useContext } from "react"

// import { isDevEnv } from "@/app/auth/options"

// import { headers } from "next/headers"
// import { useContext } from "react"

export const LEARNHOUSE_HTTP_PROTOCOL =
  process.env.NEXT_PUBLIC_LEARNHOUSE_HTTPS === 'true' ? 'https://' : 'http://'
const LEARNHOUSE_API_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_API_URL}`
export const LEARNHOUSE_BACKEND_URL = `${process.env.NEXT_PUBLIC_LEARNHOUSE_BACKEND_URL}`
export const LEARNHOUSE_DOMAIN = process.env.NEXT_PUBLIC_LEARNHOUSE_DOMAIN
export const LEARNHOUSE_TOP_DOMAIN =
  process.env.NEXT_PUBLIC_LEARNHOUSE_TOP_DOMAIN

// export const isDevEnv = LEARNHOUSE_TOP_DOMAIN == 'localhost' ? true : false
export const isDevEnv = process.env.NODE_ENV != 'production'

//
// let API_URL: string | null = null
//
// export const setAPIURL = (url: string) => {
//     console.log(`setAPI was called ${url}`)
//     API_URL = url
// }

export const getAPIUrl = () => {
    let api: string | null = null

    if (isDevEnv || typeof window === 'undefined') {
        console.error("RUNNING IN SERVER MODE")
        api = LEARNHOUSE_API_URL
    } else {
        const fullhost = window.location.host;
        const proto = window.location.protocol;

        // const headersData = headers()
        // const host = headersData.get('host')
        // const protocol = headersData.get('x-forwarded-proto') ?? host.startWith('localhost') ? 'http' : 'https'
        // const apiBase = `${protocol}://${host}`
        api = `${proto}//${fullhost}/api/v1/`
    }

    // if (!api) {
    //     console.error("NO API URL")
    //     return 'Unknown';
    // }

    // const backendUrl =
    // context.req.headers['x-backend-url']?.toString() || process.env.NEXT_PUBLIC_BACKEND_URL;
    console.log(`API_URL=${api}`)
    return api
}

export const getBackendUrl = () => LEARNHOUSE_BACKEND_URL

// Multi Organization Mode
export const isMultiOrgModeEnabled = () =>
  process.env.NEXT_PUBLIC_LEARNHOUSE_MULTI_ORG === 'true' ? true : false

export const getUriWithOrg = (orgslug: string, path: string) => {
  const multi_org = isMultiOrgModeEnabled()
  if (multi_org) {
    return `${LEARNHOUSE_HTTP_PROTOCOL}${orgslug}.${LEARNHOUSE_DOMAIN}${path}`
  }
  return `${LEARNHOUSE_HTTP_PROTOCOL}${LEARNHOUSE_DOMAIN}${path}`
}

export const getUriWithoutOrg = (path: string) => {
  const multi_org = isMultiOrgModeEnabled()
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
