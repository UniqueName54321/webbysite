import { commonsMedia } from './media-contract.js';
/* Commons categories form a graph, not a tree: parents are explicit links. */
export function mountCommons(root, { onOpen } = {}) {
  root.innerHTML = '<form class="address-bar"><label>Category <input name="category" value="Images" required></label><button>Go</button></form><div class="commons-nav"><button type="button" data-back>Back</button> <button type="button" data-home>Images</button></div><p role="status"></p><div class="commons-parents"></div><div class="commons-items"></div><button type="button" data-more hidden>Load more</button>';
  const form=root.querySelector('form'), input=form.elements.category, status=root.querySelector('[role=status]'), parents=root.querySelector('.commons-parents'), items=root.querySelector('.commons-items'), more=root.querySelector('[data-more]'), back=root.querySelector('[data-back]');
  let category='Category:Images', continuation=null, controller, sequence=0; const history=[];
  const api=async params=>{
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    url.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',...params});
    const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});if(!response.ok)throw Error('Commons returned '+response.status);
    const data=await response.json();if(data.error)throw Error(data.error.info||'Commons API error');return data;
  };
  const folder=(title,container)=>{const button=document.createElement('button');button.type='button';button.className='commons-folder';button.innerHTML=`<svg aria-hidden="true"><use href="${new URL('assets/icons.svg',import.meta.url).href}#folder"></use></svg>`;const name=document.createElement('span');name.textContent=title.replace(/^Category:/,'');button.append(name);button.onclick=()=>load(title);container.append(button)};
  async function load(title,append=false,remember=true){
    if(!root.isConnected)return;
    controller?.abort();controller=new AbortController();const token=++sequence;
    if(!append){if(remember&&title!==category)history.push(category);category=title.startsWith('Category:')?title:'Category:'+title;items.replaceChildren();parents.replaceChildren();continuation=null;}
    input.value=category.replace(/^Category:/,'');back.disabled=!history.length;more.hidden=true;status.textContent='Asking Wikimedia Commons…';
    try{
      const [members,ancestor]=await Promise.all([api({list:'categorymembers',cmtitle:category,cmtype:'subcat|file',cmlimit:'40',...(append?continuation:{})}),append?Promise.resolve(null):api({prop:'categories',titles:category,clshow:'!hidden',cllimit:'max'})]);
      if(token!==sequence||!root.isConnected)return;
      if(ancestor){const label=document.createElement('p');label.textContent='Parent categories (there may be more than one):';parents.append(label);for(const page of ancestor.query?.pages||[])for(const parent of page.categories||[])folder(parent.title,parents);}
      const entries=members.query?.categorymembers||[];
      const files=entries.filter(n=>n.ns===6);let details={};
      if(files.length){const images=await api({prop:'imageinfo',pageids:files.map(n=>n.pageid).join('|'),iiprop:'url|mime|extmetadata',iiurlwidth:'160'});details=Object.fromEntries((images.query?.pages||[]).map(n=>[n.pageid,n]));}
      if(token!==sequence||!root.isConnected)return;
      for(const entry of entries){
        if(entry.ns===14){folder(entry.title,items);continue;}
        const image=details[entry.pageid]?.imageinfo?.[0];if(!image||!image.mime?.startsWith('image/'))continue;
        const media=commonsMedia(entry,image);
        const href=media.sourceUrl;if(!href)continue;
        const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.className='commons-image';
        const img=document.createElement('img');img.alt=media.title;img.loading='eager';img.decoding='async';link.append(img);
        const previewState=document.createElement('small');previewState.className='preview-state';link.append(previewState);
        let usedOriginal=false;
        const preview=()=>{usedOriginal=false;img.hidden=false;previewState.textContent='Loading preview…';retryPreview.hidden=true;const url=media.previewUrl||media.url;if(url)img.src=url;else{img.hidden=true;previewState.textContent='Preview unavailable';retryPreview.hidden=false;}};
        img.onload=()=>{previewState.textContent='';img.hidden=false;retryPreview.hidden=true};
        img.onerror=()=>{if(!usedOriginal&&media.url&&img.src!==media.url){usedOriginal=true;img.src=media.url;return;}img.hidden=true;previewState.textContent='Preview unavailable';retryPreview.hidden=false;};
        const name=document.createElement('span');name.textContent=media.title;link.append(name);
        const license=document.createElement('small');license.textContent='Creator: '+(media.artist||'see Commons source')+' · '+(media.license||'see source for license');link.append(license);
        link.onclick=event=>{if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(onOpen)onOpen(media);else root.dispatchEvent(new CustomEvent('beepos:open-media',{bubbles:true,detail:media}));};
        const card=document.createElement('div');card.className='commons-image-card';card.append(link);
        const retryPreview=document.createElement('button');retryPreview.type='button';retryPreview.textContent='Retry preview';retryPreview.onclick=preview;card.append(retryPreview);items.append(card);preview();

      }
      continuation=members.continue||null;more.hidden=!continuation;more.textContent='Load more';
      status.textContent=items.children.length?'Live results from Wikimedia Commons. Open an image for source, creator and license.':'No images or subcategories here. Try a parent category or another category name.';
    }catch(error){if(token===sequence&&error.name!=='AbortError'){status.textContent='Could not load Commons: '+error.message;more.hidden=false;more.textContent='Retry';}}
  }
  form.onsubmit=e=>{e.preventDefault();load(input.value.trim()||'Images')};
  back.onclick=()=>{if(history.length)load(history.pop(),false,false)};root.querySelector('[data-home]').onclick=()=>load('Category:Images');more.onclick=()=>load(category,!!continuation,false);
  load(category,false,false);
  return ()=>{sequence++;controller?.abort()};
}
