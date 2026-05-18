export function extractRequestId(response: Response): string | null {
  const id = response.headers.get('X-Request-Id');
  if (!id) {
    console.debug('[observability] X-Request-Id missing from response — check CORS exposedHeaders');
  }
  return id;
}
