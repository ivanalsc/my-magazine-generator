export async function repositoryRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      "Your library could not be reached. Reconnect and try again.",
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error ?? "Your library could not be updated. Please try again.",
    );
  return result as T;
}
