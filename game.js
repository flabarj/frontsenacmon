// ===== Caminhos (GitHub Pages) =====
const ASSETS   = "src/static/";
const BOARD_IMG= ASSETS + "img.png";
const POKEBALL = ASSETS + "pokeball.png";
const IMG_WATER= ASSETS + "starter_water.png";
const IMG_FIRE = ASSETS + "starter_fire.png";
const IMG_GRASS= ASSETS + "starter_grass.png";

// ===== Starters (só 3) =====
const STARTERS = [
  { key:"water",  name:"Água",   img:IMG_WATER,  beats:"fire",  loses:"grass", color:"#67d3ff" },
  { key:"fire",   name:"Fogo",   img:IMG_FIRE,   beats:"grass", loses:"water", color:"#ff9c67" },
  { key:"grass",  name:"Planta", img:IMG_GRASS,  beats:"water", loses:"fire",  color:"#7aff9c" },
];

// ===== Helpers =====
const $  = s => document.querySelector(s);
const el = (t,c)=>{ const n=document.createElement(t); if(c) n.className=c; return n; };
const rnd=(a,b)=> Math.floor(Math.random()*(b-a+1))+a;
function setMsg(t){ $("#msg").textContent=t; }
function logItem(html,type=''){ const it=el('div','it'); it.innerHTML=(type?`<span class="tag ${type}">•</span>`:'')+html; $("#log").prepend(it); }
function showDice(a,b){ const D1=$("#d1"),D2=$("#d2"); D1.classList.add("roll");D2.classList.add("roll"); D1.textContent='•';D2.textContent='•'; setTimeout(()=>{D1.textContent=a;D2.textContent=b;D1.classList.remove("roll");D2.classList.remove("roll");},500); }

// ===== Estado =====
const Game = {
  players:[
    { id:'P1', berries:100, pos:0, starter:null, captured:0, elmColor:'#8ea3ff', isCPU:false },
    { id:'P2', berries:100, pos:0, starter:null, captured:0, elmColor:'#ff9fe0', isCPU:true  },
  ],
  nPlayers:1,
  turn:0,
  round:1,
  roundLimit:10,
  positionCount:30,
  path:[],
  zones:{},
  // contexto da batalha/aposta
  battle:null
};
const isCPUTurn = ()=> Game.nPlayers===2 && Game.players[Game.turn].isCPU;

// ===== HUD =====
function updateHUD(){
  const who=Game.players[Game.turn];
  $("#turnPill").textContent = `Vez de ${who.id}${who.isCPU?' (CPU)':''}.`;
  $("#hudRound").textContent = Game.round;
  $("#hudRoundLim").textContent = Game.roundLimit;
  $("#p1b").textContent = Game.players[0].berries;
  if(Game.nPlayers===2){
    $("#hudP2").style.display='inline-block';
    $("#p2b").textContent = Game.players[1].berries;
  } else {
    $("#hudP2").style.display='none';
  }
  $("#btnRoll").disabled = isCPUTurn();
}

// ===== Tabuleiro (30 posições: 9+7+8+6) =====
function buildPath(){
  const r=$("#stage").getBoundingClientRect();
  const pad=10, x0=pad, y0=pad, w=r.width-2*pad, h=r.height-2*pad;
  const topN=9, rightN=7, bottomN=8, leftN=6;
  const pts=[];
  for(let i=0;i<topN;i++){ const t=topN>1? i/(topN-1):0; pts.push({x:x0+t*w, y:y0}); }
  for(let i=1;i<=rightN;i++){ const t=i/rightN; pts.push({x:x0+w, y:y0+t*h}); }
  for(let i=1;i<=bottomN;i++){ const t=i/bottomN; pts.push({x:x0+w-t*w, y:y0+h}); }
  for(let i=1;i<=leftN;i++){ const t=i/leftN; pts.push({x:x0, y:y0+h-t*h}); }
  Game.path=pts;

  const dots=$("#pathDots"); dots.innerHTML='';
  pts.forEach(p=>{ const d=el('div','path-dot'); d.style.left=p.x+'px'; d.style.top=p.y+'px'; dots.appendChild(d); });
}

// ===== Zonas (aleatórias com contagem fixa) =====
function seedZones(){
  const total=Game.positionCount;
  const Z=new Array(total).fill('neutral');
  const idx=[...Array(total).keys()].sort(()=>Math.random()-0.5);
  const take=n=> idx.splice(0,n);
  take(8).forEach(i=>Z[i]='battle');
  take(2).forEach(i=>Z[i]='capture');
  take(6).forEach(i=>Z[i]='bonus');
  take(6).forEach(i=>Z[i]='loss');
  Game.zones = Object.fromEntries(Z.map((v,i)=>[i,v]));
}

// ===== Peões =====
function ensureTokens(){
  document.querySelectorAll('.token').forEach(n=>n.remove());
  for(let i=0;i<Game.nPlayers;i++){
    const p=Game.players[i];
    const t=el('div','token '+(i===1?'p2':'p1')); t.id='tok_'+p.id;
    const b=el('div','bubble'); b.style.outline=`3px solid ${p.starter?.color||p.elmColor}`;
    const img=el('img'); img.src=p.starter?.img||POKEBALL; img.alt=p.starter?.name||'Pokéball';
    const lb=el('div','label'); lb.textContent=p.id+(p.isCPU?' 🤖':'');
    t.appendChild(b); t.appendChild(img); t.appendChild(lb);
    $("#stage").appendChild(t);
  }
  syncTokens(true);
}
function syncTokens(){
  for(let i=0;i<Game.nPlayers;i++){
    const p=Game.players[i], tok=$("#tok_"+p.id), pt=Game.path[p.pos];
    if(tok&&pt){ tok.style.left=pt.x+'px'; tok.style.top=pt.y+'px'; }
  }
}

// ===== Regras =====
function startGame(){
  // sorteia 1x2 jogadores
  Game.nPlayers = Math.random()<0.5 ? 1 : 2;
  Game.players[0].isCPU=false;
  Game.players[1].isCPU=(Game.nPlayers===2);

  // starters aleatórios
  for(let i=0;i<Game.nPlayers;i++){
    Game.players[i].starter = STARTERS[rnd(0, STARTERS.length-1)];
  }

  Game.turn=0; Game.round=1;
  Game.players.forEach(p=>{ p.berries=100; p.pos=0; p.captured=0; });

  const board=$("#board");
  board.style.backgroundImage=`url('${BOARD_IMG}')`;
  board.style.backgroundSize="cover";

  buildPath(); seedZones(); ensureTokens(); updateHUD();
  setMsg(`Partida iniciada com ${Game.nPlayers} jogador(es). Clique em Rolar.`);
  logItem("Partida iniciada.","ok");

  if(isCPUTurn()){ setMsg("Vez da máquina…"); setTimeout(rollDice,700); }
}

function nextTurn(){
  Game.turn = (Game.turn+1) % Game.nPlayers;
  if(Game.turn===0) Game.round++;
  updateHUD();
  if(isCPUTurn()){ setMsg("Vez da máquina…"); setTimeout(rollDice,700); }
  else setMsg("Sua vez! Clique em Rolar.");
}

function endWithOverlay(text){
  $("#winnerText").textContent = text;
  $("#winnerOverlay").classList.add("on");
}

function endOrNext(){
  if(Game.round>=Game.roundLimit && Game.turn===(Game.nPlayers-1)){
    const p1=Game.players[0].berries;
    if(Game.nPlayers===2){
      const p2=Game.players[1].berries;
      const winner = p1===p2 ? "EMPATE" : (p1>p2 ? "P1" : "P2");
      const score  = `${p1} x ${p2}`;
      logItem(`Fim: ${winner} (${score})`, "warn");
      endWithOverlay(`VENCEDOR: ${winner} • Placar ${score}`);
    }else{
      logItem(`Fim: saldo P1 = ${p1}`,"warn");
      endWithOverlay(`VENCEDOR: P1 • Saldo ${p1}`);
    }
    return;
  }
  nextTurn();
}

function elementalEdge(me,opp){
  if(!me||!opp) return 0;
  if(me.beats===opp.key) return 1;
  if(me.loses===opp.key) return -1;
  return 0;
}

function rollDice(){
  if(isCPUTurn()) $("#btnRoll").disabled = true;

  const d1=rnd(1,6), d2=rnd(1,6); showDice(d1,d2);
  const P = Game.players[Game.turn];

  if(P.captured>0){
    P.captured--; setMsg(`${P.id} está capturado! Passa a vez (${P.captured} restantes).`);
    logItem(`${P.id} perdeu o turno (capturado).`,"warn"); nextTurn(); return;
  }

  P.pos = (P.pos + d1 + d2) % Game.positionCount;
  syncTokens();
  logItem(`${P.id} rolou ${d1}+${d2} = ${d1+d2}.`);
  resolveSquare(P);
}

function resolveSquare(P){
  const kind = Game.zones[P.pos] || 'neutral';

  if(kind==='neutral'){
    setMsg('Zona neutra. Nada acontece.'); logItem(`${P.id} caiu em zona neutra.`); endOrNext();
  } else if(kind==='bonus'){
    P.berries += 10; updateHUD();
    setMsg(`Bônus! ${P.id} ganhou +10 berries.`); logItem(`<b>${P.id}</b> recebeu +10 berries.`,'ok'); endOrNext();
  } else if(kind==='loss'){
    P.berries = Math.max(0, P.berries - 5); updateHUD();
    setMsg(`Perda! ${P.id} perdeu 5 berries.`); logItem(`<b>${P.id}</b> perdeu 5 berries.`,'bad'); endOrNext();
  } else if(kind==='capture'){
    P.captured = 2;
    setMsg(`${P.id} foi capturado pela Equipe Rocket! 2 turnos sem jogar.`);
    logItem(`${P.id} CAPTURADO por 2 turnos.`,'bad'); endOrNext();
  } else if(kind==='battle'){
    openBattle(P);
  }
}

// ====== BATALHA + APOSTA ======
const BUI = {
  modal: $("#battleModal"),
  oppTxt: $("#battleOpp"),
  betNo: $("#betNo"), betYes: $("#betYes"),
  mode1: $("#mode1"), mode2: $("#mode2"),
  numGrid: $("#numGrid"),
  betVal: $("#betVal"), betHint: $("#betHint"),
  multBase: $("#multBase"), multAdj: $("#multAdj"), multEff: $("#multEff"),
  summary: $("#battleSummary"),
  ok: $("#okBattle"),
};

function openBattle(P){
  const opp = STARTERS[rnd(0, STARTERS.length-1)];
  const me  = P.starter;
  const adj = (()=>{
    const e = elementalEdge(me,opp);
    return e===1? +0.5 : e===-1? -0.5 : 0.0;
  })();

  Game.battle = {
    playerIdx: Game.turn,
    me, opp,
    bet:false,
    mode:1, // 1 número
    picks:new Set(),
    betValue:10,
    base:3.0,
    adj
  };

  BUI.oppTxt.textContent = `Oponente: ${opp.name}`;
  // UI defaults
  BUI.betNo.classList.add('active'); BUI.betYes.classList.remove('active');
  $("#betBox").style.display='none';
  BUI.mode1.classList.add('active'); BUI.mode2.classList.remove('active');

  // grid 1..9
  BUI.numGrid.innerHTML='';
  for(let n=1;n<=9;n++){
    const b=el('div','numBtn'); b.textContent=n;
    b.onclick=()=>{
      if(!Game.battle.bet) return;
      const ctx=Game.battle;
      if(b.classList.contains('on')){ b.classList.remove('on'); ctx.picks.delete(n); updateBattleCalc(); return; }
      const limit = ctx.mode===1?1:2;
      if(ctx.picks.size>=limit) return;
      b.classList.add('on'); ctx.picks.add(n); updateBattleCalc();
    };
    BUI.numGrid.appendChild(b);
  }

  updateBattleCalc(); updateBattleSummary();
  BUI.modal.classList.add('on');
}

function clearPicks(){ Game.battle.picks.clear(); document.querySelectorAll('.numBtn.on').forEach(n=>n.classList.remove('on')); }
BUI.betNo.onclick = ()=>{ Game.battle.bet=false; $("#betBox").style.display='none'; BUI.betNo.classList.add('active'); BUI.betYes.classList.remove('active'); updateBattleSummary(); };
BUI.betYes.onclick = ()=>{ Game.battle.bet=true;  $("#betBox").style.display='block'; BUI.betYes.classList.add('active'); BUI.betNo.classList.remove('active'); updateBattleSummary(); };
BUI.mode1.onclick = ()=>{ Game.battle.mode=1; Game.battle.base=3.0; clearPicks(); BUI.mode1.classList.add('active'); BUI.mode2.classList.remove('active'); updateBattleCalc(); };
BUI.mode2.onclick = ()=>{ Game.battle.mode=2; Game.battle.base=1.8; clearPicks(); BUI.mode2.classList.add('active'); BUI.mode1.classList.remove('active'); updateBattleCalc(); };
BUI.betVal.oninput = ()=> updateBattleCalc();
BUI.ok.onclick = ()=> resolveBattle();

function updateBattleCalc(){
  const ctx=Game.battle, P=Game.players[ctx.playerIdx];
  const min = ctx.mode===1 ? 10 : 20;
  let val = parseInt(BUI.betVal.value||0,10);
  if(Number.isNaN(val)) val=min;
  val = Math.max(min, Math.min(50, val));
  val = Math.min(val, P.berries);
  ctx.betValue=val; BUI.betVal.value=val;
  BUI.betHint.textContent = `Mínimo ${min} | Máx 50 | Saldo: ${P.berries}`;

  const eff = Math.max(0, ctx.base + ctx.adj);
  BUI.multBase.textContent = ctx.base.toFixed(1);
  BUI.multAdj.textContent  = (ctx.adj>=0?'+':'') + ctx.adj.toFixed(1);
  BUI.multEff.textContent  = eff.toFixed(1);

  updateBattleSummary();
}
function updateBattleSummary(){
  const c=Game.battle, picks=[...c.picks].sort((a,b)=>a-b);
  const txt =
`Você: ${c.me.name}
Oponente: ${c.opp.name}
Aposta: ${c.bet? 'SIM':'NÃO'}
${c.bet ? `Modo: ${c.mode===1?'1 número':'2 números'}
Números: ${picks.length? picks.join(', '): '—'}
Valor: ${c.betValue} (base ${c.base.toFixed(1)}x, ajuste ${c.adj>=0?'+':''}${c.adj.toFixed(1)}x, total ${(c.base+c.adj).toFixed(1)}x)` : ''}`;
  BUI.summary.textContent = txt;
}

function resolveBattle(){
  const c=Game.battle, P=Game.players[c.playerIdx];
  if(c.bet){
    const need = c.mode===1?1:2;
    if(c.picks.size!==need){ alert(`Selecione exatamente ${need} número(s).`); return; }
    if(c.betValue< (c.mode===1?10:20)){ alert("Aposta abaixo do mínimo."); return; }
    if(c.betValue>50){ alert("Aposta acima do máximo."); return; }
    if(c.betValue>P.berries){ alert("Saldo insuficiente."); return; }
  }

  const sorteado = rnd(1,9);
  const e = elementalEdge(c.me, c.opp);
  const chance = 0.5 + (e===1?0.25:(e===-1?-0.25:0));
  const venceu = Math.random() < chance;

  // resultado da aposta
  let delta = 0;
  if(c.bet){
    const hit = c.picks.has(sorteado);
    const mult = Math.max(0, c.base + c.adj);
    delta = hit ? Math.floor(c.betValue*mult) : -c.betValue;
    P.berries = Math.max(0, P.berries + delta);
    updateHUD();
    const betTxt = `Aposta ${c.betValue} em ${c.mode===1?'1 número':'2 números'} [${[...c.picks].join(', ')}], sorteado: <b>${sorteado}</b> → ${delta>=0?'<span class="ok">ganhou</span>':'<span class="bad">perdeu</span>'} (${delta>=0?'+':''}${delta})`;
    logItem(betTxt, delta>=0?'ok':'bad');
  }

  const fightTxt = `Batalha: ${P.id} (${c.me.name}) vs ${c.opp.name} — ` + (venceu?`<b class="ok">vitória</b>`:`<b class="bad">derrota</b>`) + ` (vantagem: ${e===1?'favorável':e===-1?'desfavorável':'neutra'})`;
  setMsg(fightTxt.replace(/<[^>]*>/g,'')); // sem tags na barra de msg
  logItem(fightTxt, venceu?'ok':'bad');

  $("#battleModal").classList.remove("on");
  endOrNext();
}

// ===== Init =====
function init(){
  $("#board").style.backgroundImage=`url('${BOARD_IMG}')`;
  $("#board").style.backgroundSize="cover";
  buildPath(); updateHUD();
  setMsg("Clique em Iniciar para começar (máquina decide 1 ou 2 jogadores; starters aleatórios).");

  $("#btnStart").addEventListener('click', startGame);
  $("#btnRoll").addEventListener('click', ()=>{ if(!isCPUTurn()) rollDice(); });
  window.addEventListener('resize', ()=>{ buildPath(); syncTokens(); });

  // overlay vencedor
  $("#okWinner").addEventListener('click', ()=> $("#winnerOverlay").classList.remove("on"));
}
document.addEventListener('DOMContentLoaded', init);
