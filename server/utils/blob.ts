export async function getBlobUrl(pathname: string): Promise<string> {
  return `/api/blob/${pathname}`
}
