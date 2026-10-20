// Webcam stills and tilt plots are plain images on volcanoes.usgs.gov. Fetching
// them (rather than pointing <img> at the URL) lets us read Last-Modified, so the
// UI can say how old each image is. `cache: 'no-cache'` revalidates with the
// server, which answers 304 when the image hasn't changed.

export interface LoadedImage {
  objectUrl: string;
  lastModified: Date | undefined;
}

const cache = new Map<string, LoadedImage>();

export async function loadImage(url: string, signal: AbortSignal): Promise<LoadedImage> {
  const res = await fetch(url, { cache: 'no-cache', signal });
  if (!res.ok) throw new Error(`USGS returned HTTP ${res.status}`);
  const header = res.headers.get('Last-Modified');
  const lastModified = header ? new Date(header) : undefined;

  const previous = cache.get(url);
  if (previous && lastModified && previous.lastModified?.getTime() === lastModified.getTime()) {
    await res.body?.cancel();
    return previous;
  }

  const image = { objectUrl: URL.createObjectURL(await res.blob()), lastModified };
  cache.set(url, image);
  if (previous) URL.revokeObjectURL(previous.objectUrl);
  return image;
}
