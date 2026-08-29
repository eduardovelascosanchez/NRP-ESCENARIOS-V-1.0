/* NRP Escenarios V1.1 — instructivo integrado y modo guiado
   Capa educativa; no modifica el motor clínico del generador. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const guideHTML=`
<div class="guide-modal-backdrop" id="guideModal" role="dialog" aria-modal="true" aria-labelledby="guideTitle">
  <article class="guide-modal">
    <header class="guide-modal-head">
      <div><h2 id="guideTitle">Instructivo de uso</h2><p>Generador de Escenarios de Simulación Neonatal · NRP 9.ª edición · EDUVESA</p></div>
      <button class="guide-close" type="button" aria-label="Cerrar instructivo">×</button>
    </header>
    <div class="guide-modal-body">
      <div class="guide-callout"><strong>Propósito.</strong> Esta herramienta apoya la preparación de escenarios estructurados para enseñanza, práctica, evaluación formativa y debriefing en reanimación neonatal. El instructor debe revisar cada caso antes de usarlo.</div>
      <h3 style="margin:20px 0 10px;color:#36568b">Flujo recomendado</h3>
      <div class="guide-flow"><span>1 · Paciente</span><span>2 · Contexto</span><span>3 · Problema</span><span>4 · Riesgos</span><span>5 · Nivel</span><span>6 · Objetivos</span><span>7 · Generar</span><span>8 · Simular</span><span>9 · Debriefing</span></div>

      <section class="guide-section"><h3>1. Configure al recién nacido</h3><p>Seleccione <strong>sexo</strong> y <strong>edad gestacional</strong>. La edad gestacional condiciona la preparación, los riesgos previsibles y la complejidad clínica del escenario.</p></section>
      <section class="guide-section"><h3>2. Defina el contexto obstétrico</h3><p>Seleccione las características del <strong>líquido amniótico</strong> y la <strong>vía de nacimiento</strong>. Utilice estos datos para trabajar anticipación, preparación del equipo y asignación de funciones.</p></section>
      <section class="guide-section"><h3>3. Elija el problema clínico</h3><p>Seleccione una <strong>categoría</strong> y después un <strong>problema específico</strong>. Si usa “Sugerir automáticamente”, el sistema escogerá una opción compatible con las variables disponibles. El objetivo no es adivinar un diagnóstico, sino provocar decisiones clínicas y de trabajo en equipo pertinentes.</p></section>
      <section class="guide-section"><h3>4. Agregue antecedentes maternos y factores de riesgo</h3><p>Como regla práctica, comience con uno o dos factores relevantes. Cada antecedente debe tener una función pedagógica: pregúntese qué debe anticipar o preparar el equipo al conocerlo.</p></section>
      <section class="guide-section"><h3>5. Ajuste el nivel del participante</h3><p>Seleccione el nivel que corresponda al grupo. En niveles iniciales priorice evaluación, ventilación efectiva y reevaluación. En participantes avanzados puede aumentar la complejidad con vía aérea avanzada, compresiones, medicación, acceso vascular, liderazgo y toma de decisiones.</p></section>
      <section class="guide-section"><h3>6. Escenario postnatal</h3><p>Active esta opción cuando quiera trabajar un deterioro neonatal fuera del momento inmediato del nacimiento. El contexto, los tiempos y la evaluación inicial deberán interpretarse de acuerdo con esa situación.</p></section>
      <section class="guide-section"><h3>7. Defina el objetivo educativo antes de generar</h3><p>Identifique: <strong>a)</strong> la habilidad clínica principal, <strong>b)</strong> la conducta de equipo que desea observar y <strong>c)</strong> el punto que quiere explorar durante el debriefing. Un escenario efectivo no es necesariamente el más complejo; es el que produce el aprendizaje previsto.</p></section>
      <section class="guide-section"><h3>8. Genere y revise el escenario</h3><p>Presione <strong>Generar escenario</strong>. Antes de utilizarlo, revise coherencia clínica, objetivos, dificultad, secuencia esperada, recursos, respuestas fisiológicas, puntos de decisión y criterios de finalización. El botón 🎲 permite variar las entradas y es útil para prácticas o casos sorpresa.</p></section>
      <section class="guide-section"><h3>9. Prebriefing y asignación de roles</h3><p>Explique objetivos generales, funcionamiento y limitaciones del simulador, recursos disponibles, cómo solicitar datos y expectativas de participación. Asigne funciones según el número de participantes: liderazgo, vía aérea/ventilación, monitorización, compresiones, acceso/medicación, registro u observación.</p></section>
      <section class="guide-section"><h3>10. Conducción del escenario</h3><p>Facilite sin resolver el caso por el alumno. En vez de indicar la acción (“ahora ventile”), entregue información clínica (“continúa apneico”, “la frecuencia cardiaca no aumenta”, “no observa movimiento torácico”). El participante debe interpretar, decidir, actuar y reevaluar.</p><div class="guide-objective-card"><strong>Secuencia de aprendizaje:</strong> acción → reevaluación → decisión → nueva acción.</div></section>
      <section class="guide-section"><h3>11. ¿Cuándo finalizar?</h3><p>Termine cuando se hayan alcanzado los objetivos, el problema principal esté resuelto o exista suficiente material para el debriefing. Prolongar un escenario sin un objetivo adicional puede disminuir su valor educativo.</p></section>
      <section class="guide-section"><h3>12. Debriefing</h3><ol><li><strong>Reacción:</strong> “¿Cómo se sintieron?” “¿Cuál es su impresión de lo ocurrido?”</li><li><strong>Análisis:</strong> explore decisiones y modelos mentales con preguntas abiertas y advocacy-inquiry; analice evaluación, ventilación, reevaluación, comunicación, liderazgo y conciencia situacional.</li><li><strong>Resumen:</strong> cierre con 2–3 mensajes de aprendizaje: “¿Qué se llevan?” “¿Qué harían diferente la próxima vez?”</li></ol><p>Describa observaciones concretas y pregunte qué estaba pensando el participante, en lugar de convertir el debriefing en una clase magistral.</p></section>
      <section class="guide-section"><h3>13. Uso para formación de instructores</h3><p>Puede pedir al candidato que genere un caso, identifique objetivos, prepare equipo, conduzca prebriefing y escenario, observe el desempeño, facilite el debriefing y reciba retroalimentación del mentor. Así se evalúa tanto conocimiento como capacidad de enseñar mediante simulación.</p></section>
      <section class="guide-section"><h3>Regla práctica</h3><div class="guide-flow"><span>ANTES<br>Anticipar · Preparar · Objetivos</span><span>DURANTE<br>Observar · Facilitar · No resolver</span><span>DESPUÉS<br>Reflexionar · Analizar · Consolidar</span></div></section>
      <div class="guide-callout guide-warning"><strong>Uso educativo.</strong> El generador no sustituye el Textbook of Neonatal Resuscitation, 9th Edition, el Instructor Toolkit, los materiales oficiales del NRP ni el juicio clínico. Ante discrepancias, prevalecen las fuentes oficiales vigentes y las políticas del programa.</div>
    </div>
  </article>
</div>
<div class="guide-overlay" id="guideOverlay" aria-hidden="true"></div>
<div class="guide-tip" id="guideTip" role="dialog" aria-live="polite" aria-label="Modo guiado">
  <div class="guide-tip-top"><span class="guide-step-label" id="guideStepLabel"></span><button class="guide-exit" type="button" id="guideExit">Salir</button></div>
  <h3 id="guideStepTitle"></h3><p id="guideStepText"></p>
  <div class="guide-progress"><span id="guideProgress"></span></div>
  <div class="guide-actions"><button class="guide-prev" type="button" id="guidePrev">← Anterior</button><button class="guide-next" type="button" id="guideNext">Siguiente →</button></div>
</div>`;

const steps=[
 {target:'#sexo',title:'Paciente: sexo',text:'Seleccione el sexo del recién nacido. Este dato individualiza la narrativa del caso.'},
 {target:'#ga',title:'Paciente: edad gestacional',text:'Defina las semanas de gestación. Esta variable influye en riesgos, preparación del equipo y complejidad del escenario.'},
 {target:'#fluido',title:'Contexto: líquido amniótico',text:'Seleccione la característica del líquido amniótico. Úsela como información para anticipación y preparación.'},
 {target:'#parto',title:'Contexto: vía de nacimiento',text:'Seleccione la vía de nacimiento y relaciónela con el contexto obstétrico y los recursos que el equipo debería preparar.'},
 {target:'#categoria',title:'Problema: categoría clínica',text:'Elija el grupo clínico que desea trabajar. El propósito es provocar decisiones relevantes, no convertir el caso en una prueba de diagnóstico.'},
 {target:'#problema',title:'Problema específico',text:'Seleccione la condición concreta o utilice la sugerencia automática si desea variabilidad compatible con el contexto.'},
 {target:'#riskbox',title:'Riesgos y antecedentes',text:'Agregue uno o dos factores con propósito educativo. Pregúntese: ¿qué debería anticipar o preparar el equipo al conocer este dato?'},
 {target:'#nivel',title:'Nivel del participante',text:'Ajuste la dificultad al grupo. El escenario debe adaptarse al nivel del alumno, no al contrario.'},
 {target:'#postnatal',title:'Momento del escenario',text:'Active esta opción si el deterioro ocurre fuera del momento inmediato del nacimiento.'},
 {target:'#form',title:'Objetivos antes de generar',text:'Antes de crear el caso defina mentalmente tres cosas: habilidad clínica principal, conducta de equipo a observar y punto central del debriefing.'},
 {target:'.btnrow',title:'Genere el escenario',text:'Presione “Generar escenario”. Después revise completamente el caso antes de utilizarlo con participantes.'},
 {target:'#out',title:'Revise y conduzca',text:'Compruebe coherencia, objetivos, dificultad, recursos y evolución. Durante la simulación entregue datos clínicos; permita que el equipo interprete y decida.'},
 {target:'#out',title:'Cierre con debriefing',text:'Explore reacción, análisis y resumen. Use observaciones concretas y preguntas abiertas; cierre con 2–3 mensajes de aprendizaje aplicables a la práctica.'}
];

let idx=0,active=false,lastFocus=null;
function inject(){
  if($('#guideModal'))return;
  document.body.insertAdjacentHTML('beforeend',guideHTML);
  const form=$('#form');
  if(form){
    const h2=form.querySelector('h2');
    const bar=document.createElement('div');bar.className='guide-toolbar';bar.innerHTML='<button type="button" class="guide-help-btn">❔ ¿Cómo usar este generador?</button><button type="button" class="guide-start-btn">▶ Modo guiado</button><div class="guide-toolbar-note">Ayuda integrada para configurar el caso, preparar la simulación y conducir el debriefing.</div>';
    if(h2)h2.insertAdjacentElement('afterend',bar);else form.prepend(bar);
  }
  const float=document.createElement('button');float.type='button';float.className='guide-float-help';float.textContent='? Ayuda';float.setAttribute('aria-label','Abrir instructivo de uso');document.body.appendChild(float);
  const h1=$('header.app h1')||$('h1');if(h1&&!h1.querySelector('.guide-version'))h1.insertAdjacentHTML('beforeend','<span class="guide-version">V1.1</span>');
  if(!/V1\.1/.test(document.title))document.title=document.title.replace(/\s*V?1\.0\s*/i,' ').trim()+' · V1.1';
  $('.guide-help-btn')?.addEventListener('click',openModal);float.addEventListener('click',openModal);$('.guide-start-btn')?.addEventListener('click',start);
  $('.guide-close')?.addEventListener('click',closeModal);$('#guideModal')?.addEventListener('click',e=>{if(e.target.id==='guideModal')closeModal()});
  $('#guidePrev')?.addEventListener('click',()=>show(idx-1));$('#guideNext')?.addEventListener('click',next);$('#guideExit')?.addEventListener('click',stop);
  document.addEventListener('keydown',keys);
}
function openModal(){lastFocus=document.activeElement;stop();$('#guideModal')?.classList.add('is-open');$('.guide-close')?.focus();document.body.style.overflow='hidden'}
function closeModal(){const m=$('#guideModal');if(!m)return;m.classList.remove('is-open');document.body.style.overflow='';if(lastFocus&&lastFocus.focus)lastFocus.focus()}
function keys(e){if(e.key==='Escape'){if($('#guideModal')?.classList.contains('is-open'))closeModal();else if(active)stop()}if(active&&e.key==='ArrowRight')next();if(active&&e.key==='ArrowLeft')show(idx-1)}
function start(){closeModal();active=true;idx=0;$('#guideOverlay')?.classList.add('is-open');$('#guideTip')?.classList.add('is-open');show(0)}
function cleanHighlight(){document.querySelectorAll('.guide-highlight').forEach(el=>el.classList.remove('guide-highlight'))}
function resolveTarget(step){let t=$(step.target);if((idx>=11)&&(!t||!t.children.length)){t=$('.btnrow')||$('#form')}return t}
function show(n){
  if(!active)return;n=Math.max(0,Math.min(steps.length-1,n));idx=n;cleanHighlight();const s=steps[idx],t=resolveTarget(s);
  $('#guideStepLabel').textContent=`Paso ${idx+1} de ${steps.length}`;$('#guideStepTitle').textContent=s.title;$('#guideStepText').textContent=s.text;$('#guideProgress').style.width=`${((idx+1)/steps.length)*100}%`;
  $('#guidePrev').disabled=idx===0;$('#guideNext').textContent=idx===steps.length-1?'Finalizar ✓':'Siguiente →';
  if(t){t.classList.add('guide-highlight');try{t.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){t.scrollIntoView()}}
  window.setTimeout(()=>placeTip(t),180);
}
function next(){if(idx===steps.length-1){stop();return}if(idx===10){const out=$('#out');if(out&&!out.children.length){const g=window.generar;if(typeof g==='function'){g();window.setTimeout(()=>show(idx+1),250);return}}}show(idx+1)}
function stop(){active=false;cleanHighlight();$('#guideOverlay')?.classList.remove('is-open');$('#guideTip')?.classList.remove('is-open')}
function placeTip(target){const tip=$('#guideTip');if(!tip||!active)return;if(window.matchMedia('(max-width:640px)').matches)return;const tw=tip.offsetWidth||390,th=tip.offsetHeight||230,m=14;let left=(innerWidth-tw)/2,top=Math.max(m,(innerHeight-th)/2);if(target){const r=target.getBoundingClientRect();const roomRight=innerWidth-r.right;const roomLeft=r.left;if(roomRight>tw+30){left=r.right+18;top=Math.min(Math.max(m,r.top),innerHeight-th-m)}else if(roomLeft>tw+30){left=r.left-tw-18;top=Math.min(Math.max(m,r.top),innerHeight-th-m)}else{top=r.bottom+16;if(top+th>innerHeight-m)top=Math.max(m,r.top-th-16)}}tip.style.left=Math.max(m,left)+'px';tip.style.top=Math.max(m,top)+'px'}
window.addEventListener('resize',()=>{if(active)placeTip(resolveTarget(steps[idx]))});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
