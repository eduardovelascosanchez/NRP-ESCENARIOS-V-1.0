/* NRP Escenarios V1.3 — Modo Evaluación de Instructor */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=(s,r=document)=>($(s,r)?.textContent||'').replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer=null, seconds=0, running=false, data={};
const weights={done:1,partial:.5,missed:0,critical:0};
function scenarioKey(){return [$('#ga')?.value,$('#problema')?.value,$('#nivel')?.value,txt('#out h2')].filter(Boolean).join('|')||'nrp-v13'}
function extractItems(){
 const items=[];
 $$('#out .ck li').forEach((li,i)=>items.push({id:'ck'+i,label:li.textContent.replace(/\s+/g,' ').trim(),critical:/cr[ií]tic|ventil|frecuencia cardiaca|compresi|epine|adrenal/i.test(li.textContent)}));
 if(!items.length){
   $$('#out .state,.sim-action').forEach((n,i)=>{const a=txt('.a',n)||txt('.st-body',n)||txt('.cell p',n);if(a)items.push({id:'st'+i,label:a,critical:/ventil|compresi|epine|adrenal|<60|menor de 60/i.test(a)})});
 }
 const base=[
  ['eval','Evaluación inicial organizada y verbalización de prioridades',true],
  ['roles','Asignación clara de funciones y liderazgo inicial',false],
  ['reassess','Reevaluación después de cada intervención relevante',true],
  ['closedloop','Comunicación de circuito cerrado',false],
  ['situational','Mantiene conciencia situacional y anticipa el siguiente paso',false]
 ];
 base.forEach(x=>items.push({id:x[0],label:x[1],critical:x[2]}));
 const seen=new Set(); return items.filter(x=>x.label&&!seen.has(x.label)&&(seen.add(x.label),true)).slice(0,14);
}
function nonTechnical(){return [
 ['leadership','Liderazgo y distribución de tareas'],['communication','Comunicación y circuito cerrado'],['situational','Conciencia situacional'],['workload','Gestión de carga de trabajo y recursos'],['decision','Toma de decisiones y reevaluación']
]}
function fmt(s){return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function tick(){seconds++;const e=$('#evalClock');if(e)e.textContent=fmt(seconds)}
function startTimer(){if(running)return;running=true;timer=setInterval(tick,1000);$('#evalTimerBtn').textContent='⏸ Pausar'}
function pauseTimer(){running=false;if(timer){clearInterval(timer);timer=null}$('#evalTimerBtn').textContent='▶ Continuar'}
function toggleTimer(){running?pauseTimer():startTimer()}
function resetTimer(){pauseTimer();seconds=0;if($('#evalClock'))$('#evalClock').textContent='0:00';$$('.eval-timestamp').forEach(e=>e.textContent='—')}
function setStatus(id,v,btn){data[id]=data[id]||{};data[id].status=v;btn.closest('.eval-status').querySelectorAll('button').forEach(b=>b.classList.toggle('sel',b===btn));save();recalc()}
function stamp(id){data[id]=data[id]||{};data[id].time=seconds;const e=$(`[data-time-for="${id}"]`);if(e)e.textContent=fmt(seconds);save()}
function recalc(){
 const items=extractItems(), rated=items.filter(x=>data[x.id]?.status), max=rated.length||1;
 const raw=rated.reduce((s,x)=>s+(weights[data[x.id].status]??0),0);
 const tech=Math.round((raw/max)*100);
 const nts=nonTechnical().map(x=>Number($(`[data-nt="${x[0]}"]`)?.value||0)).filter(Boolean); const nt=nts.length?Math.round(nts.reduce((a,b)=>a+b,0)/(nts.length*5)*100):0;
 const criticalFail=items.some(x=>x.critical&&['missed','critical'].includes(data[x.id]?.status));
 const total=Math.round(tech*.7+nt*.3);
 const score=$('#evalScore');if(score)score.textContent=total+'%'; const v=$('#evalVerdict');
 if(v){v.className='eval-verdict '+(criticalFail||total<70?'no':total<85?'mid':'ok');v.textContent=criticalFail?'Requiere revisión por error crítico':total>=85?'Desempeño sólido':total>=70?'En desarrollo':'Requiere mejora'}
 const ts=$('#evalTechScore');if(ts)ts.textContent=tech+'%'; const ns=$('#evalNTScore');if(ns)ns.textContent=nt+'%';
 buildReport(total,tech,nt,criticalFail);
}
function buildReport(total,tech,nt,criticalFail){
 const items=extractItems(); const strengths=items.filter(x=>data[x.id]?.status==='done').slice(0,4).map(x=>x.label); const improve=items.filter(x=>['partial','missed','critical'].includes(data[x.id]?.status)).slice(0,5).map(x=>x.label);
 const notes=$('#evalNotes')?.value?.trim()||'';
 const r=$('#evalReport'); if(!r)return;
 r.innerHTML=`<h3>Reporte automático de desempeño</h3><p><strong>Puntuación global:</strong> ${total}% · Técnica: ${tech}% · No técnica: ${nt}%${criticalFail?' · <strong>Se identificó al menos un error crítico.</strong>':''}</p><div class="eval-summary"><div><strong>Fortalezas observadas</strong>${strengths.length?'<ul>'+strengths.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'<p>Sin elementos calificados como realizados todavía.</p>'}</div><div><strong>Prioridades de mejora</strong>${improve.length?'<ul>'+improve.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'<p>No se registraron oportunidades mayores.</p>'}</div></div>${notes?`<p><strong>Notas del instructor:</strong> ${esc(notes)}</p>`:''}<p><strong>Retroalimentación sugerida:</strong> conservar las conductas efectivas, priorizar la corrección de los elementos incompletos y volver a practicar cualquier error crítico antes de considerar dominio consistente.</p>`;
}
function save(){
 const nt={};nonTechnical().forEach(x=>nt[x[0]]=$(`[data-nt="${x[0]}"]`)?.value||'');
 const payload={data,seconds,nt,notes:$('#evalNotes')?.value||'',name:$('#evalName')?.value||'',date:new Date().toISOString()};
 try{localStorage.setItem('NRP_EVAL_'+scenarioKey(),JSON.stringify(payload))}catch(e){}
}
function load(){try{const p=JSON.parse(localStorage.getItem('NRP_EVAL_'+scenarioKey())||'null');if(!p)return;data=p.data||{};seconds=p.seconds||0;$('#evalClock').textContent=fmt(seconds);$('#evalName').value=p.name||'';$('#evalNotes').value=p.notes||'';Object.entries(p.nt||{}).forEach(([k,v])=>{const e=$(`[data-nt="${k}"]`);if(e)e.value=v});Object.entries(data).forEach(([id,o])=>{if(o.status){const b=$(`.eval-status button[data-id="${id}"][data-value="${o.status}"]`);if(b)b.classList.add('sel')}if(Number.isFinite(o.time)){const t=$(`[data-time-for="${id}"]`);if(t)t.textContent=fmt(o.time)}});recalc()}catch(e){}
}
function clearEval(){if(!confirm('¿Borrar la evaluación registrada para este escenario?'))return;data={};try{localStorage.removeItem('NRP_EVAL_'+scenarioKey())}catch(e){}render()}
function row(item){return `<tr class="${item.critical?'critical-row':''}"><td class="metric">${item.critical?'⚠️ ':''}${esc(item.label)}</td><td><div class="eval-status"><button data-id="${item.id}" data-value="done">Realizada</button><button data-id="${item.id}" data-value="partial">Parcial</button><button data-id="${item.id}" data-value="missed">No realizada</button><button data-id="${item.id}" data-value="critical">Crítica</button></div></td><td><button class="eval-timebtn" data-stamp="${item.id}">⏱ Marcar</button><span class="eval-timestamp" data-time-for="${item.id}">—</span></td></tr>`}
function render(){
 const items=extractItems(), nts=nonTechnical(), problem=$('#problema')?.value||'Escenario activo', ga=$('#ga')?.value||'—', level=$('#nivel')?.value||'—';
 $('#evalContent').innerHTML=`<div class="eval-banner"><strong>Evaluación formativa del instructor.</strong> Registre la conducta observada en tiempo real. “Crítica” debe reservarse para una acción u omisión con impacto importante en la seguridad o en la progresión del algoritmo educativo.</div><div class="eval-topgrid"><div class="eval-stat"><div class="k">Escenario</div><div class="v">${esc(problem)}</div></div><div class="eval-stat"><div class="k">Edad gestacional</div><div class="v">${esc(ga)}</div></div><div class="eval-stat"><div class="k">Nivel</div><div class="v">${esc(level)}</div></div><div class="eval-stat"><div class="k">Reloj de evaluación</div><div class="v eval-clock" id="evalClock">0:00</div><div style="margin-top:6px"><button class="eval-btn" id="evalTimerBtn">▶ Iniciar</button> <button class="eval-btn" id="evalResetBtn">⟲</button></div></div></div><div class="eval-grid"><section class="eval-card"><h3>1. Habilidades técnicas y conductas observables</h3><div class="inner"><table class="eval-table"><thead><tr><th>Ítem</th><th>Estado</th><th>Tiempo</th></tr></thead><tbody>${items.map(row).join('')}</tbody></table></div></section><aside><section class="eval-card"><h3>2. Habilidades no técnicas</h3><div class="inner eval-nt-list">${nts.map(x=>`<div class="eval-nt"><label>${esc(x[1])}</label><select data-nt="${x[0]}"><option value="">Sin calificar</option><option value="1">1 · Deficiente</option><option value="2">2 · Limitada</option><option value="3">3 · Adecuada</option><option value="4">4 · Muy buena</option><option value="5">5 · Excelente</option></select></div>`).join('')}</div></section><section class="eval-card" style="margin-top:14px"><h3>3. Resultado</h3><div class="inner"><div class="eval-summary"><div class="eval-scorebox"><div class="score" id="evalScore">0%</div><div class="label">Puntuación global</div><div id="evalVerdict" class="eval-verdict no">Sin evaluación</div></div><div><div class="eval-stat"><div class="k">Técnica</div><div class="v" id="evalTechScore">0%</div></div><div class="eval-stat" style="margin-top:8px"><div class="k">No técnica</div><div class="v" id="evalNTScore">0%</div></div></div></div></div></section><section class="eval-card" style="margin-top:14px"><h3>4. Datos y notas</h3><div class="inner"><label style="font-size:.72rem;font-weight:700">Participante / equipo</label><input class="eval-input" id="evalName" placeholder="Nombre o equipo"><label style="font-size:.72rem;font-weight:700;display:block;margin-top:10px">Observaciones</label><textarea class="eval-textarea" id="evalNotes" placeholder="Fortalezas, decisiones, errores, puntos para debriefing..."></textarea></div></section></aside></div><div class="eval-report" id="evalReport"></div><div class="eval-banner warn"><strong>Interpretación:</strong> la puntuación es una ayuda formativa local del generador y no debe presentarse como criterio oficial de certificación NRP. Los errores críticos requieren revisión cualitativa del instructor.</div><div class="eval-footer">Modo Evaluación de Instructor · NRP Escenarios V1.3 · EDUVESA</div>`;
 $$('.eval-status button').forEach(b=>b.addEventListener('click',()=>setStatus(b.dataset.id,b.dataset.value,b)));$$('[data-stamp]').forEach(b=>b.addEventListener('click',()=>stamp(b.dataset.stamp)));$$('[data-nt]').forEach(e=>e.addEventListener('change',()=>{save();recalc()}));$('#evalNotes').addEventListener('input',()=>{save();recalc()});$('#evalName').addEventListener('input',save);$('#evalTimerBtn').addEventListener('click',toggleTimer);$('#evalResetBtn').addEventListener('click',resetTimer);load();recalc();
}
function open(){if(!$('#out')?.children.length){alert('Primero genere un escenario. La evaluación se construye a partir del caso activo.');return}render();$('#evalMode').classList.add('is-open');document.body.style.overflow='hidden'}
function close(){pauseTimer();$('#evalMode')?.classList.remove('is-open');document.body.style.overflow=''}
function printMode(){save();document.body.classList.add('eval-printing');window.print();setTimeout(()=>document.body.classList.remove('eval-printing'),300)}
function inject(){
 if($('#evalMode'))return;
 document.body.insertAdjacentHTML('beforeend',`<div class="eval-backdrop" id="evalMode" role="dialog" aria-modal="true"><div class="eval-shell"><header class="eval-head"><div><h2>📋 Modo Evaluación de Instructor <span style="font-size:12px;opacity:.8">V1.3</span></h2><p>Registro en tiempo real · habilidades técnicas y no técnicas · reporte automático</p></div><div class="eval-actions"><button class="light" id="evalClear">🗑 Reiniciar evaluación</button><button class="green" id="evalPrint">🖨 Imprimir / PDF</button><button class="close" id="evalClose">✕ Cerrar</button></div></header><div class="eval-body" id="evalContent"></div></div></div>`);
 const toolbar=$('.guide-toolbar');if(toolbar&&!$('.eval-open-btn',toolbar)){const b=document.createElement('button');b.type='button';b.className='eval-open-btn';b.textContent='📋 Evaluación';toolbar.insertBefore(b,toolbar.querySelector('.guide-toolbar-note'));b.addEventListener('click',open)}
 const f=document.createElement('button');f.type='button';f.className='eval-float';f.textContent='📋 Evaluar';f.addEventListener('click',open);document.body.appendChild(f);
 $('#evalClose').addEventListener('click',close);$('#evalPrint').addEventListener('click',printMode);$('#evalClear').addEventListener('click',clearEval);$('#evalMode').addEventListener('click',e=>{if(e.target.id==='evalMode')close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#evalMode')?.classList.contains('is-open'))close()});
 const badge=$('.guide-version');if(badge)badge.textContent='V1.3';document.title=document.title.replace(/\s*·\s*V1\.[12]\s*/i,'').trim()+' · V1.3';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
window.NRPEvaluation={open,close,render};
})();
