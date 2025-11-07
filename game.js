// ===== Caminhos dos assets (mantém suas imagens em src/static/) =====
const ASSETS = "src/static/";
const BOARD_IMG = ASSETS + "img.png";
const POKEBALL  = ASSETS + "pokeball.png";
const IMG_WATER = ASSETS + "starter_water.png";
const IMG_FIRE  = ASSETS + "starter_fire.png";
const IMG_GRASS = ASSETS + "starter_grass.png";

// ===== Starters (sem elétrico) =====
const STARTERS = [
  { key:"water",  name:"Água",   img:IMG_WATER,  beats:"fire",  loses:"grass", color:"#67d3ff" },
  { key:"fire",   name:"Fogo",   img:IMG_FIRE,   beats:"grass", loses:"water", color:"#ff9c67" },
  { key:"grass",  name:"Planta", img:IMG_GRASS,  beats:"water", loses:"fire",  color:"#7aff9c" },
];

// ===== Util =====
const $ = sel => document.querySelector(sel);
const el = (tag, cls) => { const n=document.createElement(tag); if(cls) n.className=cls; return n; };
const rnd = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;

function setMsg(t){ $("#msg").textContent = t; }
function logItem(html, type=''){ const it = el('div','it'); it.innerHTML = (type?`<span class="tag ${type}">•</span>`:'') + html; $('#log').prepend(it); }

// ===== Estado =====
const Game = {
  players: [
    { id:'P1', berries:100, pos:0, starter:null, captured:0, elmColor:'#8ea3ff' },
    { id:'P2', berries:100, pos:0, starter:null, captured:0, elmColor:'#ff9fe0' },
  ],
  nPlayers: 1,
  turn: 0,
  round: 1,
  roundLimit: 10,
  positionCount: 30,
  path: [],
  zones: {}
};

// ===== HUD & Dados =====
function updateHUD(){
  $("#turnPill").textContent = `Vez de ${Game.players[Game.turn].id}.`;
  $("#hudRound").textContent = Game.round;
  $("#hudRoundLim").textContent = Game.roundLimit;
  $("#p1b").textContent = Game.players[0].berries;
  if(Game.nPlayers===2){
    $("#hudP2").style.display = "inline-block";
    $("#p2b").textContent = Game.players[1].berries;
  } else {
    $("#hudP2").style.display = "none";
  }
}

function showDice(a,b){
  const D1=$("#d1"), D2=$("#d2");
  D1.classList.add("roll"); D2.classList.add("roll");
  D1.textContent='•'; D2.textContent='•';
  setTimeout(()=>{ D1.textContent=a; D2.textContent=b; D1.classList.remove("roll"); D2.classList.remove("roll"); }, 500);
}

// ===== Tabuleiro (30 posições, retângulo) =====
function buildPath(){
  const r = $("#stage").getBoundingClientRect();
  const pad = 10;
  const x0=pad, y0=pad, w=r.width-2*pad, h=r.height-2*pad;
  const topN=9, rightN=7, bottomN=8, leftN=6; // soma 30
  const pts=[];

  for(let i=0;i<topN;i++){ const t= topN>1? i/(topN-1):0; pts.push({x:x0+t*w, y:y0}); }
  for(let i=1;i<=rightN;i++){ const t=i/rightN; pts.push({x:x0+w, y:y0+t*h}); }
  for(let i=1;i<=bottomN;i++){ const t=i/bottomN; pts.push({x:x0+w-t*w, y:y0+h}); }
  for(let i=1;i<=leftN;i++){ const t=i/leftN; pts.push({x:x0, y:y0+h-t*h}); }

  Game.path = pts;

  const dots = $("#pathDots"); dots.innerHTML='';
  pts.forEach(p=>{
    const d=el('div','path-dot');
    d.style.left = p.x+'px';
    d.style.top  = p.y+'px';
    dots.appendChild(d);
  });
}

// ===== Zonas (8 batalha, 2 captura, 6 bônus +10, 6 perda -5, 8 neutras) =====
function seedZones(){
  const total = Game.positionCount;
  const Z = new Array(total).fill('neutral');
  const idxs = [...Array(total).keys()].sort(()=>Math.random()-0.5);
  const take = n => idxs.splice(0,n);

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
    const p = Game.players[i];
    const t = el('div','token ' + (i===1?'p2':'p1')); t.id='tok_'+p.id;
    const b = el('div','bubble'); b.style.outline=`3px solid ${p.starter?.color || p.elmColor}`;
    const img = el('img'); img.src = p.starter?.img || POKEBALL; img.alt=p.starter?.name || 'Pokéball';
    const lb = el('div','label'); lb.textContent = p.id;
    t.appendChild(b); t.appendChild(img); t.appendChild(lb);
    $("#stage").appendChild(t);
  }
  syncTokens(true);
}

function syncTokens(inPlace=true){
  for(let i=0;i<Game.nPlayers;i++){
    const p = Game.players[i];
    const tok = $('#tok_'+p.id);
    const pt = Game.path[p.pos];
    if(!tok || !pt) continue;
    tok.style.left = pt.x+'px';
    tok.style.top  = pt.y+'px';
  }
}

// ===== Regras =====
function elementalEdge(me, opp){
  if(!me || !opp) return 0;
  if(me.beats===opp.key) return 1;
  if(me.loses===opp.key) return -1;
  return 0;
}

function startGame(){
  // máquina escolhe 1 ou 2 jogadores
  Game.nPlayers = Math.random()<0.5 ? 1 : 2;
  // starters aleatórios
  for(let i=0;i<Game.nPlayers;i++){
    Game.players[i].starter = STARTERS[rnd(0, STARTERS.length-1)];
  }

  Game.turn=0; Game.round=1;
  Game.players.forEach(p=>{ p.berries=100; p.pos=0; p.captured=0; });

  const board=$("#board");
  board.style.backgroundImage = `url('${BOARD_IMG}')`;
  board.style.backgroundSize  = "cover";

  buildPath();
  seedZones();
  ensureTokens();
  updateHUD();

  setMsg(`Partida iniciada com ${Game.nPlayers} jogador(es). Clique em Rolar.`);
  logItem("Partida iniciada.", "ok");
}

function nextTurn(){
  Game.turn = (Game.turn+1) % Game.nPlayers;
  if(Game.turn===0) Game.round++;
  updateHUD();
}

function endOrNext(){
  if(Game.round>=Game.roundLimit && Game.turn===(Game.nPlayers-1)){
    const p1 = Game.players[0].berries;
    let msg = `Fim das ${Game.roundLimit} rodadas. `;
    if(Game.nPlayers===2){
      const p2 = Game.players[1].berries;
      msg += (p1===p2?`Empate (${p1} x ${p2}).` : (p1>p2?`P1 venceu (${p1} x ${p2}).`:`P2 venceu (${p2} x ${p1}).`));
    }else{
      msg += `Seu saldo: ${p1}.`;
    }
    setMsg(msg); logItem(msg,'warn');
    return;
  }
  nextTurn();
}

function rollDice(){
  const d1 = rnd(1,6), d2 = rnd(1,6);
  showDice(d1,d2);
  const steps = d1+d2;

  const P = Game.players[Game.turn];

  if(P.captured>0){
    P.captured--;
    setMsg(`${P.id} está capturado! Passa a vez (${P.captured} restantes).`);
    logItem(`${P.id} perdeu o turno (capturado).`,'warn');
    nextTurn();
    return;
  }

  P.pos = (P.pos + steps) % Game.positionCount;
  syncTokens(false);
  logItem(`${P.id} rolou ${d1}+${d2} = ${steps}.`);
  resolveSquare(P);
}

function resolveSquare(P){
  const kind = Game.zones[P.pos] || 'neutral';

  if(kind==='neutral'){
    setMsg('Zona neutra. Nada acontece.');
    logItem(`${P.id} caiu em zona neutra.`);
    endOrNext();
  }
  else if(kind==='bonus'){
    P.berries += 10; updateHUD();
    setMsg(`Bônus! ${P.id} ganhou +10 berries.`);
    logItem(`<b>${P.id}</b> recebeu bônus +10 berries.`,'ok');
    endOrNext();
  }
  else if(kind==='loss'){
    P.berries = Math.max(0, P.berries-5); updateHUD();
    setMsg(`Perda! ${P.id} perdeu 5 berries.`);
    logItem(`<b>${P.id}</b> perdeu 5 berries.`,'bad');
    endOrNext();
  }
  else if(kind==='capture'){
    P.captured = 2;
    setMsg(`${P.id} foi capturado pela Equipe Rocket! 2 turnos sem jogar.`);
    logItem(`${P.id} CAPTURADO por 2 turnos.`,'bad');
    endOrNext();
  }
  else if(kind==='battle'){
    doBattle(P);
  }
}

function doBattle(P){
  const opp = STARTERS[rnd(0, STARTERS.length-1)];
  const me  = P.starter;
  const edge = elementalEdge(me, opp);
  const chance = 0.5 + (edge===1?0.25:(edge===-1?-0.25:0));
  const win = Math.random() < chance;

  const txt = `Batalha: ${P.id} (${me.name}) vs ${opp.name} — `+(win?`<b class="ok">vitória</b>`:`<b class="bad">derrota</b>`)
              + ` (vantagem: ${edge===1?'favorável':edge===-1?'desfavorável':'neutra'})`;
  setMsg(`Batalha! ${P.id} contra ${opp.name} — ${win?'vitória':'derrota'}.`);
  logItem(txt, win?'ok':'bad');

  endOrNext();
}

// ===== Init =====
function init(){
  $("#board").style.backgroundImage = `url('${BOARD_IMG}')`;
  $("#board").style.backgroundSize  = "cover";

  buildPath();
  setMsg("Clique em Iniciar para começar (1 ou 2 jogadores definidos pela máquina).");
  updateHUD();

  $("#btnStart").addEventListener('click', startGame);
  $("#btnRoll").addEventListener('click', rollDice);
  window.addEventListener('resize', ()=>{ buildPath(); syncTokens(true); });
}
document.addEventListener('DOMContentLoaded', init);
