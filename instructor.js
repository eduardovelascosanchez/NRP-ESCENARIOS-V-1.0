/* NRP Escenarios V1.2 — Modo Instructor dinámico
   Lee el escenario generado y construye una hoja separada para facilitación. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=(s,r=document)=>($(s,r)?.textContent||'').replace(/\s+/g,' ').trim();
const val=id=>{const e=document.getElementById(id);return e?(e.type==='checkbox'?(e.checked?'Sí':'No'):(e.value||e.options?.[e.selectedIndex]?.text||'')):'—'};
const esc=s=>String(s||'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function scenarioText(){return txt('#out').toLowerCase()}
function extractHeadings(){return $$('#out h2,#out h3').map(e=>e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean)}
function extractExpected(){
  const out=$('#out'); if(!out)return [];
  const arr=[];
  $$('.state,.sim-action',out).forEach((node,i)=>{
    const title=txt('.ph',node)||txt('.h',node)||`Fase ${i+1}`;
    const action=txt('.a',node)||txt('.cell p',node)||txt('.st-body',node);
    const trigger=txt('.trg',node)||txt('.trigger',node);
    if(action)arr.push({title,action,trigger});
  });
  if(!arr.length){
    $$('#out .ck li').slice(0,8).forEach((li,i)=>arr.push({title:`Acción ${i+1}`,action:li.textContent.replace(/\s+/g,' ').trim(),trigger:''}));
  }
  return arr.slice(0,10);
}
function chosenRisks(){return $$('#riskbox input:checked').map(i=>i.closest('label')?.textContent?.replace(/\s+/g,' ').trim()||i.value).filter(Boolean)}
function objectives(){
  const t=scenarioText(), list=[];
  list.push('Realizar una evaluación inicial organizada, verbalizando hallazgos y prioridades.');
  if(/ventil|apnea|respir|vpp/.test(t)) list.push('Reconocer oportunamente la necesidad de ventilación y evaluar su efectividad mediante respuesta clínica.');
  if(/compresi|<60|menor de 60|masaje/.test(t)) list.push('Reconocer cuándo la respuesta es insuficiente y coordinar el escalamiento de las maniobras de reanimación.');
  if(/epine|adrenal|umbil|medic|acceso/.test(t)) list.push('Integrar acceso vascular y medicación cuando estén indicados por la evolución del escenario.');
  list.push('Demostrar comunicación en circuito cerrado, asignación clara de funciones y liderazgo adaptativo.');
  list.push('Reevaluar después de cada intervención y utilizar la respuesta del recién nacido para decidir el siguiente paso.');
  return [...new Set(list)].slice(0,5);
}
function criticalErrors(){
  const t=scenarioText(), e=[
    'No reconocer un deterioro clínico relevante o retrasar una intervención prioritaria.',
    'Continuar una intervención sin reevaluar su efectividad ni la respuesta fisiológica.',
    'Perder claridad en roles, liderazgo o comunicación durante un punto crítico.'
  ];
  if(/ventil|vpp|apnea/.test(t)) e.unshift('No identificar ventilación inefectiva o no corregirla cuando la frecuencia cardiaca no mejora.');
  if(/compresi|<60|menor de 60/.test(t)) e.push('Iniciar o mantener compresiones sin asegurar previamente una estrategia ventilatoria efectiva y coordinada.');
  if(/epine|adrenal|medic/.test(t)) e.push('Administrar medicación sin verificar indicación, vía, preparación o coordinación del equipo.');
  return [...new Set(e)].slice(0,6);
}
function facilitatorCues(){
  const t=scenarioText(); const a=[];
  a.push('Si el equipo se estanca, entregue un dato clínico nuevo en vez de indicar la maniobra que debe realizar.');
  if(/ventil|apnea|vpp/.test(t)) a.push('Pista de bajo nivel: “La frecuencia cardiaca no está aumentando como esperaba”. Pista mayor: “No observa un movimiento torácico consistente”.');
  if(/ox[ií]geno|spo2|satur/.test(t)) a.push('Si el equipo se centra sólo en la saturación, rediríjalo con una pregunta sobre la respuesta global y la tendencia de la frecuencia cardiaca.');
  if(/compresi|<60|menor de 60/.test(t)) a.push('Si no reconoce el punto de escalamiento, informe de forma explícita la tendencia persistente de la frecuencia cardiaca después de intervenciones efectivas.');
  a.push('Evite “salvar” al participante demasiado pronto; permita tiempo para verbalizar, decidir, actuar y reevaluar.');
  return a.slice(0,5);
}
function triggers(expected){
  if(expected.length)return expected.map(x=>({when:x.title,what:x.trigger||'Cambiar el estado fisiológico cuando el equipo complete la acción esperada o cuando se alcance el tiempo definido en el escenario.'})).slice(0,8);
  return [
    {when:'Después de una intervención prioritaria',what:'Entregar la respuesta fisiológica prevista por el escenario.'},
    {when:'Si el equipo no actúa',what:'Mantener o empeorar gradualmente el estado, sin revelar la solución.'},
    {when:'Cuando se cumpla el objetivo principal',what:'Estabilizar el caso y preparar la transición al debriefing.'}
  ];
}
function stopCriteria(){return [
  'Se alcanzó el objetivo clínico principal y el equipo demuestra una estrategia de reevaluación adecuada.',
  'Se resolvió el problema central o se completó el escalamiento previsto en el escenario.',
  'Ya existe suficiente material observable para discutir los objetivos de trabajo en equipo y toma de decisiones.',
  'El facilitador identifica que continuar no aportará un objetivo educativo adicional.'
]}
function debrief(){
  const t=scenarioText(), q=[
    ['Reacción','¿Cómo se sintió el equipo durante el caso? ¿Qué fue lo más demandante?'],
    ['Descripción','¿Cómo resumirían lo que ocurrió desde el nacimiento hasta el punto final?'],
    ['Análisis','¿Qué datos guiaron su primera prioridad y cómo supieron si la intervención estaba funcionando?'],
    ['Trabajo en equipo','¿Cómo se distribuyeron los roles? ¿Qué comunicación ayudó y cuál podría ser más clara?']
  ];
  if(/ventil|vpp|apnea/.test(t)) q.push(['Análisis clínico','Cuando la respuesta no fue la esperada, ¿qué les hizo pensar en la efectividad de la ventilación y cómo decidieron corregirla?']);
  if(/compresi|<60|menor de 60/.test(t)) q.push(['Escalamiento','¿Qué evidencia utilizaron para decidir que era momento de escalar las maniobras?']);
  q.push(['Transferencia','¿Qué harían de manera diferente en un caso real similar?'],['Cierre','Mencionen dos aprendizajes que quieran conservar para su próxima reanimación.']);
  return q;
}
function context(){return {sexo:val('sexo'),ga:val('ga'),fluido:val('fluido'),parto:val('parto'),categoria:val('categoria'),problema:val('problema'),nivel:val('nivel'),postnatal:val('postnatal'),riesgos:chosenRisks().join(' · ')||'Sin factores seleccionados'}}
function card(n,title,html,wide=false){return `<section class="inst-card${wide?' wide':''}"><h3><span class="n">${n}</span>${title}</h3>${html}</section>`}
function list(items,cls=''){return `<ul>${items.map(x=>`<li class="${cls}">${esc(x)}</li>`).join('')}</ul>`}
function render(){
  const c=context(), expected=extractExpected(), obj=objectives(), errs=criticalErrors(), cues=facilitatorCues(), trg=triggers(expected), db=debrief();
  const summary=[['Sexo',c.sexo],['Edad gestacional',c.ga],['Líquido',c.fluido],['Nacimiento',c.parto],['Categoría',c.categoria],['Problema',c.problema],['Nivel',c.nivel],['Postnatal',c.postnatal],['Riesgos',c.riesgos]];
  $('#instContent').innerHTML=`
    <div class="inst-banner"><strong>Vista exclusiva del instructor.</strong> Esta información contiene objetivos, acciones esperadas, desencadenantes y ayudas que no deben mostrarse al participante durante el escenario.</div>
    <div class="inst-summary">${summary.map(x=>`<div class="i"><div class="k">${esc(x[0])}</div><div class="v">${esc(x[1])}</div></div>`).join('')}</div>
    <div class="inst-grid">
      ${card(1,'Objetivos ocultos para el participante',`<span class="inst-hidden-badge">No mostrar al alumno</span>${list(obj)}`)}
      ${card(2,'Prebriefing del instructor',list(['Definir el contrato de ficción y las limitaciones del simulador.','Aclarar cómo se solicitarán datos clínicos, recursos y apoyo adicional.','Asignar o permitir que el equipo asigne funciones de acuerdo con su nivel.','No revelar el diagnóstico ni la secuencia esperada de acciones.']))}
      ${card(3,'Acciones esperadas y evolución',expected.length?`<table class="inst-table"><thead><tr><th>Fase</th><th>Acción esperada</th><th>Respuesta / desencadenante</th></tr></thead><tbody>${expected.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.action)}</td><td>${esc(x.trigger||'Usar la respuesta fisiológica definida por el escenario.')}</td></tr>`).join('')}</tbody></table>`:list(['Utilizar la secuencia visible del escenario como referencia y documentar las decisiones observadas.']),true)}
      ${card(4,'Desencadenantes del facilitador',`<table class="inst-table"><thead><tr><th>Cuándo</th><th>Qué hace el facilitador</th></tr></thead><tbody>${trg.map(x=>`<tr><td>${esc(x.when)}</td><td>${esc(x.what)}</td></tr>`).join('')}</tbody></table>`,true)}
      ${card(5,'Pistas graduadas',cues.map(x=>`<div class="cue">${esc(x)}</div>`).join(''))}
      ${card(6,'Errores críticos a observar',list(errs,'critical'))}
      ${card(7,'Criterios para finalizar',stopCriteria().map(x=>`<div class="stop">${esc(x)}</div>`).join(''))}
      ${card(8,'Guía de debriefing específica',`<table class="inst-table"><thead><tr><th>Fase</th><th>Pregunta sugerida</th></tr></thead><tbody>${db.map(x=>`<tr><td><strong>${esc(x[0])}</strong></td><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table>`,true)}
      ${card(9,'Notas del instructor',`<textarea class="inst-note" id="instNotes" placeholder="Observaciones del equipo, decisiones, tiempos, errores, fortalezas y puntos para debriefing..."></textarea>`,true)}
    </div>
    <div class="inst-banner warn"><strong>Uso educativo.</strong> Esta hoja organiza la facilitación del caso generado. Debe revisarse antes de la sesión y no sustituye materiales oficiales del NRP, Instructor Toolkit, políticas del programa ni juicio clínico.</div>
    <div class="inst-footer">Modo Instructor · NRP Escenarios V1.2 · EDUVESA</div>`;
}
function open(){
  const out=$('#out');
  if(!out||!out.children.length){alert('Primero genere un escenario. El Modo Instructor se construye a partir del caso activo.');return}
  render(); $('#instructorMode').classList.add('is-open'); document.body.style.overflow='hidden';
}
function close(){ $('#instructorMode')?.classList.remove('is-open'); document.body.style.overflow=''; }
function printMode(){document.body.classList.add('inst-printing');window.print();setTimeout(()=>document.body.classList.remove('inst-printing'),300)}
function inject(){
  if($('#instructorMode'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="instructor-backdrop" id="instructorMode" role="dialog" aria-modal="true" aria-labelledby="instTitle"><div class="instructor-shell"><header class="instructor-head"><div><h2 id="instTitle">🎓 Modo Instructor <span style="font-size:12px;opacity:.75">V1.2</span></h2><p>Hoja privada de facilitación construida a partir del escenario activo</p></div><div class="instructor-head-actions"><button class="inst-refresh" type="button">↻ Actualizar</button><button class="inst-print" type="button">🖨 Imprimir / PDF</button><button class="inst-close" type="button">✕ Cerrar</button></div></header><div class="instructor-body" id="instContent"></div></div></div>`);
  const toolbar=$('.guide-toolbar');
  if(toolbar&&!$('.instructor-btn',toolbar)){
    const b=document.createElement('button');b.type='button';b.className='instructor-btn';b.textContent='🎓 Modo Instructor';toolbar.insertBefore(b,toolbar.querySelector('.guide-toolbar-note'));b.addEventListener('click',open);
  }
  const f=document.createElement('button');f.type='button';f.className='instructor-float';f.textContent='🎓 Instructor';f.setAttribute('aria-label','Abrir Modo Instructor');f.addEventListener('click',open);document.body.appendChild(f);
  $('.inst-close')?.addEventListener('click',close);$('.inst-refresh')?.addEventListener('click',render);$('.inst-print')?.addEventListener('click',printMode);$('#instructorMode')?.addEventListener('click',e=>{if(e.target.id==='instructorMode')close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#instructorMode')?.classList.contains('is-open'))close()});
  const badge=$('.guide-version');if(badge)badge.textContent='V1.2';
  if(!/V1\.2/.test(document.title))document.title=document.title.replace(/\s*·\s*V1\.1\s*/i,'').trim()+' · V1.2';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
window.NRPInstructor={open,close,render};
})();
