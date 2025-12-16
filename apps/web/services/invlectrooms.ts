import { getAPIUrl } from '@services/config/config';
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests';

export interface InvlectRoomsProblemImage {
  original?: string;
  local?: string;
  [key: string]: unknown;
}

export interface InvlectRoomsProblem {
  id?: number | string;
  title?: string;
  status?: string;
  body?: string;
  img?: string | InvlectRoomsProblemImage;
  [key: string]: unknown;
}

export interface InvlectRoomsImportResponse {
  url: string;
  refresh_url?: string | null;
  refresh?:
    | {
        problems?: InvlectRoomsProblem[];
        _images?: Array<{ original: string; local: string }>;
        [key: string]: unknown;
      }
    | null;
}

export async function fetchInvlectRoomsImport(
  url: string,
  accessToken?: string
): Promise<InvlectRoomsImportResponse> {
  const response = await fetch(
    `${getAPIUrl()}invlectrooms`,
    RequestBodyWithAuthHeader('POST', { url }, null, accessToken)
  );
  return errorHandling(response);
}
