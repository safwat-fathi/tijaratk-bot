export function getBaseUrl(): string {
  const baseUrl = process.env.BASE_API_URL;
  if (!baseUrl) {
    throw new Error("BASE_API_URL not configured");
  }
  return baseUrl.replace(/\/+$/, "");
}
