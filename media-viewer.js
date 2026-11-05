import { commonsURL } from './media-contract.js';

/* Shared descriptor: Commons metadata/URLs or a local Blob/File. No disk writes. */
export function mountMediaViewer(root) {
  root.innerHTML = '<div class="media-tools"><button type="button" data-local>Open Local…</button><input type="file" accept="image/*,audio/*,video/*" hidden><button type="button" data-fit>Fit</button><button type="button" data-actual>100%</button><button type="button" data-out aria-label="Zoom out">−</button><button type="button" data-in aria-label="Zoom in">+</button></div><p class="media-status" role="status">Choose an image in Commons, or open a local media file.</p><div class="media-stage"></div><div class="media-info"><strong></strong><p></p><a target="_blank" rel="noopener noreferrer" hidden>Source, creator and license on Commons ↗</a></div><button type="button" data-retry hidden>Retry media</button>';
  const stage = root.querySelector('.media-stage'), status = root.querySelector('[role=status]'), info = root.querySelector('.media-info'), sourceLink = info.querySelector('a'), retry = root.querySelector('[data-retry]');
  const picker = root.querySelector('[type=file]');
  let source, controller, objectURL, element, zoom = null, sequence = 0, disposed = false;
  const imageButtons = [...root.querySelectorAll('[data-fit],[data-actual],[data-in],[data-out]')];
  const release = () => {
    controller?.abort();
    if (element?.matches('audio,video')) { element.pause(); element.removeAttribute('src'); element.load(); }
    element?.remove(); element = null;
    if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
  };
  const fit = () => {
    if (!element?.matches('img')) return;
    element.classList.toggle('media-fit', zoom === null);
    element.style.width = zoom === null ? '' : `${element.naturalWidth * zoom}px`;
    status.textContent = zoom === null ? 'Fit to window' : `${Math.round(zoom * 100)}%`;
  };
  const fail = message => { status.textContent = message; retry.hidden = !source; };
  async function open(next) {
    if (disposed) return;
    const token = ++sequence; release(); stage.replaceChildren();
    source = next; zoom = null; retry.hidden = true;
    info.querySelector('strong').textContent = next?.title || next?.blob?.name || 'Media Viewer';
    info.querySelector('p').textContent = ''; sourceLink.hidden = true;
    for (const button of imageButtons) button.disabled = true;
    if (!next) { status.textContent = 'Choose an image in Commons, or open a local media file.'; return; }
    let url, mime = next.mime || next.blob?.type || '';
    controller = new AbortController(); const requestController = controller; status.textContent = 'Loading media…';
    try {
      if (next.kind === 'local' && next.blob instanceof Blob) {
        objectURL = URL.createObjectURL(next.blob); url = objectURL;
        info.querySelector('p').textContent = 'Local file · viewed on this device; not uploaded or saved to C:.';
      } else if (next.kind === 'commons') {
        if (!commonsURL(next.sourceUrl)) throw Error('Invalid Commons source.');
        sourceLink.href = next.sourceUrl; sourceLink.hidden = false;
        info.querySelector('p').textContent = `Creator: ${next.artist || 'see source'} · ${next.license || 'see source for license'}`;
        url = commonsURL(next.url) || commonsURL(next.previewUrl);
        if (Number.isSafeInteger(next.pageid) && next.pageid > 0 && mime.startsWith('image/')) {
          const api = new URL('https://commons.wikimedia.org/w/api.php');
          api.search = new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',prop:'imageinfo',pageids:String(next.pageid),iiprop:'url|mime|size',iiurlwidth:'1280'});
          try {
            const response = await fetch(api,{signal:AbortSignal.any([requestController.signal,AbortSignal.timeout(15000)])});
            if (!response.ok) throw Error('Preview request failed');
            const result = await response.json();
            const image = result.query?.pages?.[0]?.imageinfo?.[0];
            url = commonsURL(image?.thumburl) || commonsURL(image?.url) || url;
          } catch (error) { if (requestController.signal.aborted) return; if (!url) throw error; }
        }
      } else throw Error('Unsupported media source.');
      if (token !== sequence || disposed) return;
      if (!url) throw Error('Commons did not provide a media URL.');
      const type = mime.startsWith('image/') ? 'img' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : null;
      if (!type) throw Error('This media type is not supported by the viewer.');
      element = document.createElement(type); element.className = 'media-object';
      if (type === 'img') {
        element.alt = next.title || 'Local image';
        element.onload = () => { if (token !== sequence) return; for (const button of imageButtons) button.disabled = false; fit(); };
      } else { element.controls = true; element.preload = 'metadata'; element.onloadedmetadata = () => { if (token === sequence) status.textContent = 'Ready · use the playback controls'; }; }
      element.onerror = () => { if (token === sequence) fail('Could not display this media. The file may be unavailable or unsupported by your browser.'); };
      element.src = url; stage.append(element);
    } catch (error) { if (token === sequence && !disposed) fail(error.message); }
  }
  root.querySelector('[data-local]').onclick = () => picker.click();
  picker.onchange = () => { const file = picker.files[0]; if (file) open({kind:'local',title:file.name,mime:file.type,blob:file}); picker.value = ''; };
  root.querySelector('[data-fit]').onclick = () => { zoom = null; fit(); };
  root.querySelector('[data-actual]').onclick = () => { zoom = 1; fit(); };
  root.querySelector('[data-in]').onclick = () => { zoom = Math.min(4,(zoom || 1) * 1.25); fit(); };
  root.querySelector('[data-out]').onclick = () => { zoom = Math.max(.1,(zoom || 1) / 1.25); fit(); };
  retry.onclick = () => open(source);
  open(null);
  return { open, dispose() { disposed = true; sequence++; release(); } };
}
