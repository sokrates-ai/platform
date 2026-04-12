import { getUriWithOrg } from "@services/config/config";
import { getUserAvatarMediaDirectory } from "@services/media/media";

export function getAvatarUrl(orgslug: string, predefined_avatar: string, avatar_url: string, session: any): string   {
  function checkUrlProtocol(url: string): boolean {
    return url.startsWith('https://') || url.startsWith('http://');
  }

  const predefinedAvatarFunc = () => {
    if (predefined_avatar === 'ai') {
      return getUriWithOrg(orgslug, '/ai_avatar.png')
    }
    if (predefined_avatar === 'empty') {
      return getUriWithOrg(orgslug, '/empty_avatar.png')
    }
    return null
  }

  const predefinedAvatar = predefinedAvatarFunc()
  const emptyAvatar = getUriWithOrg(orgslug, '/empty_avatar.png') as any
  const uploadedAvatar =  (session.status == 'authenticated') && (checkUrlProtocol(session?.data?.user?.avatar_image)) ? session?.data?.user?.avatar_image : getUserAvatarMediaDirectory(
    session?.data?.user?.user_uuid,
    session?.data?.user?.avatar_image
  )

    if (predefined_avatar) {
      return predefinedAvatar!
    } else {
      if (avatar_url) {
        return avatar_url
      } else {
        if (session?.data?.user?.avatar_image) {
          return uploadedAvatar
        } else {
          return emptyAvatar
        }
      }
    }
}
