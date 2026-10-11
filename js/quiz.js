import { DATA } from './data.js';

export function createQuizController({ state, render, formatTime, shuffle }) {
  let timerId = null;

  function stopTimer(){
    clearInterval(timerId);
    timerId = null;
  }

  function startTimer(){
    stopTimer();
    timerId = setInterval(()=>{
      const el = document.getElementById('quizTimer');
      if(!el || !state.quiz) return;
      el.textContent = formatTime(Date.now() - state.quiz.startTime);
    }, 1000);
  }

  function startQuiz(items, subjectId, immediate){
    state.subjectId = subjectId;
    state.quiz = {
      items: items.map(it => ({...it, chosen:null})),
      idx: 0,
      startTime: Date.now(),
      immediate: immediate
    };
    state.screen = 'quiz';
    render();
    startTimer();
  }

  function buildPool(){
    const subject = DATA[state.subjectId];
    let pool = [];
    subject.sections.forEach(section=>{
      if(!state.config.sections.includes(section.id)) return;
      section.quiz.forEach(question=>{
        pool.push({...question, sectionId: section.id, sectionShort: section.short});
      });
    });
    if(state.config.shuffle) pool = shuffle(pool);
    if(state.config.count !== 999) pool = pool.slice(0, state.config.count);
    return pool;
  }

  function chooseOption(index){
    const question = state.quiz;
    const item = question.items[question.idx];
    if(item.chosen !== null && question.immediate) return;
    item.chosen = index;
    render();
  }

  function nextQuestion(forceSkip = false){
    const question = state.quiz;
    const item = question.items[question.idx];
    if(!forceSkip && item.chosen === null) return;
    if(question.idx < question.items.length - 1){
      question.idx++;
      render();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz(){
    stopTimer();
    const question = state.quiz;
    const duration = Date.now() - question.startTime;
    const correct = question.items.filter(item => item.chosen === item.c).length;
    state.result = {
      items: question.items,
      correct,
      total: question.items.length,
      duration
    };

    const now = new Date();
    state.history.unshift({
      subject: state.subjectId,
      correct,
      total: question.items.length,
      pct: Math.round(correct / question.items.length * 100),
      date: now.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) + ' ' +
            now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})
    });
    state.history = state.history.slice(0, 20);
    try { localStorage.setItem('examTrainerHistory', JSON.stringify(state.history)); } catch(e){}

    state.screen = 'result';
    render();
  }

  return { startQuiz, buildPool, chooseOption, nextQuestion, stopTimer };
}