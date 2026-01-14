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
  checkpointLevel?: string;
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

export interface InvlectRoomsProblemPayload {
  id?: number | string;
  title?: string;
  status?: string;
  html?: string;
  plain_text?: string;
  image?: {
    original?: string;
    local?: string;
  } | null;
  chapter_name?: string;
  checkpoint_level?: string | null;
}

export interface InvlectRoomsApplyPayload {
  url: string;
  course_uuid: string;
  tab_uuid?: string;
  chapter_name?: string;
  problems: InvlectRoomsProblemPayload[];
}

export interface InvlectRoomsApplyResponse {
  chapters: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
}

export async function applyInvlectRoomsImport(
  payload: InvlectRoomsApplyPayload,
  accessToken?: string
): Promise<InvlectRoomsApplyResponse> {
  const response = await fetch(
    `${getAPIUrl()}invlectrooms/apply`,
    RequestBodyWithAuthHeader('POST', payload, null, accessToken)
  );
  return errorHandling(response);
}
