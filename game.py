from js import document, console
import random

# ==== Caminhos das imagens (USANDO SUA PASTA LOCAL) ====
# Use sempre barras "/" no caminho, mesmo no Windows.
ASSETS = "C:/Users/faggr/FRONTSENAC/src/static/"
BOARD_IMG   = ASSETS + "img.png"
POKEBALL    = ASSETS + "pokeball.png"
IMG_WATER   = ASSETS + "starter_water.png"
IMG_FIRE    = ASSETS + "starter_fire.png"
IMG_GRASS   = ASSETS + "starter_grass.png"

STARTERS = [
    {"key":"water", "name":"Água",  "img":IMG_WATER, "beats":"fire",  "loses":"grass", "color":"#67d3ff"},
    {"key":"fire",  "name":"Fogo",  "img":IMG_FIRE,  "beats":"grass", "loses":"water", "color":"#ff9c67"},
    {"key":"grass", "name":"Planta","img":IMG_GRASS, "beats":"water", "loses":"fire",  "color":"#7aff9c"},
]

# ==== Estado do jogo ====
Game = {
    "players": [
        {"id":"P1", "berries":100, "pos":0, "starter":None, "captured":0, "elmColor":"#8ea3ff"},
        {"id":"P2", "berries":100, "pos":0, "starter":None, "captured":0, "elmColor":"#ff9fe0"},
    ],
    "nPlayers": 1,          # decidido aleatoriamente ao iniciar
    "turn": 0,
    "round": 1,
    "roundLimit": 10,
    "positionCount": 30,    # <= pedido
    "path": [],
    "zones": {},            # idx -> 'neutral'|'bonus'|'loss'|'battle'|'capture'
}

# ==== atalhos UI ====
def $(sel: str):
    return document.querySelector(sel)

def el(tag: str, cls: str = ""):
    n = document.createElement(tag)
    if cls:
        n.className = cls
    return n

def set_msg(txt: str):
    $("#msg").textContent = txt

def log_item(html: str, tag: str = ""):
    it = el("div", "it")
    if tag:
        it.innerHTML = f'<span class="tag {tag}">•</span>' + html
    else:
        it.innerHTML = html
    $("#log").prepend(it)

def update_hud():
    $("#turnPill").textContent = f"Vez de {Game['players'][Game['turn']]['id']}."
    $("#hudRound").textContent = str(Game["round"])
    $("#hudRoundLim").textContent = str(Game["roundLimit"])
    $("#p1b").textContent = str(Game["players"][0]["berries"])
    if Game["nPlayers"] == 2:
        $("#hudP2").style.display = "inline-block"
        $("#p2b").textContent = str(Game["players"][1]["berries"])
    else:
        $("#hudP2").style.display = "none"

def show_dice(a: int, b: int):
    d1, d2 = $("#d1"), $("#d2")
    d1.classList.add("roll")
    d2.classList.add("roll")
    d1.textContent = "•"
    d2.textContent = "•"
    # Pequeno atraso visual (não bloqueia lógica)
    def _late(evt=None):
        d1.textContent = str(a)
        d2.textContent = str(b)
        d1.classList.remove("roll")
        d2.classList.remove("roll")
    # usa setTimeout do browser
    from js import setTimeout
    setTimeout(_late, 500)

# ==== path (retângulo em 30 casas) ====
def build_path():
    stage = $("#stage").getBoundingClientRect()
    pad = 10
    x0, y0 = pad, pad
    w = stage.width - pad*2
    h = stage.height - pad*2

    # Divisão simples p/ 30
    topN, rightN, bottomN, leftN = 9, 7, 8, 6  # soma 30
    pts = []

    # topo (x cresce)
    for i in range(topN):
        t = i/(topN-1) if topN>1 else 0
        pts.append({"x": x0 + t*w, "y": y0})
    # direita (y cresce)
    for i in range(1, rightN+1):
        t = i/rightN
        pts.append({"x": x0 + w, "y": y0 + t*h})
    # base (x decresce)
    for i in range(1, bottomN+1):
        t = i/bottomN
        pts.append({"x": x0 + w - t*w, "y": y0 + h})
    # esquerda (y decresce)
    for i in range(1, leftN+1):
        t = i/leftN
        pts.append({"x": x0, "y": y0 + h - t*h})

    Game["path"] = pts

    # Pontos debug
    dots = $("#pathDots")
    dots.innerHTML = ""
    for p in pts:
        d = el("div", "path-dot")
        d.style.left = f"{p['x']}px"
        d.style.top = f"{p['y']}px"
        dots.appendChild(d)

# ==== zonas: 8 battle, 2 capture, 6 bonus, 6 loss, 8 neutral ====
def seed_zones():
    total = Game["positionCount"]  # 30
    Z = ["neutral"] * total

    # escolhe posições sem repetir
    idxs = list(range(total))
    random.shuffle(idxs)

    def take(n):
        out = idxs[:n]
        del idxs[:n]
        return out

    for i in take(8):  Z[i] = "battle"
    for i in take(2):  Z[i] = "capture"
    for i in take(6):  Z[i] = "bonus"
    for i in take(6):  Z[i] = "loss"
    # sobrou 8 neutral automaticamente

    # mapeia em dict pos->tipo
    Game["zones"] = {i: Z[i] for i in range(total)}

# ==== tokens ====
def ensure_tokens():
    # remove tokens
    for n in document.querySelectorAll(".token"):
        n.remove()

    for i in range(Game["nPlayers"]):
        p = Game["players"][i]
        t = el("div", "token " + ("p2" if i==1 else "p1"))
        t.id = f"tok_{p['id']}"
        bubble = el("div", "bubble")
        bubble.style.outline = f"3px solid {p['starter']['color'] if p['starter'] else p['elmColor']}"
        img = el("img")
        img.src = p["starter"]["img"] if p["starter"] else POKEBALL
        img.alt = p["starter"]["name"] if p["starter"] else "Pokéball"
        label = el("div", "label")
        label.textContent = p["id"]
        t.appendChild(bubble)
        t.appendChild(img)
        t.appendChild(label)
        $("#stage").appendChild(t)
    sync_tokens(in_place=True)

def sync_tokens(in_place: bool = True):
    for i in range(Game["nPlayers"]):
        p = Game["players"][i]
        tok = $("#tok_" + p["id"])
        pt = Game["path"][p["pos"]]
        if not (tok and pt):
            continue
        tok.style.left = f"{pt['x']}px"
        tok.style.top  = f"{pt['y']}px"
        # transição é CSS; se quiser “pular” sem transição, poderia togglar class

# ==== auxiliar ====
def elemental_edge(me, opp):
    if not (me and opp):
        return 0
    if me["beats"] == opp["key"]:
        return 1
    if me["loses"] == opp["key"]:
        return -1
    return 0

# ==== regras principais ====
def start_game(evt=None):
    # Máquina decide 1 ou 2 jogadores
    Game["nPlayers"] = random.choice([1, 2])

    # starters aleatórios (Água/Fogo/Planta)
    for i in range(Game["nPlayers"]):
        Game["players"][i]["starter"] = random.choice(STARTERS)

    # reset básicos
    Game["turn"]  = 0
    Game["round"] = 1
    for p in Game["players"]:
        p["berries"]   = 100
        p["pos"]       = 0
        p["captured"]  = 0

    # aplica board e path
    board = $("#board")
    board.style.backgroundImage = f"url('{BOARD_IMG}')"
    board.style.backgroundSize  = "cover"

    build_path()
    seed_zones()
    ensure_tokens()
    update_hud()

    set_msg(f"Partida iniciada com {Game['nPlayers']} jogador(es). Clique em Rolar para andar.")
    log_item("Partida iniciada.", "ok")

def next_turn():
    Game["turn"] = (Game["turn"] + 1) % Game["nPlayers"]
    if Game["turn"] == 0:
        Game["round"] += 1
    update_hud()

def end_or_next():
    # fim por round
    if Game["round"] >= Game["roundLimit"] and Game["turn"] == (Game["nPlayers"] - 1):
        p1 = Game["players"][0]["berries"]
        msg = f"Fim das {Game['roundLimit']} rodadas. "
        if Game["nPlayers"] == 2:
            p2 = Game["players"][1]["berries"]
            if p1 == p2:
                msg += f"Empate ({p1} x {p2})."
            else:
                msg += f"{'P1' if p1>p2 else 'P2'} venceu ({max(p1,p2)} x {min(p1,p2)})."
        else:
            msg += f"Seu saldo: {p1}."
        set_msg(msg)
        log_item(msg, "warn")
        return
    next_turn()

def roll(evt=None):
    # exibe dados
    d1, d2 = random.randint(1,6), random.randint(1,6)
    show_dice(d1, d2)
    steps = d1 + d2

    P = Game["players"][Game["turn"]]
    # captura (pula vez)
    if P["captured"] > 0:
        P["captured"] -= 1
        set_msg(f"{P['id']} está capturado! Passa a vez ({P['captured']} restantes).")
        log_item(f"{P['id']} perdeu o turno (capturado).", "warn")
        next_turn()
        return

    # mover
    P["pos"] = (P["pos"] + steps) % Game["positionCount"]
    sync_tokens(in_place=False)
    log_item(f"{P['id']} rolou {d1}+{d2} = {steps}.")

    # resolver casa
    resolve_square(P)

def resolve_square(P):
    kind = Game["zones"].get(P["pos"], "neutral")

    if kind == "neutral":
        set_msg("Zona neutra. Nada acontece.")
        log_item(f"{P['id']} caiu em zona neutra.")
        end_or_next()

    elif kind == "bonus":
        P["berries"] += 10
        update_hud()
        set_msg(f"Bônus! {P['id']} ganhou +10 berries.")
        log_item(f"<b>{P['id']}</b> recebeu bônus +10 berries.", "ok")
        end_or_next()

    elif kind == "loss":
        P["berries"] = max(0, P["berries"] - 5)
        update_hud()
        set_msg(f"Perda! {P['id']} perdeu 5 berries.")
        log_item(f"<b>{P['id']}</b> perdeu 5 berries.", "bad")
        end_or_next()

    elif kind == "capture":
        P["captured"] = 2
        set_msg(f"{P['id']} foi capturado pela Equipe Rocket! 2 turnos sem jogar.")
        log_item(f"{P['id']} CAPTURADO por 2 turnos.", "bad")
        end_or_next()

    elif kind == "battle":
        do_battle(P)

def do_battle(P):
    # oponente aleatório (entre os 3 elementos)
    opp = random.choice(STARTERS)
    me  = P["starter"]

    e = elemental_edge(me, opp)
    # chance base 50%, vantagem +25pp, desvantagem -25pp
    chance = 0.5 + (0.25 if e==1 else (-0.25 if e==-1 else 0))
    venceu = random.random() < chance

    fight = f"Batalha: {P['id']} ({me['name']}) vs {opp['name']} — "
    fight += ("<b class='ok'>vitória</b>" if venceu else "<b class='bad'>derrota</b>")
    fight += f" (vantagem: {'favorável' if e==1 else ('desfavorável' if e==-1 else 'neutra')})"

    set_msg(f"Batalha! {P['id']} contra {opp['name']} — {'vitória' if venceu else 'derrota'}.")
    log_item(fight, "ok" if venceu else "bad")

    end_or_next()

# ==== inicialização ====
def init():
    # aplica board
    board = $("#board")
    board.style.backgroundImage = f"url('{BOARD_IMG}')"
    board.style.backgroundSize = "cover"

    build_path()
    # mensagem inicial
    set_msg("Clique em Iniciar para começar (a máquina escolhe 1 ou 2 jogadores e starters aleatórios).")
    update_hud()
    # eventos dos botões
    $("#btnStart").addEventListener("click", start_game)
    $("#btnRoll").addEventListener("click", roll)
    # responsivo: recalcula path e reposiciona
    def on_resize(evt=None):
        build_path()
        sync_tokens(in_place=True)
    document.defaultView.addEventListener("resize", on_resize)

# roda init quando o PyScript estiver carregado
init()
