import { isInstallModeEnabled } from '@services/install/install'
import {
  LEARNHOUSE_DOMAIN,
  LEARNHOUSE_TOP_DOMAIN,
  getDefaultOrg,
  getUriWithOrg,
  isMultiOrgModeEnabled,
} from './services/config/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts (inside /public)
     * 4. Umami Analytics
     * 4. /examples (inside /public)
     * 5. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|fonts|umami|examples|[\\w-]+\\.\\w+).*)',
    '/sitemap.xml',
    '/payments/stripe/connect/oauth',
  ],
}

export default async function middleware(req: NextRequest) {
  // Get initial data
  const hosting_mode = isMultiOrgModeEnabled() ? 'multi' : 'single'
  const default_org = getDefaultOrg()
  const { pathname, search } = req.nextUrl
  const fullhost = req.headers ? req.headers.get('host') : ''

  // if (!getAPIUrl()) {
  //   setAPIURL(`http://${fullhost}/api/v1`)
  // } else {
  //   console.log(`not null: ${getAPIUrl()}`)
  // }

  // if (pathname.startsWith('/api')) {
  //     console.log("API PATH MIDDLEWARE")
  //       const response = NextResponse.rewrite(
  //       new URL(`http://${fullhost}${pathname}${search}`, req.url)
  //       )
  //   return response
  // }

  const cookie_orgslug = req.cookies.get('learnhouse_current_orgslug')?.value
  const orgslug = fullhost
    ? fullhost.replace(`.${LEARNHOUSE_DOMAIN}`, '')
    : (default_org as string)

  // Out of orgslug paths & rewrite
  const standard_paths = ['/home']
  const auth_paths = ['/login', '/signup', '/reset', '/forgot']
  if (standard_paths.includes(pathname)) {
    // Redirect to the same pathname with the original search params
    return NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
  }

  if (auth_paths.includes(pathname)) {
    const response = NextResponse.rewrite(
      new URL(`/auth${pathname}${search}`, req.url)
    )

    // Parse the search params
    const searchParams = new URLSearchParams(search)
    const orgslug = searchParams.get('orgslug')

    if (orgslug) {
      response.cookies.set({
        name: 'learnhouse_current_orgslug',
        value: orgslug,
        // domain: window.location.hostname // LEARNHOUSE_TOP_DOMAIN == 'localhost' ? '' : LEARNHOUSE_TOP_DOMAIN,
        domain: '.localhost'
      })
    }
    return response
  }

  // Install Page (depreceated)
  if (pathname.startsWith('/install')) {
    // Check if install mode is enabled
    const install_mode = await isInstallModeEnabled()
    if (install_mode) {
      return NextResponse.rewrite(new URL(pathname, req.url))
    } else {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // Dynamic Pages Editor
  if (pathname.match(/^\/course\/[^/]+\/activity\/[^/]+\/edit$/)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url))
  }

  // Check if the request is for the Stripe callback URL
  if (req.nextUrl.pathname.startsWith('/payments/stripe/connect/oauth')) {
    const searchParams = req.nextUrl.searchParams
    const orgslug = searchParams.get('state')?.split('_')[0] // Assuming state parameter contains orgslug_randomstring

    // Construct the new URL with the required parameters
    const redirectUrl = new URL('/payments/stripe/connect/oauth', req.url)

    // Preserve all original search parameters
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.append(key, value)
    })

    // Add orgslug if available
    if (orgslug) {
      redirectUrl.searchParams.set('orgslug', orgslug)
    }

    return NextResponse.rewrite(redirectUrl)
  }

  // Health Check
  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL(`/api/health`, req.url))
  }

  // Auth Redirects
  if (pathname == '/redirect_from_auth') {
    if (cookie_orgslug) {
      const searchParams = req.nextUrl.searchParams
      const queryString = searchParams.toString()
      const redirectPathname = '/'
      const redirectUrl = new URL(
        getUriWithOrg(cookie_orgslug, redirectPathname),
        req.url
      )

      if (queryString) {
        redirectUrl.search = queryString
      }
      return NextResponse.redirect(redirectUrl)
    } else {
      return 'Did not find the orgslug in the cookie'
    }
  }

  if (pathname.startsWith('/sitemap.xml')) {
    let orgslug: string;

    if (hosting_mode === 'multi') {
      orgslug = fullhost
        ? fullhost.replace(`.${LEARNHOUSE_DOMAIN}`, '')
        : (default_org as string);
    } else {
      // Single hosting mode
      orgslug = default_org as string;
    }

    const sitemapUrl = new URL(`/api/sitemap`, req.url);

    // Create a response object
    const response = NextResponse.rewrite(sitemapUrl);

    // Set the orgslug in a header
    response.headers.set('X-Sitemap-Orgslug', orgslug);

    return response;
  }

  // Multi Organization Mode
  if (hosting_mode === 'multi') {
    // Get the organization slug from the URL
    const orgslug = fullhost
      ? fullhost.replace(`.${LEARNHOUSE_DOMAIN}`, '')
      : (default_org as string)
    const response = NextResponse.rewrite(
      new URL(`/orgs/${orgslug}${pathname}`, req.url)
    )

    // Set the cookie with the orgslug value
    response.cookies.set({
      name: 'learnhouse_current_orgslug',
      value: orgslug,
      // domain: LEARNHOUSE_TOP_DOMAIN == 'localhost' ? '' : LEARNHOUSE_TOP_DOMAIN,
      domain: '.localhost',
      path: '/',
    })

    return response
  }

  // Single Organization Mode
  if (hosting_mode === 'single') {
    // Get the default organization slug
    const orgslug = default_org as string
    const response = NextResponse.rewrite(
      new URL(`/orgs/${orgslug}${pathname}`, req.url)
    )

    // Set the cookie with the orgslug value
    response.cookies.set({
      name: 'learnhouse_current_orgslug',
      value: orgslug,
      // domain: LEARNHOUSE_TOP_DOMAIN == 'localhost' ? '' : LEARNHOUSE_TOP_DOMAIN,
      domain: '.',
      path: '/',
    })

    return response
  }
}
