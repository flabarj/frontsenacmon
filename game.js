/* ========= util DOM ========= */
const $ = sel => document.querySelector(sel);
const el = (tag, cls) => { const n=document.createElement(tag); if(cls) n.className=cls; return n;}
const rnd = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

function logItem(html, type=''){
  const it = el('div','it');
  it.innerHTML = (type?`<span class="tag ${type}">•</span>`:'') + html;
  $('#log').prepend(it);
}
function setMsg(txt){ $('#msg').textContent = txt; }

/* ========= detectar pasta dos assets ========= */
const CANDIDATES = ['src/static/','./src/static/','/src/static/','static/'];
function testImage(url){
  return new Promise(res=>{
    const im = new Image();
    im.onload  = ()=>res(true);
    im.onerror = ()=>res(false);
    im.src = url + (url.includes('?')?'&':'?') + 'cb=' + Date.now();
  });
}
async function detectAssetsBase(anchor='pokeball.png'){
  for (const base of CANDIDATES){
    if (await testImage(base + anchor)) return base;
  }
  return null;
}

/* ========= assets e starters ========= */
let ASSETS = 'src/static/';
let BOARD_IMG, POKEBALL, IMG_WATER, IMG_FIRE, IMG_GRASS;

const STARTERS_ALL = [
  {key:'water',  name:'Água',   img:()=>IMG_WATER,  beats:'fire',  loses:'grass', color:'#67d3ff'},
  {key:'fire',   name:'Fogo',   img:()=>IMG_FIRE,   beats:'grass', loses:'water', color:'#ff9c67'},
  {key:'grass',  name:'Planta', img:()=>IMG_GRASS,  beats:'water', loses:'fire',  color:'#7aff9c'},
];
function pickStarter(){ return STARTERS_ALL[rnd(0, STARTERS_ALL.length-1)]; }

// vantagem elemental
function edge(m, o){
  if(!m || !o) return 0;
  if(m.beats===o.key) return 1;
  if(m.loses===o.key) return -1;
  return 0;
}

/* ========= estado ========= */
const Game = {
  players: [
    { id:'P1', berries:100, pos:0, starter:null, captured:0, elmColor:'#8ea3ff', isCPU:false },
    { id:'P2', berries:100, pos:0, starter:null, captured:0, elmColor:'#ff9fe0', isCPU:false },
  ],
  nPlayers: 2,        // sempre 2 peões no tabuleiro
  turn: 0,
  round: 1,
  roundLimit: 10,
  positionCount: 30,
  path: [],
  zones: {},          // idx -> kind
  battleCtx: null,    // ctx do modal humano
};

/* ========= helpers CPU ========= */
function isCPUEnabled(){ return Game.players[1]?.isCPU === true; }
function isCPUTurn(){ return isCPUEnabled() && Game.turn === 1; }
function autoActIfCPU(){
  if (!isCPUTurn()) return;
  setMsg('CPU está pensando…');
  setTimeout(()=> rollDice(), 700);
}

/* ========= HUD / UI ========= */
function updateHeader(){
  $('#turnPill').textContent = `Vez de ${Game.players[Game.turn].id}.`;
  $('#hudRound').textContent = Game.round;
  $('#hudRoundLim').textContent = Game.roundLimit;
  $('#p1b').textContent = Game.players[0].berries;
  $('#p2b').textContent = Game.players[1].berries;
}

/* ========= trilho ========= */
function buildPath(){
  const board = $('#stage').getBoundingClientRect();
  const pad = 10, x0 = pad, y0 = pad, w = board.width-pad*2, h = board.height-pad*2;
  // 30 pontos: 8/7/8/7 ao redor
  const topN=8, rightN=7, bottomN=8, leftN=7;
  const pts = [];
  for(let i=0;i<topN;i++){ const t = topN>1? i/(topN-1):0; pts.push({x:x0+t*w, y:y0}); }
  for(let i=1;i<=rightN;i++){ const t=i/rightN; pts.push({x:x0+w, y:y0+t*h}); }
  for(let i=1;i<=bottomN;i++){ const t=i/bottomN; pts.push({x:x0+w-t*w, y:y0+h}); }
  for(let i=1;i<=leftN;i++){ const t=i/leftN; pts.push({x:x0, y:y0+h-t*h}); }
  Game.path = pts;

  const dots = $('#pathDots'); dots.innerHTML='';
  pts.forEach(p=>{
    const d = el('div','path-dot'); d.style.left=p.x+'px'; d.style.top=p.y+'px'; dots.appendChild(d);
  });
}

/* ========= zonas ========= */
/* 8 batalha, 2 captura, 6 bonus, 6 perda, 8 neutras = 30 */
function seedZones(){
  const N = Game.positionCount;
  const all = new Array(N).fill('neutral');
  // não queremos usar a casa 0 pra efeito forte — mas manter simples aqui
  const idxs = [...Array(N).keys()];
  // embaralha
  for(let i=idxs.length-1;i>0;i--){ const j=rnd(0,i); [idxs[i],idxs[j]]=[idxs[j],idxs[i]]; }

  function setMany(n, kind){
    for(let i=0;i<n;i++){ all[idxs.pop()] = kind; }
  }
  setMany(8,'battle');
  setMany(2,'capture');
  setMany(6,'bonus');
  setMany(6,'loss');
  // o resto já é neutral
  Game.zones = {};
  for(let i=0;i<N;i++) Game.zones[i]=all[i];
}

/* ========= tokens ========= */
function ensureTokens(){
  document.querySelectorAll('.token').forEach(n=>n.remove());
  for(let i=0;i<2;i++){
    const p = Game.players[i];
    const t = el('div','token '+(i===1?'p2':'p1')); t.id='tok_'+p.id;
    const b = el('div','bubble'); b.style.outline=`3px solid ${p.starter?.color || p.elmColor}`;
    const img = el('img');
    img.src = p.starter?.img() || POKEBALL;
    img.alt = p.starter?.name || 'Pokéball';
    img.onerror = ()=>{ img.src = POKEBALL; };
    const lb = el('div','label'); lb.textContent = p.id + (p.isCPU?' (CPU)':'');
    t.appendChild(b); t.appendChild(img); t.appendChild(lb);
    $('#stage').appendChild(t);
  }
  syncTokenPositions(true);
}
function syncTokenPositions(inPlace=false){
  for(let i=0;i<2;i++){
    const p = Game.players[i], tok = $('#tok_'+p.id), pt = Game.path[p.pos];
    if(!pt || !tok) continue;
    if(inPlace){ tok.style.left=pt.x+'px'; tok.style.top=pt.y+'px'; }
    else{
      tok.style.left=pt.x+'px'; tok.style.top=pt.y+'px';
    }
  }
}

/* ========= dados ========= */
function showDice(a,b){
  const D1 = $('#d1'), D2=$('#d2');
  D1.classList.add('roll'); D2.classList.add('roll');
  D1.textContent='•'; D2.textContent='•';
  setTimeout(()=>{ D1.textContent=a; D2.textContent=b; D1.classList.remove('roll'); D2.classList.remove('roll'); }, 500);
}

/* ========= fluxo da partida ========= */
function startGame(){
  Game.turn = 0; Game.round=1;
  for(const p of Game.players){ p.berries=100; p.pos=0; p.captured=0; }
  seedZones(); ensureTokens(); updateHeader();
  setMsg('Partida iniciada. Clique em Rolar para andar.');
  logItem('Partida iniciada.', 'ok');
  autoActIfCPU();
}
function nextTurn(){
  Game.turn = (Game.turn + 1) % 2;
  if(Game.turn === 0) Game.round++;
  updateHeader();
  autoActIfCPU();
}

/* ========= rolar ========= */
function rollDice(){
  const d1 = rnd(1,6), d2 = rnd(1,6); showDice(d1,d2);
  const P = Game.players[Game.turn];

  if(P.captured>0){
    P.captured--;
    setMsg(`${P.id} está capturado! Passa a vez (${P.captured} restantes).`);
    logItem(`${P.id} perdeu o turno (capturado).`,'warn');
    nextTurn(); return;
  }

  const steps = d1 + d2;
  logItem(`${P.id} rolou ${d1}+${d2} = ${steps}.`);

  // anima “salto a salto”
  let i=0;
  function hop(){
    if(i>=steps){ resolveSquare(P); return; }
    P.pos = (P.pos+1) % Game.positionCount;
    syncTokenPositions(false);
    i++; setTimeout(hop, 120);
  }
  hop();
}

/* ========= resolver casa ========= */
function resolveSquare(P){
  const kind = Game.zones[P.pos] || 'neutral';

  if(kind==='neutral'){
    setMsg('Zona neutra. Nada acontece.'); logItem(`${P.id} caiu em zona neutra.`);
    nextTurn();
  }
  else if(kind==='bonus'){
    P.berries += 10; updateHeader();
    setMsg(`Bônus! ${P.id} ganhou +10 berries.`); logItem(`<b>${P.id}</b> recebeu bônus +10 berries.`, 'ok');
    nextTurn();
  }
  else if(kind==='loss'){
    P.berries = Math.max(0, P.berries - 5); updateHeader();
    setMsg(`Perda! ${P.id} perdeu 5 berries.`); logItem(`<b>${P.id}</b> perdeu 5 berries.`, 'bad');
    checkEndOrNext();
  }
  else if(kind==='capture'){
    P.captured = 2;
    setMsg(`${P.id} foi capturado! 2 turnos sem jogar.`); logItem(`${P.id} CAPTURADO por 2 turnos.`, 'bad');
    nextTurn();
  }
  else if(kind==='battle'){
    if(isCPUTurn()){
      resolveBattleAuto(P);
    }else{
      openBattle(P);
    }
  }
}

/* ========= fim/continuação ========= */
function checkEndOrNext(){
  const P = Game.players[Game.turn];
  if(P.berries<=0){ showWinner(`${P.id} ficou sem berries.`); return; }
  if(Game.round>=Game.roundLimit && Game.turn===1){
    const p1=Game.players[0].berries, p2=Game.players[1].berries;
    if(p1===p2) showWinner(`Empate • ${p1} x ${p2}`);
    else if(p1>p2) showWinner(`P1 venceu • ${p1} x ${p2}`);
    else showWinner(`P2 venceu • ${p2} x ${p1}`);
    return;
  }
  nextTurn();
}

/* ========= overlay vencedor ========= */
function showWinner(sub){
  $('#winnerTitle').textContent = 'VENCEDOR';
  $('#winnerSub').textContent = sub;
  $('#winnerOverlay').classList.add('on');
  logItem('Partida finalizada.', 'warn');
}

/* ========= batalha – CPU ========= */
function resolveBattleAuto(P){
  const opp = pickStarter();
  const me  = P.starter;
  const e   = edge(me, opp);
  const chance = 0.5 + (e===1?0.25:(e===-1?-0.25:0));
  const venceu = Math.random() < chance;

  const fightTxt = `Batalha (CPU): ${P.id} (${me.name}) vs ${opp.name} — ` +
                   (venceu?`<b class="ok">vitória</b>`:`<b class="bad">derrota</b>`) +
                   ` (vantagem: ${e===1?'favorável':e===-1?'desfavorável':'neutra'})`;

  setMsg(fightTxt.replace(/<[^>]*>/g,'')); // sem tags na barra
  logItem(fightTxt, venceu?'ok':'bad');

  checkEndOrNext();
}

/* ========= batalha – HUMANO (modal aposta) ========= */
const battleUI = {
  modal: $('#battleModal'),
  oppTxt: $('#battleOpp'),
  betNo: $('#betNo'), betYes: $('#betYes'),
  mode1: $('#m1'), mode2: $('#m2'),
  numGrid: $('#numGrid'),
  betVal: $('#betVal'), betHint: $('#betHint'),
  multBase: $('#multBase'), multAdj: $('#multAdj'), multEff: $('#multEff'),
  summary: $('#battleSummary'),
  ok: $('#okBattle'),
};
function openBattle(P){
  const opp = pickStarter();
  const me  = P.starter;

  Game.battleCtx = {
    playerIdx: Game.turn,
    me, opp,
    bet: false,
    mode: 1,
    picks: new Set(),
    betValue: 10,
    base: 3.0,
    adj: (()=>{
      const e = edge(me, opp);
      return e===1 ? +0.5 : (e===-1 ? -0.5 : 0.0);
    })(),
  };

  battleUI.oppTxt.textContent = `Oponente: ${opp.name}`;

  // reset UI
  battleUI.betNo.classList.add('active'); battleUI.betYes.classList.remove('active');
  $('#betBox').style.display='none';
  battleUI.mode1.classList.add('active'); battleUI.mode2.classList.remove('active');
  battleUI.numGrid.innerHTML='';
  for(let n=1;n<=9;n++){
    const b = el('div','numBtn'); b.textContent=n;
    b.onclick = ()=>{
      const ctx = Game.battleCtx;
      if(!ctx.bet) return;
      if(b.classList.contains('on')){ b.classList.remove('on'); ctx.picks.delete(n); updateBattleCalc(); return; }
      const limit = ctx.mode===1?1:2;
      if(ctx.picks.size>=limit) return;
      b.classList.add('on'); ctx.picks.add(n); updateBattleCalc();
    };
    battleUI.numGrid.appendChild(b);
  }

  updateBattleCalc();
  updateBattleSummary();
  battleUI.modal.classList.add('on');
}

battleUI.betNo.onclick = ()=>{ Game.battleCtx.bet=false; $('#betBox').style.display='none'; battleUI.betNo.classList.add('active'); battleUI.betYes.classList.remove('active'); updateBattleSummary(); };
battleUI.betYes.onclick = ()=>{ Game.battleCtx.bet=true; $('#betBox').style.display='block'; battleUI.betYes.classList.add('active'); battleUI.betNo.classList.remove('active'); updateBattleSummary(); };
battleUI.mode1.onclick = ()=>{ Game.battleCtx.mode=1; Game.battleCtx.base=3.0; clearPicks(); battleUI.mode1.classList.add('active'); battleUI.mode2.classList.remove('active'); updateBattleCalc(); };
battleUI.mode2.onclick = ()=>{ Game.battleCtx.mode=2; Game.battleCtx.base=1.8; clearPicks(); battleUI.mode2.classList.add('active'); battleUI.mode1.classList.remove('active'); updateBattleCalc(); };
battleUI.betVal.oninput = ()=> updateBattleCalc();

function clearPicks(){
  Game.battleCtx.picks.clear();
  document.querySelectorAll('.numBtn.on').forEach(n=>n.classList.remove('on'));
}
function updateBattleCalc(){
  const ctx = Game.battleCtx;
  const P = Game.players[ctx.playerIdx];
  const minBet = ctx.mode===1? 10 : 20;
  const maxBet = 50;
  let val = parseInt(battleUI.betVal.value||0,10);
  if(Number.isNaN(val)) val = minBet;
  val = Math.max(minBet, Math.min(maxBet, val));
  val = Math.min(val, P.berries);
  ctx.betValue = val;
  battleUI.betVal.value = val;
  battleUI.betHint.textContent = `Mínimo ${minBet} | Máx 50 | Saldo: ${P.berries}`;

  const eff = Math.max(0, (ctx.base + ctx.adj));
  battleUI.multBase.textContent = ctx.base.toFixed(1);
  battleUI.multAdj.textContent  = (ctx.adj>=0? '+' : '') + ctx.adj.toFixed(1);
  battleUI.multEff.textContent  = eff.toFixed(1);

  updateBattleSummary();
}
function updateBattleSummary(){
  const ctx = Game.battleCtx;
  const picks = Array.from(ctx.picks).sort((a,b)=>a-b);
  const txt =
`Você: ${ctx.me.name}
Oponente: ${ctx.opp.name}
Aposta: ${ctx.bet? 'SIM' : 'NÃO'}
${ctx.bet ? `Modo: ${ctx.mode===1?'1 número':'2 números'}
Números: ${picks.length? picks.join(', '): '—'}
Valor: ${ctx.betValue} (base ${ctx.base.toFixed(1)}x, ajuste ${ctx.adj>=0?'+':''}${ctx.adj.toFixed(1)}x, total ${(ctx.base+ctx.adj).toFixed(1)}x)` : ''}`;
  battleUI.summary.textContent = txt;
}
battleUI.ok.onclick = ()=> resolveBattleHuman();

function resolveBattleHuman(){
  const ctx = Game.battleCtx;
  const P = Game.players[ctx.playerIdx];

  if(ctx.bet){
    const expectedPickCount = ctx.mode===1?1:2;
    if(ctx.picks.size !== expectedPickCount){
      alert(`Selecione exatamente ${expectedPickCount} número(s) para apostar.`); return;
    }
    const minBet = ctx.mode===1?10:20;
    if(ctx.betValue < minBet){ alert(`Aposta mínima: ${minBet}.`); return; }
    if(ctx.betValue > 50){ alert(`Aposta máxima por rodada: 50.`); return; }
    if(ctx.betValue > P.berries){ alert(`Saldo insuficiente.`); return; }
  }

  const sorteado = rnd(1,9);
  const picks = Array.from(ctx.picks);
  const apostaAcertou = ctx.bet ? picks.includes(sorteado) : false;

  const e = edge(ctx.me, ctx.opp);
  const chance = 0.5 + (e===1?0.25:(e===-1?-0.25:0));
  const venceu = Math.random() < chance;

  let delta = 0;
  const multEff = Math.max(0, ctx.base + ctx.adj);

  if(ctx.bet){
    if(apostaAcertou){
      delta = Math.floor(ctx.betValue * multEff);
      P.berries += delta;
    }else{
      delta = -ctx.betValue;
      P.berries = Math.max(0, P.berries + delta);
    }
  }
  updateHeader();

  const betTxt = ctx.bet
    ? `Aposta ${ctx.betValue} em ${ctx.mode===1?'1 número':'2 números'} [${picks.join(', ')}], sorteado: <b>${sorteado}</b> → ${apostaAcertou?'<span class="ok">pagou</span>':'<span class="bad">perdeu</span>'} ${delta>0?`(+${delta})`:`(${delta})`} (mult ${(multEff).toFixed(1)}x)`
    : 'Sem aposta (resultado simbólico).';

  const fightTxt = `Batalha: ${Game.players[ctx.playerIdx].id} (${ctx.me.name}) vs ${ctx.opp.name} — ` + (venceu?`<b class="ok">vitória</b>`:`<b class="bad">derrota</b>`) + ` (vantagem: ${e===1?'favorável':e===-1?'desfavorável':'neutra'})`;

  setMsg((fightTxt+' • '+betTxt).replace(/<[^>]*>/g,'')); // msg sem tags
  logItem(fightTxt, venceu?'ok':'bad');
  logItem(betTxt, delta>=0?'ok':'bad');

  $('#battleModal').classList.remove('on');
  checkEndOrNext();
}

/* ========= Setup modal (máquina decide) ========= */
function openSetup(){
  $('#setupModal').classList.add('on');

  // decide 1 ou 2 jogadores
  const umJogador = Math.random() < 0.5;
  Game.players[1].isCPU = umJogador;   // se 1 jogador, P2 é CPU
  // sorteia starters
  Game.players[0].starter = pickStarter();
  Game.players[1].starter = pickStarter();

  // atualiza preview
  $('#stP1').src = Game.players[0].starter.img();
  $('#stP2').src = Game.players[1].starter.img();
  $('#whoP1').textContent = 'P1: ' + Game.players[0].starter.name;
  $('#whoP2').textContent = (umJogador? 'P2 (CPU): ' : 'P2: ') + Game.players[1].starter.name;
}
$('#okSetup').onclick = ()=>{ $('#setupModal').classList.remove('on'); startGame(); };

/* ========= eventos globais ========= */
$('#btnStart').onclick = openSetup;
$('#btnRoll').onclick  = rollDice;
$('#btnRestart').onclick = ()=>{
  $('#winnerOverlay').classList.remove('on');
  openSetup();
};

window.addEventListener('resize', ()=>{ buildPath(); syncTokenPositions(true); });

/* ========= boot ========= */
(async function boot(){
  const found = await detectAssetsBase('pokeball.png');
  if(found) ASSETS = found;
  BOARD_IMG = ASSETS + 'img.png';
  POKEBALL  = ASSETS + 'pokeball.png';
  IMG_WATER = ASSETS + 'starter_water.png';
  IMG_FIRE  = ASSETS + 'starter_fire.png';
  IMG_GRASS = ASSETS + 'starter_grass.png';

  $('#board').style.backgroundImage = `url('${BOARD_IMG}')`;
  $('#board').style.backgroundSize = 'cover';
  buildPath(); ensureTokens(); updateHeader();
  setMsg('Clique em Iniciar para começar. A máquina sorteia 1x2 jogadores e os starters.');
})();
