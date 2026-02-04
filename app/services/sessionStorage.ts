const SESSION_ID_KEY = 'queryhub_session_id';

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

export function getSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(SESSION_ID_KEY);
}
