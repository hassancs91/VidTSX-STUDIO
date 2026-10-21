// P5-6: a deep link (a Home "Continue" card, `vidtsx:agents-open`) opens its
// session ONCE per token. The workspace used to re-apply it on every change of
// the session list, and "+" creates a session (which refreshes the list), so
// the view snapped back to the linked session. The token is consumed the first
// time the list has loaded: applied when the session exists, ignored when it
// does not. Only a new token (a new click) applies again.

export interface SessionDeepLink {
  sessionId: string;
  token: number;
}

export interface DeepLinkDecision {
  /** The session to open now, or null. */
  apply: string | null;
  /** The token to remember as consumed (unchanged when nothing was decided). */
  consumedToken: number | null;
}

export function deepLinkToApply(
  link: SessionDeepLink | undefined,
  consumedToken: number | null,
  loaded: boolean,
  sessionIds: readonly string[],
): DeepLinkDecision {
  if (!link || !loaded || link.token === consumedToken) return { apply: null, consumedToken };
  return {
    apply: sessionIds.includes(link.sessionId) ? link.sessionId : null,
    consumedToken: link.token,
  };
}
