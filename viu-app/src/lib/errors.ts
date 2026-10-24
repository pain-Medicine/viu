// Errors that say which service failed and how, so screens can tell the
// viewer what happened in plain words instead of showing a transport message.
export class HttpError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    message?: string,
  ) {
    super(message ?? `${service} request failed (${status})`);
  }
}

export class NetworkError extends Error {
  constructor(
    readonly service: string,
    cause?: unknown,
  ) {
    super(`Couldn't reach ${service}${cause instanceof Error ? `: ${cause.message}` : ''}`);
  }
}

// fetch() that turns a failed connection into a NetworkError.
export async function reach(service: string, request: () => Promise<Response>): Promise<Response> {
  try {
    return await request();
  } catch (e) {
    // Errors with a meaning of their own (like "streaming isn't available
    // here") pass through.
    if (e instanceof Error && e.constructor !== Error && e.constructor !== TypeError) throw e;
    throw new NetworkError(service, e);
  }
}

export interface Explained {
  title: string;
  body: string;
  // The underlying message, for the curious; shown small.
  detail?: string;
}

const looksOffline = (e: Error) => /network request failed|failed to fetch|load failed|networkerror/i.test(e.message);

// Plain words for an error. `service` names who we were talking to when the
// error itself doesn't say.
export function explain(error: Error, service: string, fallbackTitle: string): Explained {
  const who = error instanceof HttpError || error instanceof NetworkError ? error.service : service;
  if (error instanceof NetworkError || (error instanceof TypeError && looksOffline(error)) || looksOffline(error)) {
    return {
      title: `Can't reach ${who}`,
      body: "Check the TV's internet connection. If Viu uses a VPN or proxy, check it in Settings.",
      detail: error.message,
    };
  }
  if (error instanceof HttpError) {
    if (error.status === 429) {
      return { title: `${who} is busy`, body: 'Too many requests in a short time. Wait a minute, then try again.', detail: error.message };
    }
    if (error.status >= 500) {
      return { title: `${who} is having trouble`, body: "It's not your connection. Try again in a few minutes.", detail: error.message };
    }
  }
  return { title: fallbackTitle, body: error.message };
}
