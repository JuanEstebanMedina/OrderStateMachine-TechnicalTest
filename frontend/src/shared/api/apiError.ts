import axios from 'axios';

type PydanticError = {
  loc?: unknown[];
  msg?: string;
  type?: string;
};

function isPydanticError(value: unknown): value is PydanticError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'msg' in value &&
    typeof (value as PydanticError).msg === 'string'
  );
}

function formatDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail) && detail.every(isPydanticError)) {
    return detail
      .map((error) => {
        const location = Array.isArray(error.loc) ? error.loc.join('.') : 'request';
        return `${location}: ${error.msg}`;
      })
      .join(' ');
  }

  return null;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }

  return undefined;
}

export function isApiCancelError(error: unknown): boolean {
  return axios.isCancel(error);
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Network error. Check that the API is running and try again.';
    }

    const detailMessage = formatDetail(error.response.data?.detail);

    if (error.response.status === 404) {
      return detailMessage ?? 'The requested order was not found.';
    }

    if (error.response.status === 409) {
      return (
        detailMessage ??
        'The order changed or the backend rejected this transition.'
      );
    }

    if (error.response.status === 422) {
      return detailMessage ?? 'The request did not pass API validation.';
    }

    return detailMessage ?? 'The API returned an unexpected error.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Try again.';
}
