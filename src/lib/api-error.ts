export function getApiError(err: unknown): string {
  // ApiError thrown by our ApiClient (axios.ts) — message is set directly
  if (err instanceof Error && err.message && err.message !== "Request failed") {
    return err.message;
  }
  // Legacy axios-style shape (response.data.message)
  const axiosMsg = (err as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  if (axiosMsg) return axiosMsg;
  return "Something went wrong.";
}

export function getApiErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    return (err as { status: number }).status;
  }
  return undefined;
}

export function getApiErrorData(err: unknown): unknown {
  if (err && typeof err === "object" && "data" in err) {
    return (err as { data: unknown }).data;
  }
  return undefined;
}
