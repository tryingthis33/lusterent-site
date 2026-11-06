// Explicitly carry the nested route through Vercel's single-function rewrite.
// If the runtime preserves the original URL, leave its pathname unchanged.
export function restoreApiPath(rawUrl: string): string {
  const url = new URL(rawUrl, "https://internal.invalid");
  const rewrittenPath = url.searchParams.get("__vercel_api_path");
  if ((url.pathname === "/api" || url.pathname === "/api/") && rewrittenPath) {
    const path = rewrittenPath.replace(/^\/+/, "");
    if (/[?#\\]/.test(path) || path.split("/").some(segment => segment === ".." || segment === ".")) {
      throw new Error("Invalid API route");
    }
    url.pathname = `/api/${path}`;
  }
  url.searchParams.delete("__vercel_api_path");
  return `${url.pathname}${url.search}`;
}