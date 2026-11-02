export function publicBase(requestURL: URL) {
  return process.env.APP_BASE_URL || import.meta.env.PUBLIC_APP_BASE_URL || requestURL.origin;
}
export function internalAPI(path: string) {
  const base =
    process.env.API_INTERNAL_BASE_URL ||
    import.meta.env.API_INTERNAL_BASE_URL ||
    'http://127.0.0.1:8080/api';
  return `${base.replace(/\/+$/, '')}/${path}`;
}
