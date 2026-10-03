import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const manifest=read(new URL('../artifacts/konoha-manifest.json', import.meta.url)),result=read(new URL('../artifacts/konoha-result.json', import.meta.url)),progress=read(new URL('../artifacts/konoha-progress.json', import.meta.url)),routes=read(new URL('../artifacts/konoha-world-route-audit.json', import.meta.url)),summary=read(new URL('../artifacts/konoha-design-summary.json', import.meta.url));
const required=['hokage_mountain','hokage_complex','ninja_academy','konoha_hospital','ICHIRAKU RAMEN','central_plaza','main_gate','training_grounds','surrounding_forest'];
for(const id of required)if(!manifest.structures.some(s=>s.id===id))throw Error(`Missing structure ${id}`);
if(result.dimensions.xSpan<300||result.dimensions.zSpan<300||result.urbanCore.xSpan<300||result.urbanCore.zSpan<300)throw Error('Insufficient dimensions');
if(result.failedBlocks||result.requestedBlocks!==result.placedBlocks||Object.values(progress.jobs).some(j=>j.status!=='complete')||routes.failures||result.labelsVerified!==manifest.labels.length||!result.foundationVerified)throw Error('Unfinished validation');
for(const s of manifest.structures)if(s.variant!==undefined&&s.bounds){const [L,y,B]=s.bounds.from,[R,,F]=s.bounds.to,w=R-L+1,d=F-B+1;const radius=s.variant%3===0?Math.min(Math.floor(w/2)+2,Math.floor(d/2)+2):s.variant%3===1?Math.floor(w/2)+2:Math.floor(d/2)+2;s.bounds={from:[L-2,y,B-2],to:[R+2,6+s.stories*7+Math.max(5,Math.floor(radius*.65)),F+3]};}
manifest.structures.push({id:'outer_walls',kind:'walls',bounds:{from:[20,7,115],to:[364,26,435]}},{id:'street_network',kind:'roads',validatedDestinations:routes.verifiedDestinations});
manifest.districts=[
{id:'montana_hokage',x:[68,315],z:[8,137]},
{id:'administrativo',x:[160,225],z:[118,197]},
{id:'residencial_norte_oeste',x:[33,155],z:[125,234]},
{id:'residencial_norte_este',x:[232,353],z:[125,234]},
{id:'comercial_oeste',x:[32,162],z:[242,280]},
{id:'comercial_este',x:[233,354],z:[242,280]},
{id:'academia',x:[42,99],z:[288,345]},
{id:'hospital',x:[266,324],z:[288,330]},
{id:'residencial_sur',x:[110,352],z:[341,424]},
{id:'entrenamiento',x:[42,101],z:[350,415]},
{id:'entrada',x:[159,225],z:[418,447]}
];
// Preserve the corrected Unicode captions in the reusable source plan as well.
let source=readFileSync(new URL('./konoha-design.mts', import.meta.url),'utf8');for(const old of summary.labels){const label=manifest.labels.find(l=>l.x===old.x&&l.y===old.y&&l.z===old.z);if(label&&old.text!==label.text)source=source.split(old.text).join(label.text);}writeFileSync(new URL('./konoha-design.mts', import.meta.url),source);
result.structures=manifest.structures.length;result.registeredDistricts=manifest.districts.length;result.pendingJobs=0;result.completedJobs=Object.keys(progress.jobs).length;result.finished=new Date().toISOString();result.entry={x:manifest.origin.x+192,y:manifest.origin.y+7,z:manifest.origin.z+444};
writeFileSync(new URL('../artifacts/konoha-manifest.json', import.meta.url),JSON.stringify(manifest,null,2));writeFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({completed:true,dimensions:result.dimensions,blocks:result.placedBlocks,buildings:result.buildings,residences:result.residences,failedBlocks:0,pendingJobs:0,routeDestinations:routes.verifiedDestinations,labelsVerified:result.labelsVerified,entry:result.entry,visualReview:false}));
