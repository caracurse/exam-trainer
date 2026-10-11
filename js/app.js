import { DATA } from './data.js';
import { createQuizController } from './quiz.js';

const state = {
  screen:'home',
  subjectId:null,
  tab:'theory',
  search:'',
  open:{},
  config:{ sections:[], count:10, shuffle:true, immediate:true },
  quiz:null,
  result:null,
  history: []
};

const app = document.getElementById('app');
const crumbEl = document.getElementById('crumb');

/* =====================================================================
   УТИЛИТЫ
   ===================================================================== */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shuffle = a => { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; };
const fmtTime = ms => {
  const s = Math.floor(ms/1000);
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
};
const plural = (n, a, b, c) => {
  const n10 = n%10, n100 = n%100;
  if(n10===1 && n100!==11) return a;
  if(n10>=2 && n10<=4 && (n100<10||n100>=20)) return b;
  return c;
};
const subjQuestions = sid => DATA[sid].sections.reduce((a,s)=>a+s.quiz.length,0);
const subjTheory = sid => DATA[sid].sections.reduce((a,s)=>a+s.theory.length,0);

/* =====================================================================
   РЕНДЕР
   ===================================================================== */
function render(){
  const s = state;
  // применяем акцентный цвет предмета
  if(s.subjectId){
    document.documentElement.style.setProperty('--subj', DATA[s.subjectId].c1);
    document.documentElement.style.setProperty('--subj2', DATA[s.subjectId].c2);
  } else {
    document.documentElement.style.setProperty('--subj', '#2563eb');
    document.documentElement.style.setProperty('--subj2', '#7c3aed');
  }

  if(s.screen==='home'){ app.innerHTML = viewHome(); crumbEl.textContent=''; }
  else if(s.screen==='subject'){ app.innerHTML = viewSubject(); crumbEl.textContent = DATA[s.subjectId].name; }
  else if(s.screen==='quiz'){ app.innerHTML = viewQuiz(); crumbEl.textContent = DATA[s.subjectId].name + ' · тест'; }
  else if(s.screen==='result'){ app.innerHTML = viewResult(); crumbEl.textContent = DATA[s.subjectId].name + ' · итоги'; }
}

/* ---------- ГЛАВНАЯ ---------- */
function viewHome(){
  const totalQ = Object.keys(DATA).reduce((a,k)=>a+subjQuestions(k),0);
  const totalT = Object.keys(DATA).reduce((a,k)=>a+subjTheory(k),0);

  const cards = Object.values(DATA).map(sub=>{
    const nSec = sub.sections.length;
    const nQ = subjQuestions(sub.id);
    const nT = subjTheory(sub.id);
    return `
      <div class="subj-card" data-action="open-subject" data-id="${sub.id}"
           style="--sc:${sub.c1};--sc2:${sub.c2}">
        <div class="subj-ico"><i class="${sub.iconClass || 'bi bi-circle-fill'}"></i></div>
        <h3>${sub.name}</h3>
        <div class="subj-tag">${sub.tag}</div>
        <p>${sub.desc}</p>
        <div class="subj-meta">
          <span class="pill"><span class="meta-icon"><i class="bi bi-book-half"></i></span> ${nT} ${plural(nT,'вопрос','вопроса','вопросов')} теории</span>
          <span class="pill"><span class="meta-icon"><i class="bi bi-check2-circle"></i></span> ${nQ} ${plural(nQ,'задание','задания','заданий')}</span>
          <span class="pill"><span class="meta-icon"><i class="bi bi-collection"></i></span> ${nSec} ${plural(nSec,'раздел','раздела','разделов')}</span>
        </div>
        <div class="subj-go">Начать подготовку</div>
      </div>`;
  }).join('');

  const hist = state.history.slice(0,5);
  const histBlock = hist.length ? `
    <div class="card history">
      <h3><i class="bi bi-graph-up-arrow"></i> Последние попытки</h3>
      ${hist.map(h=>`
        <div class="hist-item">
          <span class="hist-dot" style="background:${DATA[h.subject].c1}"></span>
          <span><b>${DATA[h.subject].name}</b> · ${h.date}</span>
          <span class="hist-score" style="color:${h.pct>=75?'var(--ok)':h.pct>=60?'#c2740a':'var(--bad)'}">
            ${h.correct}/${h.total} · ${h.pct}%
          </span>
        </div>`).join('')}
    </div>` : '';

  return `
    <section class="hero">
      <h1>Готовься к экзамену <span class="grad">осознанно</span></h1>
      <p>Полный курс теории, интерактивные тесты с мгновенной проверкой и подробным разбором каждого ответа. География и биология — в одном тренажёре.</p>
      <div class="stats-row">
        <div class="stat"><b>${totalT}</b><span>теории</span></div>
        <div class="stat"><b>${totalQ}</b><span>заданий</span></div>
        <div class="stat"><b>2</b><span>предмета</span></div>
        <div class="stat"><b>6</b><span>разделов</span></div>
      </div>
    </section>
    <section class="subjects">${cards}</section>
    ${histBlock}
  `;
}

/* ---------- ЭКРАН ПРЕДМЕТА ---------- */
function viewSubject(){
  const sub = DATA[state.subjectId];
  const tabs = `
    <div class="tabs">
      <button class="tab ${state.tab==='theory'?'on':''}" data-action="tab" data-tab="theory"><i class="bi bi-journal-text"></i> Теория</button>
      <button class="tab ${state.tab==='test'?'on':''}" data-action="tab" data-tab="test"><i class="bi bi-bullseye"></i> Тест</button>
    </div>`;
  return `
    <div style="margin-top:20px">
      <button class="btn ghost small" data-action="home">← Все предметы</button>
    </div>
    ${tabs}
    ${state.tab==='theory' ? viewTheory(sub) : viewSetup(sub)}
  `;
}

/* ---------- ТЕОРИЯ ---------- */
function viewTheory(sub){
  const q = state.search.trim().toLowerCase();
  let blocks = '';
  let found = 0;

  sub.sections.forEach((sec, si)=>{
    const items = sec.theory.filter(it =>
      !q || it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)
    );
    if(!items.length) return;
    found += items.length;

    const qa = items.map(it=>{
      const key = sec.id + ':' + sec.theory.indexOf(it);
      const open = !!state.open[key];
      return `
        <div class="qa ${open?'open':''}">
          <div class="qa-q" data-action="toggle-theory" data-key="${key}">
            <span>${esc(it.q)}</span><span class="chev">▼</span>
          </div>
          <div class="qa-a">${it.a}</div>
        </div>`;
    }).join('');

    blocks += `
      <div class="sec-block">
        <div class="sec-head"><span class="sec-num">${si+1}</span><span>${esc(sec.title)}</span></div>
        ${qa}
      </div>`;
  });

  return `
    <input class="search" id="theorySearch" placeholder="Поиск по теории… (например: Мендель, БАМ, изоляция)"
           value="${esc(state.search)}">
    <div class="muted" style="font-size:13px;margin:-8px 0 16px 4px">
      Найдено: <b>${found}</b> ${plural(found,'вопрос','вопроса','вопросов')}
      ${state.search ? ' · <span data-action="clear-search" style="cursor:pointer;text-decoration:underline">сбросить</span>' : ''}
    </div>
    ${blocks || `<div class="card empty"><div class="big"><i class="bi bi-search"></i></div><b>Ничего не найдено</b><p>Попробуйте изменить запрос.</p></div>`}
  `;
}

/* ---------- НАСТРОЙКА ТЕСТА ---------- */
function viewSetup(sub){
  const chips = sub.sections.map(sec=>{
    const on = state.config.sections.includes(sec.id);
    return `<button class="chip ${on?'on':''}" data-action="toggle-section" data-id="${sec.id}">
      ${on?'<i class="bi bi-check-lg"></i> ':''}${esc(sec.short)} <span style="opacity:.6">(${sec.quiz.length})</span>
    </button>`;
  }).join('');

  const avail = sub.sections
    .filter(s=>state.config.sections.includes(s.id))
    .reduce((a,s)=>a+s.quiz.length,0);

  const counts = [5,10,15,20,999];
  const countOpts = counts.map(c=>
    `<option value="${c}" ${state.config.count===c?'selected':''}>${c===999?'Все доступные':c+' вопросов'}</option>`
  ).join('');

  return `
    <div class="card setup">
      <h2>Настройка теста</h2>
      <div class="sub">Выберите разделы, количество заданий и режим проверки. Вопросы выбираются случайно.</div>

      <div class="set-label">Разделы</div>
      <div class="chips">${chips}</div>

      <div class="set-label">Количество вопросов</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:26px">
        <select class="sel" id="countSel">${countOpts}</select>
        <span class="muted" style="font-size:13.5px">Доступно в выбранных разделах: <b>${avail}</b></span>
      </div>

      <div class="set-label">Режим</div>
      <div class="opts-grid">
        <div class="opt-row">
          <label for="swImmediate">Показывать правильный ответ сразу</label>
          <span class="switch"><input type="checkbox" id="swImmediate" ${state.config.immediate?'checked':''}><span class="slider"></span></span>
        </div>
        <div class="opt-row">
          <label for="swShuffle">Перемешивать вопросы</label>
          <span class="switch"><input type="checkbox" id="swShuffle" ${state.config.shuffle?'checked':''}><span class="slider"></span></span>
        </div>
      </div>

      <div class="start-row">
        <button class="btn" data-action="start-quiz" ${avail===0?'disabled':''}><i class="bi bi-play-fill"></i> Начать тест</button>
        <span class="muted" style="font-size:13.5px">
          ${state.config.immediate
            ? 'Режим обучения: после каждого ответа вы увидите разбор.'
            : 'Режим экзамена: разбор будет доступен только в итогах.'}
        </span>
      </div>
    </div>
  `;
}

/* ---------- КВИЗ ---------- */
function viewQuiz(){
  const q = state.quiz;
  const item = q.items[q.idx];
  const answered = item.chosen !== null;
  const reveal = answered && q.immediate;
  const pct = Math.round((q.idx / q.items.length) * 100);

  const letters = ['А','Б','В','Г','Д','Е'];
  const opts = item.o.map((text,i)=>{
    let cls = 'opt';
    if(reveal){
      cls += ' locked';
      if(i === item.c) cls += ' right';
      else if(i === item.chosen) cls += ' wrong';
    } else if(answered && i === item.chosen){
      cls += ' sel';
    }
    return `<button class="${cls}" data-action="choose" data-i="${i}" ${reveal?'disabled':''}>
      <span class="letter">${letters[i]}</span><span>${esc(text)}</span>
    </button>`;
  }).join('');

  let explain = '';
  if(reveal){
    const ok = item.chosen === item.c;
    explain = `<div class="explain ${ok?'ok':'bad'}">
      <b>${ok?'<i class="bi bi-check-circle-fill"></i> Верно':'<i class="bi bi-x-circle-fill"></i> Неверно'}</b>
      ${!ok ? `Правильный ответ: <b>${esc(item.o[item.c])}</b>.<br>` : ''}
      ${esc(item.e)}
    </div>`;
  }

  const isLast = q.idx === q.items.length - 1;

  return `
    <div class="quiz-top">
      <button class="btn ghost small" data-action="abort-quiz"><i class="bi bi-arrow-left"></i> Прервать</button>
      <span class="pill">${esc(item.sectionShort)}</span>
      <span class="pill"><i class="bi bi-stopwatch"></i> <b id="quizTimer">00:00</b></span>
      <span class="pill" style="margin-left:auto">Вопрос ${q.idx+1} из ${q.items.length}</span>
    </div>

    <div class="progress"><i style="width:${pct}%"></i></div>

    <div class="card q-card">
      <div class="q-num">Вопрос ${q.idx+1}</div>
      <h2 class="q-text">${esc(item.q)}</h2>
      <div class="options">${opts}</div>
      ${explain}
    </div>

    <div class="quiz-foot">
      <button class="btn" data-action="next" ${answered?'':'disabled'}>
        ${isLast ? '<i class="bi bi-check2-circle"></i> Завершить тест' : '<i class="bi bi-arrow-right"></i> Далее'}
      </button>
      ${!state.config.immediate ? '<button class="btn ghost" data-action="skip"><i class="bi bi-skip-forward"></i> Пропустить</button>' : ''}
      <span class="hint-keys">
        <kbd>1</kbd>–<kbd>4</kbd> — выбрать · <kbd>Enter</kbd> — далее
      </span>
    </div>
  `;
}

/* ---------- РЕЗУЛЬТАТ ---------- */
function viewResult(){
  const r = state.result;
  const pct = Math.round(r.correct / r.total * 100);
  const C = 2 * Math.PI * 70;
  const off = C * (1 - pct/100);

  let grade, gcls, verdict;
  if(pct >= 90){ grade='5'; gcls='g5'; verdict='Отличный результат! Материал освоен уверенно.'; }
  else if(pct >= 75){ grade='4'; gcls='g4'; verdict='Хороший результат. Осталось закрыть несколько пробелов.'; }
  else if(pct >= 60){ grade='3'; gcls='g3'; verdict='Удовлетворительно. Стоит повторить слабые разделы.'; }
  else { grade='2'; gcls='g2'; verdict='Материал требует серьёзной проработки. Начните с теории.'; }

  // разбивка по разделам
  const bySec = {};
  r.items.forEach(it=>{
    if(!bySec[it.sectionId]) bySec[it.sectionId] = {short: it.sectionShort, total:0, ok:0};
    bySec[it.sectionId].total++;
    if(it.chosen === it.c) bySec[it.sectionId].ok++;
  });

  const bd = Object.values(bySec).map(s=>{
    const p = Math.round(s.ok/s.total*100);
    const col = p>=75 ? 'var(--ok)' : p>=50 ? '#e0a020' : 'var(--bad)';
    return `
      <div class="bd-row">
        <div class="bd-top"><span>${esc(s.short)}</span><span>${s.ok}/${s.total} · ${p}%</span></div>
        <div class="bar"><i style="width:${p}%;background:${col}"></i></div>
      </div>`;
  }).join('');

  const letters = ['А','Б','В','Г','Д','Е'];
  const review = r.items.map((it,i)=>{
    const ok = it.chosen === it.c;
    return `
      <div class="rev-item">
        <div class="rev-q">
          <span class="badge ${ok?'ok':'bad'}">${ok?'<i class="bi bi-check-lg"></i>':'<i class="bi bi-x-lg"></i>'}</span>
          <span>${i+1}. ${esc(it.q)}</span>
        </div>
        ${!ok && it.chosen !== null
          ? `<div class="rev-ans bad"><span class="lbl">Ваш ответ:</span> ${esc(it.o[it.chosen])}</div>` : ''}
        ${it.chosen === null
          ? `<div class="rev-ans bad"><span class="lbl">Ответ не дан</span></div>` : ''}
        <div class="rev-ans good"><span class="lbl">Правильно:</span> ${letters[it.c]}. ${esc(it.o[it.c])}</div>
        <div class="rev-exp"><i class="bi bi-lightbulb"></i> ${esc(it.e)}</div>
      </div>`;
  }).join('');

  const wrongCount = r.items.filter(it=>it.chosen !== it.c).length;

  return `
    <div class="card res-head" style="margin-top:20px">
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 160 160">
          <defs>
            <linearGradient id="gr" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${DATA[state.subjectId].c1}"/>
              <stop offset="100%" stop-color="${DATA[state.subjectId].c2}"/>
            </linearGradient>
          </defs>
          <circle class="bg" cx="80" cy="80" r="70"/>
          <circle class="fg" cx="80" cy="80" r="70"
                  style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/>
        </svg>
        <div class="ring-txt"><div><b>${pct}%</b><span>результат</span></div></div>
      </div>

      <div class="res-info">
        <h2>${esc(DATA[state.subjectId].name)} · итоги</h2>
        <div class="grade ${gcls}">Оценка: ${grade} <span style="font-weight:600;font-size:13px;opacity:.85">${verdict}</span></div>
        <div class="mini-stats">
          <div class="mini"><b>${r.correct}</b><span>верно</span></div>
          <div class="mini"><b>${wrongCount}</b><span>ошибок</span></div>
          <div class="mini"><b>${r.total}</b><span>всего</span></div>
          <div class="mini"><b>${fmtTime(r.duration)}</b><span>время</span></div>
        </div>
      </div>
    </div>

    <div class="card breakdown">
      <h3><i class="bi bi-bar-chart"></i> Анализ по разделам</h3>
      ${bd}
    </div>

    <div class="card review">
      <h3><i class="bi bi-search-heart"></i> Разбор всех заданий</h3>
      ${review}
    </div>

    <div class="actions">
      <button class="btn" data-action="retry"><i class="bi bi-arrow-repeat"></i> Пройти заново</button>
      ${wrongCount>0 ? `<button class="btn ghost" data-action="retry-wrong"><i class="bi bi-bullseye"></i> Проработать ошибки (${wrongCount})</button>` : ''}
      <button class="btn ghost" data-action="to-theory"><i class="bi bi-journal-text"></i> Повторить теорию</button>
      <button class="btn ghost" data-action="home"><i class="bi bi-house-door"></i> На главную</button>
    </div>
  `;
}

const quiz = createQuizController({ state, render, formatTime: fmtTime, shuffle });

/* =====================================================================
   СОБЫТИЯ
   ===================================================================== */
app.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const a = el.dataset.action;

  if(a === 'home'){ state.screen='home'; state.subjectId=null; state.quiz=null; render(); }
  else if(a === 'open-subject'){
    state.subjectId = el.dataset.id;
    state.screen = 'subject';
    state.tab = 'theory';
    state.search = '';
    state.open = {};
    state.config.sections = DATA[state.subjectId].sections.map(s=>s.id);
    state.config.count = 10;
    render();
  }
  else if(a === 'tab'){ state.tab = el.dataset.tab; render(); }
  else if(a === 'toggle-theory'){
    const k = el.dataset.key;
    state.open[k] = !state.open[k];
    render();
  }
  else if(a === 'clear-search'){ state.search=''; render(); }
  else if(a === 'toggle-section'){
    const id = el.dataset.id;
    const arr = state.config.sections;
    const i = arr.indexOf(id);
    if(i > -1) arr.splice(i,1); else arr.push(id);
    render();
  }
  else if(a === 'start-quiz'){
    const pool = quiz.buildPool();
    if(!pool.length) return;
    quiz.startQuiz(pool, state.subjectId, state.config.immediate);
  }
  else if(a === 'choose'){ quiz.chooseOption(+el.dataset.i); }
  else if(a === 'next'){ quiz.nextQuestion(); }
  else if(a === 'skip'){ quiz.nextQuestion(true); }
  else if(a === 'abort-quiz'){
    quiz.stopTimer();
    state.quiz = null;
    state.screen = 'subject';
    state.tab = 'test';
    render();
  }
  else if(a === 'retry'){
    quiz.stopTimer();
    const pool = quiz.buildPool();
    if(pool.length) quiz.startQuiz(pool, state.subjectId, state.config.immediate);
    else { state.screen='subject'; state.tab='test'; render(); }
  }
  else if(a === 'retry-wrong'){
    quiz.stopTimer();
    const wrong = state.result.items.filter(it => it.chosen !== it.c)
      .map(it => ({q:it.q, o:it.o, c:it.c, e:it.e, sectionId:it.sectionId, sectionShort:it.sectionShort}));
    if(wrong.length) quiz.startQuiz(shuffle(wrong), state.subjectId, true);
  }
  else if(a === 'to-theory'){
    state.screen = 'subject';
    state.tab = 'theory';
    render();
  }
});

app.addEventListener('input', e=>{
  if(e.target.id === 'theorySearch'){
    state.search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = document.getElementById('theorySearch');
    if(el){ el.focus(); el.setSelectionRange(pos, pos); }
  }
});

app.addEventListener('change', e=>{
  if(e.target.id === 'countSel'){
    state.config.count = +e.target.value;
  }
  if(e.target.id === 'swImmediate'){
    state.config.immediate = e.target.checked;
    render();
  }
  if(e.target.id === 'swShuffle'){
    state.config.shuffle = e.target.checked;
  }
});

/* ---------- КЛАВИАТУРА ---------- */
document.addEventListener('keydown', e=>{
  if(state.screen !== 'quiz' || !state.quiz) return;
  const q = state.quiz;
  const item = q.items[q.idx];

  if(['1','2','3','4','5','6'].includes(e.key)){
    const i = +e.key - 1;
    if(i < item.o.length) { e.preventDefault(); quiz.chooseOption(i); }
  }
  if(e.key === 'Enter'){
    e.preventDefault();
    if(item.chosen !== null) quiz.nextQuestion();
  }
});

/* ---------- ТЕМА ---------- */
const themeBtn = document.getElementById('themeBtn');
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  themeBtn.innerHTML = t === 'dark' ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
  try { localStorage.setItem('examTrainerTheme', t); } catch(e){}
}
let savedTheme = 'light';
try { savedTheme = localStorage.getItem('examTrainerTheme') || 'light'; } catch(e){}
applyTheme(savedTheme);
themeBtn.addEventListener('click', ()=>{
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

/* ---------- ИСТОРИЯ ---------- */
try {
  const h = localStorage.getItem('examTrainerHistory');
  if(h) state.history = JSON.parse(h);
} catch(e){}

/* ---------- СТАРТ ---------- */
render();
