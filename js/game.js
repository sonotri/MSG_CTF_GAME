// 메인 게임 루프: 입력, 물리, 충돌, 렌더링, HUD.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = CONFIG.WIDTH;
canvas.height = CONFIG.HEIGHT;
ctx.imageSmoothingEnabled = false;

const G = CONFIG.GROUND_Y;

const game = {
  state: "title", // title | countdown | running | finished | result
  course: null,
  player: null,
  camX: 0,
  time: 0,
  countdown: 0,
  score: 0,
  bits: 0,
  hits: 0,
  floaters: [],
  shake: 0,
  clouds: [],
  groundDots: [],
  endTimer: 0,
  playerName: "",
  dino: CONFIG.DINOS[0],
  get color() {
    return this.dino.color;
  },
};

const input = { jumpPressed: false, down: false };

// ---------- 초기화 ----------

function resetGame() {
  game.course = generateCourse(CONFIG.COURSE_SEED);
  game.player = {
    x: game.course.startX - 260, // 월드 좌표 (스프라이트 왼쪽)
    y: G, // 발바닥
    vy: 0,
    onGround: true,
    jumps: 0,
    sliding: false,
    slideTime: 0,
    hp: CONFIG.HP_MAX,
    invincible: 0,
    falling: false,
    runTime: 0,
  };
  game.camX = game.player.x - CONFIG.PLAYER_SCREEN_X;
  game.time = 0;
  game.score = 0;
  game.bits = 0;
  game.hits = 0;
  game.floaters = [];
  game.shake = 0;
  game.endTimer = 0;
  game.result = null;

  const rand = mulberry32(7);
  game.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 160 + rand() * 80, y: 30 + rand() * 60 }));
  game.groundDots = Array.from({ length: 60 }, () => ({
    x: rand() * CONFIG.WIDTH * 2,
    y: G + 4 + Math.floor(rand() * 12),
    w: 1 + Math.floor(rand() * 3),
  }));
}

function startRun() {
  resetGame();
  game.state = "countdown";
  game.countdown = 3;
}

// ---------- 입력 ----------

function pressJump() {
  input.jumpPressed = true;
}

window.addEventListener("keydown", (e) => {
  if (game.state === "title" || game.state === "result") return;
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
    e.preventDefault();
    if (!e.repeat) pressJump();
  }
  if (["ArrowDown", "KeyS"].includes(e.code)) {
    e.preventDefault();
    input.down = true;
  }
});

window.addEventListener("keyup", (e) => {
  if (["ArrowDown", "KeyS"].includes(e.code)) input.down = false;
});

function bindTouch(el, onDown, onUp) {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onDown();
  });
  if (onUp) {
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => el.addEventListener(t, onUp));
  }
}

// ---------- 업데이트 ----------

function overPit(worldX) {
  return game.course.pits.some((p) => worldX > p.x && worldX < p.x + p.w);
}

function playerBox(p) {
  if (p.sliding) return { x: p.x + 4, y: p.y - 20, w: 42, h: 18 };
  return { x: p.x + 10, y: p.y - 44, w: 26, h: 40 };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function obstacleBox(o) {
  if (typeof o.hit === "object") return { x: o.x + o.hit.x, y: o.y + o.hit.y, w: o.hit.w, h: o.hit.h };
  return { x: o.x + o.hit, y: o.y + o.hit, w: o.w - o.hit * 2, h: o.h - o.hit };
}

function addScore(pts, x, y) {
  game.score += pts;
  game.floaters.push({ text: `+${pts}`, x, y, life: 0.8 });
}

function takeDamage(amount, reason) {
  const p = game.player;
  if (p.invincible > 0) return;
  p.hp = Math.max(0, p.hp - amount);
  p.invincible = CONFIG.INVINCIBLE_SEC;
  game.hits++;
  game.shake = 0.25;
  game.floaters.push({ text: reason, x: p.x, y: p.y - 60, life: 1 });
}

function collectItem(pk) {
  addScore(CONFIG.SCORE.SPECIAL, pk.x, pk.y - 20);
  game.floaters.push({ text: `${game.dino.field} BONUS`, x: pk.x, y: pk.y - 40, life: 1.2 });
}

function update(dt) {
  const p = game.player;
  const course = game.course;

  if (game.state === "countdown") {
    game.countdown -= dt;
    if (game.countdown <= 0) {
      game.state = "running";
      game.floaters.push({ text: "GO!", x: p.x + 22, y: G - 70, life: 0.8 });
    }
    // 카운트다운 중에는 시작선 앞까지만 천천히 걸어간다
    p.runTime += dt;
    return;
  }

  if (game.state !== "running" && game.state !== "finished") {
    return;
  }

  const finished = game.state === "finished";
  const speed = finished ? Math.max(0, speedAt(p.x, course) * (1 - game.endTimer / 1.2)) : speedAt(p.x, course);
  game.time += dt;
  p.runTime += dt;
  p.x += speed * dt;

  // 점프 / 2단 점프
  if (input.jumpPressed && !finished && !p.falling) {
    if (p.onGround) {
      p.vy = -CONFIG.JUMP_VELOCITY;
      p.onGround = false;
      p.jumps = 1;
    } else if (p.jumps < 2) {
      p.vy = -CONFIG.DOUBLE_JUMP_VELOCITY;
      p.jumps = 2;
    }
  }
  input.jumpPressed = false;

  // 슬라이드 / 급강하
  p.sliding = input.down && p.onGround && !finished;
  p.slideTime = p.sliding ? p.slideTime + dt : 0;
  if (input.down && !p.onGround) p.vy += CONFIG.FAST_FALL * dt;

  // 중력 & 바닥 (구덩이 위에서는 바닥이 없음)
  const footX = p.x + 22;
  const groundHere = !overPit(footX);
  if (p.onGround && !groundHere) {
    p.onGround = false;
    p.falling = true;
  }
  if (!p.onGround) {
    p.vy += CONFIG.GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= G && groundHere && !p.falling) {
      p.y = G;
      p.vy = 0;
      p.onGround = true;
      p.jumps = 0;
    }
    if (p.y > G && !groundHere) p.falling = true;
  }

  // 구덩이에 떨어지면 즉시 게임 오버
  if (p.y > CONFIG.HEIGHT + 60) {
    endRun(false, "fall");
    return;
  }

  // 체력 감소
  if (!finished) p.hp = Math.max(0, p.hp - CONFIG.HP_DRAIN_PER_SEC * dt);
  p.invincible = Math.max(0, p.invincible - dt);

  // 충돌: 장애물
  const box = playerBox(p);
  if (!p.falling) {
    for (const o of course.obstacles) {
      if (o.x > p.x + 100 || o.x + o.w < p.x - 20 || o.hitDone) continue;
      if (overlap(box, obstacleBox(o))) {
        o.hitDone = true;
        takeDamage(CONFIG.HIT_DAMAGE, "HIT!");
      }
    }
  }

  // 픽업: 비트 / 아이템
  for (const pk of course.pickups) {
    if (pk.taken || pk.x > p.x + 100 || pk.x < p.x - 60) continue;
    const r = pk.kind === "item" ? 14 : 8;
    if (overlap(box, { x: pk.x - r, y: pk.y - r, w: r * 2, h: r * 2 })) {
      pk.taken = true;
      if (pk.kind === "bit") {
        game.bits++;
        addScore(CONFIG.SCORE.BIT, pk.x, pk.y);
      } else if (pk.kind === "bigBit") {
        game.bits++;
        addScore(CONFIG.SCORE.BIG_BIT, pk.x, pk.y);
      } else {
        collectItem(pk);
      }
    }
  }

  // 결승 / 사망
  if (!finished && p.hp <= 0) {
    endRun(false, "hp");
  } else if (!finished && p.x + 22 >= course.finishX) {
    game.state = "finished";
    p.vy = Math.min(p.vy, 0);
  }
  if (game.state === "finished") {
    game.endTimer += dt;
    if (game.endTimer > 1.4) endRun(true);
  }

  game.floaters.forEach((f) => {
    f.life -= dt;
    f.y -= 30 * dt;
  });
  game.floaters = game.floaters.filter((f) => f.life > 0);
  game.shake = Math.max(0, game.shake - dt);

  // 카메라
  game.camX = p.x - CONFIG.PLAYER_SCREEN_X;
}

function endRun(cleared, reason) {
  const p = game.player;
  const S = CONFIG.SCORE;
  const breakdown = { base: game.score, finish: 0, hp: 0, noHit: 0 };
  if (cleared) {
    breakdown.finish = S.FINISH;
    breakdown.hp = Math.round(p.hp) * S.HP_LEFT;
    breakdown.noHit = game.hits === 0 ? S.NO_HIT : 0;
  }
  const total = breakdown.base + breakdown.finish + breakdown.hp + breakdown.noHit;
  const meters = Math.max(0, Math.min(CONFIG.COURSE_METERS, Math.floor((p.x + 22 - game.course.startX) / CONFIG.PX_PER_METER)));
  game.result = { cleared, reason, total, breakdown, meters, bits: game.bits, hits: game.hits, time: game.time };
  game.state = "result";
  UI.showResult(game.result);
}

// ---------- 렌더링 ----------

function sx(worldX) {
  return Math.round(worldX - game.camX);
}

function drawBackground() {
  ctx.fillStyle = CONFIG.BG;
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

  // 구름 (패럴랙스 0.2)
  for (const c of game.clouds) {
    const x = (((c.x - game.camX * 0.2) % 960) + 960) % 960 - 80;
    ctx.drawImage(Sprites.cloud, Math.round(x), c.y);
  }
}

function drawGround() {
  const W = CONFIG.WIDTH;
  ctx.fillStyle = CONFIG.INK;
  // 지평선 (구덩이 부분은 비움)
  let x = 0;
  const pits = game.course.pits
    .map((p) => ({ a: sx(p.x), b: sx(p.x + p.w) }))
    .filter((p) => p.b > 0 && p.a < W)
    .sort((m, n) => m.a - n.a);
  for (const pit of pits) {
    if (pit.a > x) ctx.fillRect(x, G - 1, pit.a - x, 2);
    // 구덩이 표현
    ctx.fillRect(pit.a - 2, G - 1, 2, CONFIG.HEIGHT - G);
    ctx.fillRect(pit.b, G - 1, 2, CONFIG.HEIGHT - G);
    x = Math.max(x, pit.b);
  }
  if (x < W) ctx.fillRect(x, G - 1, W - x, 2);

  // 흙 점들
  const span = W * 2;
  for (const d of game.groundDots) {
    const dx = (((d.x - game.camX) % span) + span) % span - W / 2;
    const worldX = dx + game.camX;
    if (overPit(worldX)) continue;
    ctx.fillRect(Math.round(dx), d.y, d.w, 1);
  }
}

function drawLine(worldX, label, checkered) {
  const x = sx(worldX);
  if (x < -60 || x > CONFIG.WIDTH + 60) return;
  ctx.fillStyle = CONFIG.INK;
  ctx.fillRect(x, G - 110, 3, 110);
  if (checkered) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 ? CONFIG.INK : "#ffffff";
        ctx.fillRect(x + 3 + c * 6, G - 110 + r * 6, 6, 6);
      }
    }
    ctx.strokeStyle = CONFIG.INK;
    ctx.strokeRect(x + 3.5, G - 109.5, 48, 24);
  } else {
    ctx.fillRect(x + 3, G - 110, 40, 16);
  }
  ctx.fillStyle = checkered ? CONFIG.INK : CONFIG.BG;
  ctx.font = '8px "Press Start 2P", "Galmuri11", monospace';
  ctx.fillText(label, checkered ? x + 6 : x + 6, checkered ? G - 74 : G - 99);
  // 바닥 라인
  for (let y = G + 2; y < CONFIG.HEIGHT; y += 6) {
    ctx.fillStyle = CONFIG.INK;
    ctx.fillRect(x - 1, y, 5, 3);
  }
}

function drawObstacles() {
  for (const o of game.course.obstacles) {
    const x = sx(o.x);
    if (x < -60 || x > CONFIG.WIDTH + 20) continue;
    let img = Sprites[o.type];
    if (o.type === "ptero") img = Math.floor(game.time * 6) % 2 ? Sprites.pteroUp : Sprites.pteroDown;
    ctx.drawImage(img, x, Math.round(o.y));
  }
}

function drawPickups() {
  const t = game.time;
  for (const pk of game.course.pickups) {
    if (pk.taken) continue;
    const x = sx(pk.x);
    if (x < -30 || x > CONFIG.WIDTH + 30) continue;
    if (pk.kind === "item") {
      const img = Sprites[`item_${game.dino.item}`];
      const bob = Math.round(Math.sin(t * 5 + pk.x) * 3);
      // 반짝이는 테두리
      if (Math.floor(t * 4) % 2) {
        ctx.fillStyle = "#ffd84a";
        ctx.fillRect(x - img.width / 2 - 3, pk.y - img.height / 2 - 3 + bob, img.width + 6, img.height + 6);
      }
      ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(pk.y - img.height / 2 + bob));
    } else {
      const img = pk.kind === "bigBit" ? Sprites.bigBit : Sprites[`bit${pk.glyph}${pk.small ? "Small" : ""}`];
      ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(pk.y - img.height / 2));
    }
  }
}

function drawPlayer() {
  const p = game.player;
  if (p.invincible > 0 && Math.floor(p.invincible * 16) % 2) return;
  const c = game.color;
  let img;
  if (p.sliding) img = p.slideTime < 0.06 ? Sprites[`dino_${c}_crouch`] : Sprites[`dino_${c}_slide`];
  else if (!p.onGround) img = Sprites[`dino_${c}`];
  else if (game.state === "countdown" || (game.state === "finished" && game.endTimer > 1.2)) img = Sprites[`dino_${c}`];
  else img = Math.floor(p.runTime * 12) % 2 ? Sprites[`dino_${c}_run1`] : Sprites[`dino_${c}_run2`];

  const scale = 2;
  const w = img.width * scale;
  const h = img.height * scale;
  const x = sx(p.x);

  ctx.drawImage(img, x, Math.round(p.y - h), w, h);
}

function drawFloaters() {
  ctx.font = '8px "Press Start 2P", "Galmuri11", monospace';
  ctx.textAlign = "center";
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.fillStyle = CONFIG.INK;
    ctx.fillText(f.text, sx(f.x), Math.round(f.y));
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function drawHUD() {
  const p = game.player;
  const W = CONFIG.WIDTH;
  ctx.font = '10px "Press Start 2P", "Galmuri11", monospace';
  ctx.fillStyle = CONFIG.INK;

  // 점수
  ctx.textAlign = "right";
  ctx.fillText(String(game.score).padStart(6, "0"), W - 12, 22);
  ctx.textAlign = "left";

  // 체력 바
  ctx.fillText("HP", 12, 22);
  ctx.strokeStyle = CONFIG.INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 12, 152, 12);
  const ratio = p.hp / CONFIG.HP_MAX;
  ctx.fillStyle = ratio > 0.3 ? CONFIG.DINO_HEX[game.color] : Math.floor(game.time * 6) % 2 ? "#e33" : CONFIG.INK;
  ctx.fillRect(40, 14, Math.round(148 * ratio), 8);

  // 진행 바 (START ---- dino ---- GOAL)
  const barX = 230;
  const barW = 340;
  const prog = Math.max(0, Math.min(1, (p.x + 22 - game.course.startX) / (game.course.finishX - game.course.startX)));
  ctx.fillStyle = CONFIG.INK;
  ctx.fillRect(barX, 18, barW, 2);
  ctx.fillRect(barX, 12, 2, 12);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? CONFIG.INK : "#fff";
    ctx.fillRect(barX + barW + i * 4, 10 + j * 4, 4, 4);
  }
  ctx.fillStyle = CONFIG.INK;
  ctx.fillRect(barX + barW, 10, 1, 14);
  const icon = Sprites[`dino_${game.color}`];
  ctx.drawImage(icon, Math.round(barX + barW * prog - icon.width / 2), 6);
  ctx.font = '8px "Press Start 2P", "Galmuri11", monospace';
  ctx.fillText(`${Math.floor(prog * CONFIG.COURSE_METERS)}m`, barX, 38);
}

function drawCountdown() {
  if (game.state !== "countdown") return;
  const n = Math.ceil(game.countdown);
  ctx.font = '32px "Press Start 2P", "Galmuri11", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = CONFIG.INK;
  ctx.fillText(String(n), CONFIG.WIDTH / 2, 120);
  ctx.textAlign = "left";
}

function render() {
  ctx.save();
  if (game.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 6), Math.round((Math.random() - 0.5) * 4));
  drawBackground();
  if (game.course) {
    drawGround();
    drawLine(game.course.startX, "START", false);
    drawLine(game.course.finishX, "GOAL", true);
    drawPickups();
    drawObstacles();
    drawPlayer();
    drawFloaters();
    drawHUD();
    drawCountdown();
  }
  ctx.restore();
}

// ---------- 루프 ----------

let last = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
