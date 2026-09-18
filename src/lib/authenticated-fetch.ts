import type { User } from "firebase/auth";

function withBearer(headers: HeadersInit | undefined, token: string) {
  const next = new Headers(headers || {});
  next.set("authorization", `Bearer ${token}`);
  return next;
}

export async function authenticatedFetch(
  user: User,
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const token = await user.getIdToken();
  let response = await fetch(input, {
    ...init,
    headers: withBearer(init?.headers, token),
  });

  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await user.getIdToken(true);
  response = await fetch(input, {
    ...init,
    headers: withBearer(init?.headers, refreshedToken),
  });

  return response;
}
