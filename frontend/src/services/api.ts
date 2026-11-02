/** One cancellation/timeout/error contract for every scientific request. */
export async function api<T>(url: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(30_000);
  try {
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body as T;
  } catch (error) {
    if (timeout.aborted && !signal?.aborted)
      throw new Error("Calculation timed out after 30 seconds. Try a smaller calculation.");
    throw error;
  }
}
