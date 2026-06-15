import { AxiosError, type AxiosResponse } from 'axios';

export function createApiError(status: number, detail: string) {
  return new AxiosError(
    detail,
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      data: { detail },
      headers: {},
      config: {},
    } as AxiosResponse,
  );
}
