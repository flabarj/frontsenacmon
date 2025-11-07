/* ========== DETECÇÃO DE ASSETS ========== */
const CANDIDATES = [
  'src/static/', './src/static/', '../src/static/', '../../src/static/',
  '/src/static/', '/static/', 'static/'
];
function testImage(url){
  return new Promise(res=>{
    const im = new Image();
    im.onload  = ()=>res({ok:true, url});
    im.onerror = ()=>res({ok:false, url});
    im.src = url + (url.includes('?')?'&':'?') + 'cb=' + Date.now();
  });
}
async function detectAssetsBase(anchor='pokeball.png'){
  for (const base of CANDIDATES){
    const r = await testImage(base + anchor);
    if (r.ok) return base;
  }
  return null;
}

let ASSETS=null, BOARD_IMG, POKEBALL, IMG_WATER, IMG_FIRE, IMG_GRASS;

/* ========== UTILS/DOM ========== */
const $ = sel => document.querySelector(sel);
const el = (t,c)=>{ const n=document.createElement(t); if(c) n.className=c; return n; };
const rnd = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
function setMsg(t){ $('#msg').textContent = t; }
function logItem(html, type=''){
  const it = el('div','it');
  it.innerHTML = (type?`<span class="tag ${type}">•</span>`:'') + html;
  $('#log').prepend(it);
}
function showDice(a,b){
  const D1=$('#d1'), D2=$('#d2');
  D1.classList.add('roll'); D2.classList.add('roll');
  D1.textContent='•'; D2.textContent='•';
  setTimeout(()=>{ D1.textContent=a; D2.textContent=b; D1.classList.remove('roll'); D2.classList.remove('roll'); }, 500);
}

/* ========== STARTERS (3 elementos) ========== */
let STARTERS = []; // preenchido no boot
function edge(me, opp){
  if(!me || !opp) return 0;
  if(me.beats===opp.key) return 1;
  if(me.loses===opp.key) return -1;
  return 0;
}

/* ========== ESTADO GLOBAL ========== */
const Game = {
  players: [
    { id:'P1', berries:100, pos:0, starter:null, captured:0, elmColor:'#8ea3ff', isCPU:false },
    { id:'P2', berries:100, pos:0, starter:null, captured:0, elmColor:'#ff9fe0', isCPU:true  }, // pode virar CPU
  ],
  nPlayers: 1, // decidido pela máquina
  turn: 0,
  round: 1,
  roundLimit: 10,
  positionCount: 30,
  path: [],
  zones: {},

  // batalha/aposta
  battleCtx: null,
};

function updateHUD(){
  $('#turnPill').textContent = `Vez de ${Game.players[Game.turn].id}.`;
  $('#hudRound').textContent = Game.round;
  $('#hudRoundLim').textContent = Game.roundLimit;
  $('#p1b').textContent = Game.players[0].berries;
  if(Game.nPlayers===2){
    $('#hudP2').style.display='inline-block';
    $('#p2b').textContent = Game.players[1].berries;
  }else{
    $('#hudP2').style.display='none';
  }
}

/* ========== PATH (30 posições) ========== */
function buildPath(){
  const stage = $('#stage').getBoundingClientRect();
  const pad=10, x0=pad, y0=pad, w=stage.width-pad*2, h=stage.height-pad*2;
  const topN=9, rightN=7, bottomN=8, leftN=6; // 9+7+8+6 = 30
  const pts=[];
  for(let i=0;i<topN;i++){ const t= topN>1? i/(topN-1):0; pts.push({x:x0 + t*w, y:y0}); }
  for(let i=1;i<=rightN;i++){ const t=i/rightN; pts.push({x:x0 + w, y:y0 + t*h}); }
  for(let i=1;i<=bottomN;i++){ const t=i/bottomN; pts.push({x:x0 + w - t*w, y:y0 + h}); }
  for(let i=1;i<=leftN;i++){ const t=i/leftN; pts.push({x:x0, y:y0 + h - t*h}); }
  Game.path = pts;

  const dots = $('#pathDots'); dots.innerHTML='';
  pts.forEach(p=>{
    const d = el('div','path-dot'); d.style.left=p.x+'px'; d.style.top=p.y+'px'; dots.appendChild(d);
  });
}

/* ========== ZONAS (aleatórias por contagem) ========== */
function seedZones(){
  const total = Game.positionCount;
  const indices = [...Array(total).keys()];
  indices.sort(()=>Math.random()-0.5);

  const take = n => indices.splice(0,n);

  const Z = Array(total).fill('neutral'); // 8 neutras sobram naturalmente
  take(8).forEach(i=>Z[i]='battle');
  take(2).forEach(i=>Z[i]='capture');
  take(6).forEach(i=>Z[i]='bonus');
  take(6).forEach(i=>Z[i]='loss');

  Game.zones = {};
  for(let i=0;i<total;i++) Game.zones[i]=Z[i];
}

/* ========== TOKENS ========== */
function ensureTokens(){
  document.querySelectorAll('.token').forEach(n=>n.remove());
  for(let i=0;i<Game.nPlayers;i++){
    const p = Game.players[i];
    const t = el('div','token ' + (i===1?'p2':'p1')); t.id='tok_'+p.id;
    const b = el('div','bubble'); b.style.outline=`3px solid ${p.starter?.color || p.elmColor}`;
    const img = el('img'); img.src = p.starter?.img || POKEBALL; img.alt = p.starter?.name || 'Pokéball';
    const lb = el('div','label'); lb.textContent = p.isCPU ? 'CPU' : p.id;
    t.appendChild(b); t.appendChild(img); t.appendChild(lb);
    $('#stage').appendChild(t);
  }
  syncTokenPositions(true);
}
function syncTokenPositions(inPlace=false){
  for(let i=0;i<Game.nPlayers;i++){
    const p = Game.players[i];
    const tok = $('#tok_'+p.id);
    const pt = Game.path[p.pos];
    if(!pt || !tok) continue;
    if(inPlace){ tok.style.left=pt.x+'px'; tok.style.top=pt.y+'px'; }
    else{ tok.style.left=pt.x+'px'; tok.style.top=pt.y+'px'; }
  }
}

/* ========== FLUXO DO JOGO ========== */
function startGame(){
  // máquina decide 1 ou 2 jogadores
  Game.nPlayers = Math.random()<0.5 ? 1 : 2;
  Game.players[1].isCPU = (Game.nPlayers===1);

  // starters aleatórios (sem elétrico)
  Game.players[0].starter = STARTERS[rnd(0, STARTERS.length-1)];
  Game.players[1].starter = STARTERS[rnd(0, STARTERS.length-1)];

  // mostrar no modal de config
  $('#imgP1').src = Game.players[0].starter.img;
  $('#capP1').textContent = Game.players[0].starter.name;
  $('#imgP2').src = Game.players[1].starter.img;
  $('#capP2').textContent = Game.players[1].starter.name;

  Game.turn=0; Game.round=1;
  for(const p of Game.players){ p.berries=100; p.pos=0; p.captured=0; }

  seedZones(); ensureTokens(); updateHUD();
  setMsg(`Partida iniciada com ${Game.nPlayers} jogador(es). Clique em Rolar.`);
  logItem('Partida iniciada.', 'ok');
}
function endOrNext(){
  const last = (Game.turn === Game.nPlayers-1);
  if(last){ Game.round += 1; }
  if(Game.round>Game.roundLimit){
    let msg = `Fim das ${Game.roundLimit} rodadas. `;
    const p1=Game.players[0].berries, p2=Game.players[1].berries;
    if(Game.nPlayers===2){
      msg += (p1===p2? `Empate (${p1} x ${p2}).`
                     : (p1>p2? `P1 venceu (${p1} x ${p2}).` : `${Game.players[1].isCPU?'CPU':'P2'} venceu (${p2} x ${p1}).`));
    }else{
      msg += `Seu saldo: ${p1}.`;
    }
    setMsg(msg); logItem(msg, 'warn');
    return;
  }
  Game.turn = (Game.turn + 1) % Game.nPlayers;
  updateHUD();

  // se for CPU, rola sozinho
  const P = Game.players[Game.turn];
  if(P.isCPU){
    setTimeout(()=> rollDice(), 650);
  }
}

function rollDice(){
  const d1=rnd(1,6), d2=rnd(1,6);
  showDice(d1,d2);

  const P = Game.players[Game.turn];
  if(P.captured>0){
    P.captured -= 1;
    setMsg(`${P.isCPU?'CPU':P.id} está capturado! Passa a vez (${P.captured} restantes).`);
    logItem(`${P.isCPU?'CPU':P.id} perdeu o turno (capturado).`, 'warn');
    endOrNext(); return;
  }

  const steps = d1 + d2;
  logItem(`${P.isCPU?'CPU':P.id} rolou ${d1}+${d2} = ${steps}.`);

  P.pos = (P.pos + steps) % Game.positionCount;
  syncTokenPositions(false);
  resolveSquare(P);
}

function resolveSquare(P){
  const kind = Game.zones[P.pos] || 'neutral';

  if(kind==='neutral'){
    setMsg('Zona neutra. Nada acontece.'); logItem(`${P.isCPU?'CPU':P.id} caiu em zona neutra.`);
    endOrNext(); return;
  }
  if(kind==='bonus'){
    P.berries += 10; updateHUD();
    setMsg(`Bônus! ${P.isCPU?'CPU':P.id} ganhou +10 berries.`); logItem(`<b>${P.isCPU?'CPU':P.id}</b> recebeu bônus +10.`, 'ok');
    endOrNext(); return;
  }
  if(kind==='loss'){
    P.berries = Math.max(0, P.berries - 5); updateHUD();
    setMsg(`Perda! ${P.isCPU?'CPU':P.id} perdeu 5 berries.`); logItem(`<b>${P.isCPU?'CPU':P.id}</b> perdeu 5.`, 'bad');
    endOrNext(); return;
  }
  if(kind==='capture'){
    P.captured = 2;
    setMsg(`${P.isCPU?'CPU':P.id} foi capturado (Equipe Rocket) por 2 turnos.`);
    logItem(`${P.isCPU?'CPU':P.id} CAPTURADO por 2 turnos.`, 'bad');
    endOrNext(); return;
  }
  if(kind==='battle'){
    openBattle(P);
  }
}

/* ========== UI BATALHA/APOSTA ========== */
const BUI = {
  modal: $('#battle'),
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
  const opp = STARTERS[rnd(0, STARTERS.length-1)];
  const me  = P.starter;

  Game.battleCtx = {
    playerIdx: Game.turn,
    me, opp,
    bet: false,
    mode: 1,
    picks: new Set(),
    betValue: 10,
    base: 3.0,
    adj: 0.0,
  };
  Game.battleCtx.adj = (edge(me, opp)===1? +0.5 : edge(me, opp)===-1? -0.5 : 0.0);

  BUI.oppTxt.textContent = `Oponente: ${opp.name}`;
  BUI.betNo.classList.add('active'); BUI.betYes.classList.remove('active');
  $('#betBox').style.display='none';
  BUI.mode1.classList.add('active'); BUI.mode2.classList.remove('active');

  BUI.numGrid.innerHTML='';
  for(let n=1;n<=9;n++){
    const b = el('div','numBtn'); b.textContent=n;
    b.onclick = ()=>{
      const ctx = Game.battleCtx;
      if(!ctx.bet) return;
      if(b.classList.contains('on')){ b.classList.remove('on'); ctx.picks.delete(n); updateBattleCalc(); return; }
      const lim = ctx.mode===1? 1 : 2;
      if(ctx.picks.size >= lim) return;
      b.classList.add('on'); ctx.picks.add(n); updateBattleCalc();
    };
    BUI.numGrid.appendChild(b);
  }

  BUI.betVal.value = 10;
  updateBattleCalc();
  updateBattleSummary();

  // abre modal
  BUI.modal.classList.add('on');
}

BUI.betNo.onclick = ()=>{ Game.battleCtx.bet=false; $('#betBox').style.display='none'; BUI.betNo.classList.add('active'); BUI.betYes.classList.remove('active'); updateBattleSummary(); };
BUI.betYes.onclick = ()=>{ Game.battleCtx.bet=true; $('#betBox').style.display='block'; BUI.betYes.classList.add('active'); BUI.betNo.classList.remove('active'); updateBattleSummary(); };
BUI.mode1.onclick = ()=>{ Game.battleCtx.mode=1; Game.battleCtx.base=3.0; clearPicks(); BUI.mode1.classList.add('active'); BUI.mode2.classList.remove('active'); updateBattleCalc(); };
BUI.mode2.onclick = ()=>{ Game.battleCtx.mode=2; Game.battleCtx.base=1.8; clearPicks(); BUI.mode2.classList.add('active'); BUI.mode1.classList.remove('active'); updateBattleCalc(); };
BUI.betVal.oninput = ()=> updateBattleCalc();
BUI.ok.onclick = ()=> resolveBattle();

function clearPicks(){
  Game.battleCtx.picks.clear();
  document.querySelectorAll('.numBtn.on').forEach(n=>n.classList.remove('on'));
}
function updateBattleCalc(){
  const ctx = Game.battleCtx;
  const P = Game.players[ctx.playerIdx];
  const minBet = ctx.mode===1? 10 : 20;
  const maxBet = 50;
  let val = parseInt(BUI.betVal.value||0,10);
  if(Number.isNaN(val)) val = minBet;
  if(val < minBet) val = minBet;
  if(val > maxBet) val = maxBet;
  if(val > P.berries) val = P.berries;
  ctx.betValue = val;
  BUI.betVal.value = val;
  BUI.betHint.textContent = `Mínimo ${minBet} | Máx 50 | Saldo: ${P.berries}`;

  const eff = Math.max(0, (ctx.base + ctx.adj));
  BUI.multBase.textContent = ctx.base.toFixed(1);
  BUI.multAdj.textContent  = (ctx.adj>=0?'+':'') + ctx.adj.toFixed(1);
  BUI.multEff.textContent  = eff.toFixed(1);

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
  BUI.summary.textContent = txt;
}

function resolveBattle(){
  const ctx = Game.battleCtx;
  const P = Game.players[ctx.playerIdx];

  if(ctx.bet){
    const expected = ctx.mode===1?1:2;
    if(ctx.picks.size !== expected){ alert(`Selecione exatamente ${expected} número(s).`); return; }
    const minBet = ctx.mode===1?10:20;
    if(ctx.betValue < minBet){ alert(`Aposta mínima: ${minBet}.`); return; }
    if(ctx.betValue > 50){ alert(`Aposta máxima: 50.`); return; }
    if(ctx.betValue > P.berries){ alert(`Saldo insuficiente.`); return; }
  }

  const sorteado = rnd(1,9);
  const e = edge(ctx.me, ctx.opp);
  const chance = 0.5 + (e===1?0.25:(e===-1?-0.25:0));
  const venceu = Math.random() < chance;

  let delta = 0;
  const multEff = Math.max(0, ctx.base + ctx.adj);

  if(ctx.bet){
    const hit = Array.from(ctx.picks).includes(sorteado);
    if(hit){
      delta = Math.floor(ctx.betValue * multEff);
      P.berries += delta;
    }else{
      delta = -ctx.betValue;
      P.berries = Math.max(0, P.berries + delta);
    }
    const betTxt = `Aposta ${ctx.betValue} em ${ctx.mode===1?'1 número':'2 números'} [${Array.from(ctx.picks).join(', ')}], sorteado: <b>${sorteado}</b> → ${delta>=0?'<span class="ok">pagou</span>':'<span class="bad">perdeu</span>'} ${delta>=0?`(+${delta})`:`(${delta})`} (mult ${multEff.toFixed(1)}x)`;
    logItem(betTxt, delta>=0?'ok':'bad');
  }

  updateHUD();

  const tag = venceu?'ok':'bad';
  const who = P.isCPU ? 'CPU' : P.id;
  const fightTxt = `Batalha: ${who} (${ctx.me.name}) vs ${ctx.opp.name} — ` + (venceu?`<b class="ok">vitória</b>`:`<b class="bad">derrota</b>`) + ` (vantagem: ${e===1?'favorável':e===-1?'desfavorável':'neutra'})`;
  setMsg(fightTxt.replace(/<[^>]*>/g,'')); logItem(fightTxt, tag);

  // overlay de vencedor
  const overlay = $('#winnerOverlay');
  overlay.dataset.label = `VENCEDOR: ${venceu ? who : 'Oponente'}`;
  overlay.classList.remove('hidden');
  setTimeout(()=> overlay.classList.add('hidden'), 1200);

  // fecha modal e segue
  $('#battle').classList.remove('on');
  endOrNext();
}

/* ========== CFG MODAL ========== */
$('#okCfg').onclick = ()=>{
  $('#cfg').classList.remove('on');
  startGame();
  // se CPU for o primeiro, ele joga
  if(Game.players[Game.turn].isCPU) setTimeout(()=> rollDice(), 600);
};

/* ========== BOTÕES PRINCIPAIS ========== */
$('#btnStart').onclick = ()=> $('#cfg').classList.add('on');
$('#btnRoll').onclick  = ()=> rollDice();

/* ========== BOOT ========== */
async function boot(){
  ASSETS = await detectAssetsBase('pokeball.png');
  if(!ASSETS){
    const warn = document.createElement('div');
    warn.style = "position:fixed;left:12px;bottom:12px;background:#ff6b6b;color:#111;padding:10px 14px;border-radius:10px;font-weight:900;z-index:9999";
    warn.textContent = "Não encontrei a pasta de imagens (src/static).";
    document.body.appendChild(warn);
    return;
  }
  BOARD_IMG = ASSETS + 'img.png';
  POKEBALL  = ASSETS + 'pokeball.png';
  IMG_WATER = ASSETS + 'starter_water.png';
  IMG_FIRE  = ASSETS + 'starter_fire.png';
  IMG_GRASS = ASSETS + 'starter_grass.png';

  STARTERS = [
    {key:'water',  name:'Água',   img:IMG_WATER,  beats:'fire',  loses:'grass', color:'#67d3ff'},
    {key:'fire',   name:'Fogo',   img:IMG_FIRE,   beats:'grass', loses:'water', color:'#ff9c67'},
    {key:'grass',  name:'Planta', img:IMG_GRASS,  beats:'water', loses:'fire',  color:'#7aff9c'},
  ];

  const board = $('#board');
  board.style.backgroundImage = `url('${BOARD_IMG}')`;
  board.style.backgroundSize  = 'cover';

  buildPath();
  ensureTokens();
  setMsg('Clique em “Iniciar” para sortear modo e starters.');
  updateHUD();
}
window.addEventListener('resize', ()=>{ buildPath(); syncTokenPositions(true); });
window.addEventListener('DOMContentLoaded', boot);
