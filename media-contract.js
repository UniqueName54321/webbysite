export function commonsURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['commons.wikimedia.org','upload.wikimedia.org'].includes(url.hostname) ? url.href : null; }
  catch { return null; }
}
export const plainMetadata = value => String(value || '').replace(/<[^>]*>/g, '').trim();
export function commonsMedia(entry, image) {
  return { kind: 'commons', title: entry.title.replace(/^File:/,''), pageid: entry.pageid, mime: image.mime, url: commonsURL(image.url), previewUrl: commonsURL(image.thumburl), sourceUrl: commonsURL(image.descriptionurl), artist: plainMetadata(image.extmetadata?.Artist?.value), license: plainMetadata(image.extmetadata?.LicenseShortName?.value), width: image.width, height: image.height };
}
