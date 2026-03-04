import {
	getNewAccessTokenUsingRefreshTokenServer,
	getUserSession,
	loginAndGetToken,
	loginWithOAuthToken,
} from '@services/auth/auth'
import { LEARNHOUSE_TOP_DOMAIN, getUriWithOrg } from '@services/config/config'
import { getResponseMetadata } from '@services/utils/ts/requests'
import CredentialsProvider from 'next-auth/providers/credentials'
import KeycloakProvider from 'next-auth/providers/keycloak'

const domain = `.${LEARNHOUSE_TOP_DOMAIN()}`

function getDomain(): string {
	console.log(`DOMAIN: ${domain}`)
	return domain
}

export const nextAuthOptions = {
	debug: true,
	providers: (() => {
		const providers: any[] = [
		CredentialsProvider({
			// The name to display on the sign in form (e.g. 'Sign in with...')
			name: 'Credentials',
			// The credentials is used to generate a suitable form on the sign in page.
			// You can specify whatever fields you are expecting to be submitted.
			// e.g. domain, username, password, 2FA token, etc.
			// You can pass any HTML attribute to the <input> tag through the object.
			credentials: {
				email: { label: 'Email', type: 'text', placeholder: 'jsmith' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials, req) {
				// logic to verify if user exists
				let unsanitized_req = await loginAndGetToken(
					credentials?.email,
					credentials?.password
				)
				let res = await getResponseMetadata(unsanitized_req)
				if (res.success) {
					// If login failed, then this is the place you could do a registration
					return res.data
				} else {
					return null
				}
			},
		}),
		]

		const keycloakIssuer =
			process.env.LEARNHOUSE_KEYCLOAK_ISSUER || process.env.KEYCLOAK_ISSUER
		const keycloakClientId =
			process.env.LEARNHOUSE_KEYCLOAK_CLIENT_ID || process.env.KEYCLOAK_CLIENT_ID
		const keycloakClientSecret =
			process.env.LEARNHOUSE_KEYCLOAK_CLIENT_SECRET || process.env.KEYCLOAK_CLIENT_SECRET

		if (keycloakIssuer && keycloakClientId && keycloakClientSecret) {
			providers.push(
				KeycloakProvider({
					clientId: keycloakClientId,
					clientSecret: keycloakClientSecret,
					issuer: keycloakIssuer,
				})
			)
		}

		return providers
	})(),
	pages: {
		signIn: getUriWithOrg('auth', '/'),
		verifyRequest: getUriWithOrg('auth', '/'),
		error: getUriWithOrg('auth', '/'), // Error code passed in query string as ?error=
	},
	cookies: {
		sessionToken: {
			// TODO: FIX THIS!!!!
			// name: `${!isDevEnv ? '__Secure-' : ''}next-auth.session-token`,
			name: `next-auth.session-token`,
			options: {
				httpOnly: false,
				// sameSite: 'lax',
				sameSite: 'none',
				path: '/',
				// When working on localhost, the cookie domain must be omitted entirely (https://stackoverflow.com/a/1188145)
				// Possible solution: omitting the domain as well
				domain: undefined,
				// domain: ".localhost",
				secure: true,
			},
		},
	},
	callbacks: {
		async jwt({ token, user, account }: any) {
			// First sign in with Credentials provider
			if (account?.provider == 'credentials' && user) {
				token.user = user
			}

			// Sign up with Keycloak
			if (account?.provider == 'keycloak' && user) {
				let unsanitized_req = await loginWithOAuthToken(
					user?.email,
					'keycloak',
					account.access_token
				)
				let userFromOAuth = await getResponseMetadata(unsanitized_req)
				if (userFromOAuth.success && userFromOAuth.data?.tokens?.access_token) {
					token.user = userFromOAuth.data
				} else {
					token.oauth_error = userFromOAuth.data?.detail || 'keycloak_oauth_failed'
				}
			}

			// Refresh token
			// TODO : Improve this implementation
			if (token?.user?.tokens) {
				const RefreshedToken = await getNewAccessTokenUsingRefreshTokenServer(
					token?.user?.tokens?.refresh_token
				)
				token = {
					...token,
					user: {
						...token.user,
						tokens: {
							...token.user.tokens,
							access_token: RefreshedToken.access_token,
						},
					},
				}
			}
			return token
		},
		async session({ session, token }: any) {
			// Include user information in the session
			if (token?.user?.tokens?.access_token) {
				let api_SESSION = await getUserSession(token.user.tokens.access_token)
				session.user = api_SESSION.user
				session.roles = api_SESSION.roles
				session.tokens = token.user.tokens
			} else if (token?.oauth_error) {
				session.error = token.oauth_error
			}
			return session
		},
	},
}
