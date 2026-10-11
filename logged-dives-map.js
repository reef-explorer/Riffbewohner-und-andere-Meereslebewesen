(function(){
'use strict';
const KEY='ocean-explorer-dive-center-v1';
const CUSTOM='ocean-explorer-custom-dive-sites-v1';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const valid=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
let map,layer,lastMarkers=[],mapReady=false,allLocated=[];
function getDives(){try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return Array.isArray(v.dives)?v.dives:[]}catch(e){return []}}
function catalog(){let c=Array.isArray(window.OCEAN_DIVE_SITES)?window.OCEAN_DIVE_SITES:[];try{const extra=JSON.parse(localStorage.getItem(CUSTOM)||'[]');if(Array.isArray(extra))c=[...c,...extra]}catch(e){}return c}
function locate(d){
 let lat=d.latitude==null||d.latitude===''?NaN:Number(d.latitude);
 let lon=d.longitude==null||d.longitude===''?NaN:Number(d.longitude);
 if(!valid(lat,lon)){const matches=catalog().filter(s=>norm(s.name)===norm(d.site)&&(!d.atoll||norm(s.atoll)===norm(d.atoll))&&valid(Number(s.lat),Number(s.lon)));if(matches.length===1){lat=Number(matches[0].lat);lon=Number(matches[0].lon)}}
 return valid(lat,lon)?{...d,lat,lon}:null
}
function safeSite(d){return esc(d.site||'Unbenannter Tauchplatz')}
function label(d){return safeSite(d)+' · '+esc(d.date||'Datum unbekannt')}
function editDive(id){
 $('diveTabLog')?.click();
 const btn=[...document.querySelectorAll('[data-edit-dive]')].find(x=>x.dataset.editDive===id);
 if(btn){btn.click();return}
 $('diveLogEntries')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function init(){
 if(mapReady)return true;
 if(!window.L){$('loggedDivesMap').innerHTML='<p style="padding:20px;color:#dff">Die interaktive Karte konnte nicht geladen werden (Internet erforderlich). Deine Tauchgangliste bleibt verfügbar.</p>';return false}
 map=L.map('loggedDivesMap',{scrollWheelZoom:false,zoomControl:true}).setView([3.2,73.1],7);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap-Mitwirkende',maxZoom:18}).addTo(map);
 layer=L.layerGroup().addTo(map);
 mapReady=true;return true
}
function showAll(){
 if(!mapReady)return;
 const ll=lastMarkers.map(x=>x.getLatLng());
 if(ll.length===1)map.setView(ll[0],13);
 else if(ll.length)map.fitBounds(L.latLngBounds(ll).pad(.3),{maxZoom:12});
 else map.setView([3.2,73.1],7)
}
function markerPopup(group){
 const rows=group.dives.map(d=>'<div style="border-top:1px solid #dde;padding:6px 0"><strong>'+esc(d.date||'')+'</strong> · '+esc(d.depth==null?'–':d.depth+' m')+' · '+esc(d.duration==null?'–':d.duration+' Min.')+'<br><button type="button" data-map-edit="'+esc(d.id)+'">Logbuch öffnen</button></div>').join('');
 return '<strong>'+esc(group.name)+'</strong><br><small>'+esc(group.atoll||'Atoll nicht angegeben')+'</small><br>'+group.dives.length+' Tauchgang/Tauchgänge'+rows;
}
function render(){
 const dives=getDives();
 const atolls=[...new Set(dives.map(d=>d.atoll).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
 const sel=$('logMapAtoll'),old=sel.value;
 sel.innerHTML='<option value="">Alle Atolle</option>'+atolls.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('');
 sel.value=atolls.includes(old)?old:'';
 const atoll=sel.value,q=norm($('logMapSearch').value);
 const shown=dives.filter(d=>(!atoll||d.atoll===atoll)&&(!q||norm(d.site+' '+d.date+' '+(d.atoll||'')).includes(q)));
 const located=[],missing=[];
 shown.forEach(d=>{const found=locate(d);if(found)located.push(found);else missing.push(d)});
 $('logMapDiveCount').textContent=located.length;
 const groups=new Map();
 for(const d of located){
  const key=d.lat.toFixed(5)+','+d.lon.toFixed(5);
  if(!groups.has(key))groups.set(key,{lat:d.lat,lon:d.lon,name:d.site,atoll:d.atoll,dives:[]});
  groups.get(key).dives.push(d);
 }
 $('logMapPlacesCount').textContent=groups.size;
 $('logMapMissingCount').textContent=missing.length;
 allLocated=located;
 $('logMapList').innerHTML=located.length?located.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(d=>'<article class="logmap-item"><strong>'+label(d)+'</strong><small>'+esc(d.atoll||'Atoll nicht angegeben')+' · '+esc(d.depth==null?'–':d.depth+' m')+' · '+esc(d.duration==null?'–':d.duration+' Min.')+'</small><button type="button" data-map-edit="'+esc(d.id)+'">Bearbeiten</button><button type="button" class="logmap-locate" data-map-focus="'+esc(d.id)+'">Auf Karte</button></article>').join(''):'<p class="dive-muted">Keine Tauchgänge mit bekannter Position für diesen Filter.</p>';
 $('logMapUnlocated').innerHTML=missing.length?missing.map(d=>'<article class="logmap-item"><strong>'+label(d)+'</strong><small>'+esc(d.atoll||'Atoll nicht angegeben')+' · Keine Koordinaten</small><button type="button" data-map-edit="'+esc(d.id)+'">Position ergänzen</button></article>').join(''):'<p class="dive-muted">Alle angezeigten Tauchgänge haben eine Kartenposition.</p>';
 $('logMapInfo').textContent=shown.length?'Kartenpositionen für '+located.length+' von '+shown.length+' angezeigten Tauchgängen gefunden.':'Noch keine passenden Tauchgänge vorhanden.';
 if(!init())return;
 layer.clearLayers();lastMarkers=[];
 for(const g of groups.values()){
  const marker=L.marker([g.lat,g.lon]).bindPopup(markerPopup(g),{maxWidth:290});
  marker.addTo(layer);lastMarkers.push(marker);
 }
 setTimeout(()=>{map.invalidateSize();showAll()},90);
}
$('diveTabMap').addEventListener('click',()=>setTimeout(render,60));
$('logMapSearch').addEventListener('input',render);
$('logMapAtoll').addEventListener('change',()=>{
 const atoll=$('logMapAtoll').value;
 render();$('logMapAtoll').value=atoll;
});
$('logMapFit').addEventListener('click',showAll);
$('divePanelMap').addEventListener('click',e=>{
 const edit=e.target.closest('[data-map-edit]');if(edit){editDive(edit.dataset.mapEdit);return}
 const focus=e.target.closest('[data-map-focus]');
 if(focus&&mapReady){const d=allLocated.find(x=>String(x.id)===focus.dataset.mapFocus);if(d){map.setView([d.lat,d.lon],14);const m=lastMarkers.find(m=>Math.abs(m.getLatLng().lat-d.lat)<.00001&&Math.abs(m.getLatLng().lng-d.lon)<.00001);if(m)m.openPopup();}}
});
const observerTarget=$('diveLogEntries');
if(observerTarget)new MutationObserver(()=>{if($('diveTabMap').getAttribute('aria-selected')==='true')render()}).observe(observerTarget,{childList:true,subtree:false});
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===CUSTOM)if($('diveTabMap').getAttribute('aria-selected')==='true')render()});
if(location.hash==='#my-dive-map'){$('diveTabMap').click();setTimeout(()=>document.getElementById('divePanelMap').scrollIntoView(),180)}
})();