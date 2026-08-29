/* NRP Escenarios V1.4 — Replay + Debriefing inteligente */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
let events=[], startedAt=null, replayIdx=-1, playback=null;
function fmt(sec){sec=Math.max(0,Math.floor(sec||0));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}
function scenarioKey(){return [$('#ga')?.value,$('#problema')?.value,$('#nivel')?.value,clean($('#out h2')?.textContent)].filter(Boolean).join('|')||'nrp-v14'}
function getClock(){const t=clean($('#evalClock')?.textContent);if(/^\d+:\d{2}$/.test(t)){const [m,s]=t.split(':').map(Number);return m*60+s}if(startedAt)return Math.floor((Date.now()-startedAt)/1000);return 0}
function save(){try{localStorage.setItem('NRP_REPLAY_'+scenarioKey(),JSON.stringify({events,startedAt}))}catch(e){}}
function load(){try{const p=JSON.parse(localStorage.getItem('NRP_REPLAY_'+scenarioKey())||'null');events=Array.isArray(p?.events)?p.events:[];startedAt=p?.startedAt||null}catch(e){events=[];startedAt=null}}
function add(type,text,status=''){const ev={id:Date.now()+Math.random(),time:getClock(),type,text:clean(text),status};events.push(ev);events.sort((a,b)=>a.time-b.time);save();if($('#replayMode')?.classList.contains('is-open'))renderTimeline()}
function statusLabel(v){return ({done:'Realizada',partial:'Parcial',missed:'No realizada',critical:'Crítica'})[v]||v}
function deriveItemLabel(btn){const tr=btn.closest('tr');return clean(tr?.querySelector('.metric')?.textContent)||btn.dataset.id||'Conducta evaluada'}
function captureClick(e){const b=e.target.closest('button');if(!b)return;
 if(b.matches('.eval-status button[data-value]')) add('Evaluación',`${deriveItemLabel(b)} — ${statusLabel(b.dataset.value)}`,b.dataset.value);
 else if(b.matches('[data-stamp]')) add('Tiempo',`Hito marcado: ${clean(b.closest('tr')?.querySelector('.metric')?.textContent)||b.dataset.stamp}`,'');
 else if(b.id==='sim_next') add('Simulación','Avance manual al siguiente estado del escenario','');
 else if(b.id==='sim_prev') add('Simulación','Retroceso manual al estado previo del escenario','');
 else if(b.id==='sim_play'){if(!startedAt){startedAt=Date.now();save()}add('Simulación','Inicio / reanudación del escenario','');}
 else if(b.classList.contains('sc-reset')) add('Simulación','Reinicio del reloj del escenario','');
}
function captureChange(e){const el=e.target;if(el.matches('[data-nt]')){const label=clean(el.closest('.eval-nt')?.querySelector('label')?.textContent)||el.dataset.nt;add('CRM',`${label}: ${el.value||'sin calificar'}/5`,Number(el.value)>=4?'done':Number(el.value)<=2&&el.value?'partial':'')}}
function strengthsAndGaps(){const s=[],g=[],c=[];events.forEach(ev=>{if(ev.type==='Evaluación'){if(ev.status==='done')s.push(ev.text);if(ev.status==='partial'||ev.status==='missed')g.push(ev.text);if(ev.status==='critical')c.push(ev.text)}});return {s:[...new Set(s)],g:[...new Set(g)],c:[...new Set(c)]}}
function intelligentQuestions(){
 const {s,g,c}=strengthsAndGaps(), qs=[];
 qs.push({kind:'PEARLS · Reacción',tone:'ai',stem:'Abrir el debriefing',q:'¿Cómo se sintieron durante el caso y en qué momento sintieron que cambió la dificultad del escenario?'});
 const first=events[0], last=events[events.length-1];
 if(first&&last)qs.push({kind:'Reconstrucción',tone:'',stem:`Replay ${fmt(first.time)} → ${fmt(last.time)}`,q:'Si recorremos la línea de tiempo, ¿qué decisiones fueron los puntos de inflexión más importantes y qué información utilizaron para tomarlas?'});
 c.slice(0,3).forEach(x=>qs.push({kind:'Advocacy–Inquiry',tone:'warn',stem:`Observación: ${x}`,q:`Observé este evento durante el escenario. Me preocupó porque podía afectar la progresión o seguridad del caso. ¿Qué estaban pensando en ese momento?`}));
 g.slice(0,3).forEach(x=>qs.push({kind:'Advocacy–Inquiry',tone:'warn',stem:`Oportunidad: ${x}`,q:'Noté que esta conducta quedó incompleta o no se realizó. ¿Qué señales estaban priorizando y qué podría ayudarles a reconocer antes este punto la próxima vez?'}));
 s.slice(0,2).forEach(x=>qs.push({kind:'Refuerzo',tone:'ai',stem:`Fortaleza: ${x}`,q:'Esta conducta fue efectiva. ¿Qué facilitó que el equipo la realizara bien y cómo pueden reproducirla en un caso real?'}));
 const crm=events.filter(e=>e.type==='CRM');if(crm.length)qs.push({kind:'CRM',tone:'ai',stem:'Trabajo en equipo',q:'¿Cómo influyeron liderazgo, comunicación y distribución de tareas en la velocidad y calidad de las decisiones?'});
 const gaps=events.filter(e=>/ventil|compresi|epine|adrenal|frecuencia cardiaca|reevalu/i.test(e.text)&&['partial','missed','critical'].includes(e.status));if(gaps.length)qs.push({kind:'Análisis clínico',tone:'warn',stem:'Prioridad clínica',q:'¿Qué dato fisiológico debía confirmar que la intervención estaba siendo efectiva y cómo habría cambiado su siguiente decisión?'});
 qs.push({kind:'Transferencia',tone:'ai',stem:'Aplicación práctica',q:'Si mañana enfrentaran un recién nacido similar, ¿qué una o dos conductas cambiarían desde el primer minuto?'});
 qs.push({kind:'Resumen',tone:'',stem:'Cierre',q:'¿Cuáles son los dos mensajes principales que quieren llevarse de este escenario?'});
 return qs.slice(0,10);
}
function renderTimeline(){const host=$('#replayTimeline');if(!host)return;if(!events.length){host.innerHTML='<div class="replay-empty">Aún no hay eventos registrados. Use la Evaluación V1.3 o avance el escenario para construir el replay.</div>';return}host.innerHTML='<div class="replay-track">'+events.map((e,i)=>`<div class="replay-event ${esc(e.status)}${i===replayIdx?' active':''}" data-replay-i="${i}"><span class="time">${fmt(e.time)}</span><span class="type">${esc(e.type)}</span><div class="text">${esc(e.text)}</div></div>`).join('')+'</div>';$$('[data-replay-i]',host).forEach(el=>el.addEventListener('click',()=>selectEvent(+el.dataset.replayI)))}
function renderQuestions(){const host=$('#smartDebrief');if(!host)return;const qs=intelligentQuestions();host.innerHTML=qs.map(x=>`<div class="smart-q ${x.tone}"><span class="tag">${esc(x.kind)}</span><div class="stem">${esc(x.stem)}</div><p>${esc(x.q)}</p></div>`).join('')}
function selectEvent(i){if(i<0||i>=events.length)return;replayIdx=i;renderTimeline();const e=events[i];$('#replayClock').textContent=fmt(e.time);$('#replayNow').textContent=e.text;document.querySelector(`[data-replay-i="${i}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'})}
function play(){if(playback){clearInterval(playback);playback=null;$('#replayPlay').textContent='▶ Reproducir';return}if(!events.length)return;if(replayIdx>=events.length-1)replayIdx=-1;$('#replayPlay').textContent='⏸ Pausar';playback=setInterval(()=>{replayIdx++;if(replayIdx>=events.length){clearInterval(playback);playback=null;replayIdx=events.length-1;$('#replayPlay').textContent='▶ Reproducir';return}selectEvent(replayIdx)},900)}
function clearReplay(){if(!confirm('¿Borrar la línea de tiempo y el debriefing generado para este escenario?'))return;events=[];startedAt=null;replayIdx=-1;save();renderTimeline();renderQuestions();$('#replayClock').textContent='0:00';$('#replayNow').textContent='Sin evento seleccionado'}
function summary(){const {s,g,c}=strengthsAndGaps();return {total:events.length,strengths:s.length,gaps:g.length,critical:c.length}}
function render(){load();const sm=summary();$('#replayContent').innerHTML=`
 <div class="replay-banner"><strong>Replay educativo.</strong> Esta vista organiza los eventos observados y las marcas de evaluación en una línea de tiempo. No reproduce audio ni video; reconstruye la secuencia de decisiones registrada durante el escenario.</div>
 <div class="replay-summary"><div class="replay-stat"><div class="k">Eventos</div><div class="v">${sm.total}</div></div><div class="replay-stat"><div class="k">Fortalezas</div><div class="v">${sm.strengths}</div></div><div class="replay-stat"><div class="k">Oportunidades / críticos</div><div class="v">${sm.gaps} / ${sm.critical}</div></div></div>
 <div class="replay-grid"><section class="replay-card"><h3>1. Línea de tiempo y Replay</h3><div class="replay-inner"><div class="replay-controls"><button class="replay-btn" id="replayPlay">▶ Reproducir</button><button class="replay-btn" id="replayPrev">◀</button><button class="replay-btn" id="replayNext">▶</button><span class="replay-clock" id="replayClock">0:00</span><span id="replayNow" style="font-size:.78rem;color:#667085">Sin evento seleccionado</span></div><div id="replayTimeline"></div></div></section>
 <aside><section class="replay-card"><h3>2. Debriefing inteligente</h3><div class="replay-inner" id="smartDebrief"></div></section><section class="replay-card" style="margin-top:14px"><h3>3. Notas del debriefing</h3><div class="replay-inner"><textarea class="replay-note" id="replayNotes" placeholder="Modelos mentales identificados, acuerdos, mensajes de cierre y plan de mejora..."></textarea></div></section></aside></div>
 <div class="replay-banner warn"><strong>Importante.</strong> Las preguntas se generan a partir de eventos registrados por el instructor. Son sugerencias para facilitar PEARLS/Advocacy–Inquiry y deben adaptarse al contexto, nivel del participante y objetivos educativos.</div><div class="replay-footer">Replay + Debriefing inteligente · NRP Escenarios V1.4 · EDUVESA</div>`;
 renderTimeline();renderQuestions();$('#replayPlay').addEventListener('click',play);$('#replayPrev').addEventListener('click',()=>selectEvent(Math.max(0,replayIdx-1)));$('#replayNext').addEventListener('click',()=>selectEvent(Math.min(events.length-1,replayIdx+1)));try{$('#replayNotes').value=localStorage.getItem('NRP_REPLAY_NOTES_'+scenarioKey())||''}catch(e){}$('#replayNotes').addEventListener('input',e=>{try{localStorage.setItem('NRP_REPLAY_NOTES_'+scenarioKey(),e.target.value)}catch(err){}})}
function open(){if(!$('#out')?.children.length){alert('Primero genere un escenario. El Replay se vincula al caso activo.');return}render();$('#replayMode').classList.add('is-open');document.body.style.overflow='hidden'}
function close(){if(playback){clearInterval(playback);playback=null}$('#replayMode')?.classList.remove('is-open');document.body.style.overflow=''}
function printMode(){document.body.classList.add('replay-printing');window.print();setTimeout(()=>document.body.classList.remove('replay-printing'),300)}
function inject(){if($('#replayMode'))return;document.body.insertAdjacentHTML('beforeend',`<div class="replay-backdrop" id="replayMode" role="dialog" aria-modal="true"><div class="replay-shell"><header class="replay-head"><div><h2>⏪ Replay + Debriefing inteligente <span style="font-size:12px;opacity:.8">V1.4</span></h2><p>Línea de tiempo · puntos de decisión · PEARLS · Advocacy–Inquiry</p></div><div class="replay-actions"><button class="light" id="replayClear">🗑 Reiniciar replay</button><button class="green" id="replayPrint">🖨 Imprimir / PDF</button><button class="close" id="replayClose">✕ Cerrar</button></div></header><div class="replay-body" id="replayContent"></div></div></div>`);
 const toolbar=$('.guide-toolbar');if(toolbar&&!$('.replay-open-btn',toolbar)){const b=document.createElement('button');b.type='button';b.className='replay-open-btn';b.textContent='⏪ Replay + Debriefing';toolbar.insertBefore(b,toolbar.querySelector('.guide-toolbar-note'));b.addEventListener('click',open)}
 const f=document.createElement('button');f.type='button';f.className='replay-float';f.textContent='⏪ Replay';f.addEventListener('click',open);document.body.appendChild(f);
 document.addEventListener('click',captureClick,true);document.addEventListener('change',captureChange,true);$('#replayClose').addEventListener('click',close);$('#replayPrint').addEventListener('click',printMode);$('#replayClear').addEventListener('click',clearReplay);$('#replayMode').addEventListener('click',e=>{if(e.target.id==='replayMode')close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#replayMode')?.classList.contains('is-open'))close()});
 const badge=$('.guide-version');if(badge)badge.textContent='V1.4';document.title=document.title.replace(/\s*·\s*V1\.[123]\s*/i,'').trim()+' · V1.4';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
window.NRPReplay={open,close,add,render};
})();
