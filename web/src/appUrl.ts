/** Resolve app-owned resources under the same deployment prefix as the bundle. */
export function appUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
