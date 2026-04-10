export function getApiError(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    "Something went wrong."
  );
}
