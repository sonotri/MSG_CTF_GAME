// 타이틀/결과 화면, 랭킹 표시, 닉네임+비밀번호 확인.

const PASSWORD_MIN = 4;

// cyrb53: 비밀번호를 평문으로 남기지 않기 위한 간단한 해시
function hashPassword(name, password) {
  const str = `msg-dino-run:${nameKey(name)}:${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const UI = {
  title: document.getElementById("title-screen"),
  result: document.getElementById("result-screen"),
  nameInput: document.getElementById("player-name"),
  pwInput: document.getElementById("player-pw"),

  init() {
    this.preview = document.getElementById("dino-preview");
    document.getElementById("dino-prev").onclick = () => this.shiftDino(-1);
    document.getElementById("dino-next").onclick = () => this.shiftDino(1);
    window.addEventListener("keydown", (e) => {
      if (game.state !== "title" || this.title.hidden) return;
      if (e.target.tagName === "INPUT" && e.target.value) return; // 입력 중 커서 이동은 그대로
      if (e.key === "ArrowLeft") this.shiftDino(-1);
      if (e.key === "ArrowRight") this.shiftDino(1);
    });
    this.selectDino(0);

    // 선택된 공룡이 제자리에서 달리는 미리보기
    let frameNo = 0;
    setInterval(() => {
      if (this.title.hidden) return;
      frameNo ^= 1;
      this.preview.src = `assets/sprites/dino_${game.color}_run${frameNo + 1}.png`;
    }, 120);

    document.getElementById("course-info").textContent = `COURSE ${CONFIG.COURSE_SEED} · ${CONFIG.COURSE_METERS}m`;

    document.getElementById("start-btn").onclick = () => this.start();
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.pwInput.focus();
    });
    this.pwInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.start();
    });
    this.nameInput.addEventListener("input", () => this.updateNameHint());
    this.pwInput.addEventListener("input", () => this.updateNameHint());
    document.getElementById("retry-btn").onclick = () => {
      this.result.hidden = true;
      document.getElementById("card-qr").innerHTML = ""; // QR은 결과 화면에서 한 번만
      startRun();
    };
    document.getElementById("card-save").onclick = () => this.saveCard();
    document.getElementById("menu-btn").onclick = () => {
      this.result.hidden = true;
      document.getElementById("card-qr").innerHTML = "";
      this.showTitle();
    };

    // 모바일 버튼
    bindTouch(document.getElementById("btn-jump"), pressJump);
    bindTouch(
      document.getElementById("btn-slide"),
      () => (input.down = true),
      () => (input.down = false)
    );

  },

  shiftDino(step) {
    const n = CONFIG.DINOS.length;
    this.selectDino((this.dinoIndex + step + n) % n);
  },

  selectDino(i) {
    this.dinoIndex = i;
    game.dino = CONFIG.DINOS[i];
    this.preview.src = `assets/sprites/dino_${game.color}.png`;
    const label = document.getElementById("dino-field");
    label.textContent = `${game.dino.field} DINO`;
    label.style.color = CONFIG.DINO_HEX[game.color];
  },

  showTitle() {
    game.state = "title";
    this.title.hidden = false;
    this.renderBoard(document.getElementById("title-board"));
    this.pwInput.value = "";
    this.updateNameHint();
    this.nameInput.focus();
  },

  setHint(text, isError = false) {
    const hint = document.getElementById("name-hint");
    hint.textContent = text;
    hint.classList.toggle("error-text", isError);
  },

  updateNameHint() {
    const name = this.nameInput.value.trim();
    if (!name) return this.setHint("");
    const rec = Store.findRecord(name);
    if (Store.hasAccount(name)) {
      this.setHint(rec ? `기존 닉네임 · 최고 ${rec.score}점 · 비밀번호 입력` : "기존 닉네임 · 비밀번호 입력");
    } else if (rec) {
      this.setHint(`비밀번호 없는 예전 기록(${rec.score}점) · 지금 입력한 비밀번호로 등록`);
    } else {
      this.setHint(`새 닉네임 · 비밀번호(${PASSWORD_MIN}자 이상)를 기억해 두세요`);
    }
  },

  reject(input, message) {
    this.setHint(message, true);
    input.focus();
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 400);
  },

  async start() {
    if (this.busy) return;
    const name = this.nameInput.value.trim().slice(0, 12);
    const pw = this.pwInput.value;
    if (!name) return this.reject(this.nameInput, "닉네임을 입력하세요");
    if (pw.length < PASSWORD_MIN) return this.reject(this.pwInput, `비밀번호는 ${PASSWORD_MIN}자 이상`);

    // 새 닉네임이면 등록 (비밀번호 없던 예전 기록도 여기서 주인이 정해짐)
    this.busy = true;
    this.setHint("확인 중...");
    let result;
    try {
      result = await Store.login(name, hashPassword(name, pw));
    } catch (err) {
      console.error(err);
      return this.reject(this.pwInput, "서버 연결 실패. 인터넷을 확인하고 다시 시도하세요");
    } finally {
      this.busy = false;
    }
    if (result === "wrong") {
      this.pwInput.value = "";
      return this.reject(this.pwInput, "이미 있는 닉네임이에요. 비밀번호가 틀렸습니다");
    }

    game.playerName = name;
    this.title.hidden = true;
    this.nameInput.blur();
    this.pwInput.blur();
    startRun();
  },

  async showResult(r) {
    const b = r.breakdown;
    document.getElementById("result-title").textContent = r.cleared ? "GOAL!" : r.reason === "fall" ? "FALL DOWN" : "SYSTEM DOWN";
    document.getElementById("result-rows").innerHTML = `
      <tr><td>비트 & 아이템</td><td>${b.base}</td></tr>
      <tr><td>완주 보너스</td><td>${b.finish}</td></tr>
      <tr><td>남은 체력 보너스</td><td>${b.hp}</td></tr>
      <tr><td>무피격 보너스</td><td>${b.noHit}</td></tr>
      <tr class="total"><td>TOTAL</td><td>${r.total}</td></tr>`;
    document.getElementById("result-meta").textContent =
      `${r.meters}m · 비트 ${r.bits}개 · 피격 ${r.hits}회 · ${r.time.toFixed(1)}s`;

    this.result.hidden = false;
    document.getElementById("retry-btn").focus();
    const bestEl = document.getElementById("result-best");
    bestEl.textContent = "기록 저장 중...";
    document.getElementById("card-qr").innerHTML = "";
    document.getElementById("card-note").textContent = "";

    // 같은 닉네임이면 최고 점수만 유지
    const entry = { name: game.playerName, color: game.color, score: r.total, cleared: r.cleared, at: Date.now() };
    let prev;
    try {
      prev = await Store.submit(entry);
      bestEl.textContent = !prev
        ? "첫 기록 등록!"
        : r.total > prev.score
          ? `NEW BEST! ${prev.score} → ${r.total}`
          : `최고 기록 ${prev.score}점 유지`;
    } catch (err) {
      console.error(err);
      bestEl.textContent = "⚠ 기록 저장 실패 (인터넷 확인)";
    }

    // 이번 판 기준 순위 (같은 닉네임의 예전 기록은 빼고 비교)
    const others = Store.board.filter((e) => nameKey(e.name) !== nameKey(game.playerName));
    const rank = others.filter((e) => e.score > r.total).length + 1;
    this.cardData = {
      name: game.playerName,
      color: game.color,
      score: r.total,
      rank,
      total: others.length + 1,
      cleared: r.cleared,
      reason: r.reason,
      bits: r.bits,
      meters: r.meters,
      hits: r.hits,
      at: Date.now(),
    };
    this.showCardQr();

    this.renderBoard(document.getElementById("result-board"), game.playerName);
  },

  // 다른 PC에서 기록이 올라오면 호출된다
  refreshBoards() {
    if (!this.title.hidden) {
      this.renderBoard(document.getElementById("title-board"));
      this.updateNameHint();
    }
    if (!this.result.hidden) this.renderBoard(document.getElementById("result-board"), game.playerName);
  },

  // 결과 화면에만 뜨는 QR: 폰으로 스캔하면 card.html이 카드를 그려서 저장하게 해준다
  showCardQr() {
    const box = document.getElementById("card-qr");
    const note = document.getElementById("card-note");
    if (location.protocol === "file:") {
      box.innerHTML = "";
      note.textContent = "서버에 올리면 여기에 QR이 생겨요";
      return;
    }
    const url = new URL(`card.html#d=${encodeCardData(this.cardData)}`, location.href).href;
    const qr = qrcode(0, "L");
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    note.textContent = "폰 카메라로 스캔하면 인스타용 카드를 저장할 수 있어요";
  },

  saveCard() {
    const canvas = document.createElement("canvas");
    drawCard(canvas, this.cardData);
    const a = document.createElement("a");
    a.download = `msg-dino-run-${this.cardData.name}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  },

  renderBoard(el, highlight) {
    const board = Store.board.slice(0, 10);
    if (!board.length) {
      el.innerHTML = `<li class="empty">아직 기록이 없습니다</li>`;
      return;
    }
    el.innerHTML = board
      .map(
        (e, i) => `<li class="${highlight && nameKey(e.name) === nameKey(highlight) ? "me" : ""}">
          <span class="rank">${i + 1}</span>
          <img src="assets/sprites/dino_${e.color}.png" alt="">
          <span class="name">${escapeHtml(e.name)}</span>
          <span class="score">${e.score}${e.cleared ? "" : " ✕"}</span>
        </li>`
      )
      .join("");
  },
};

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
