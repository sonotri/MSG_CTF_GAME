// 결과 공유 카드 (인스타 4:5, 1080x1350).
// 게임 결과 화면과 card.html(폰에서 QR로 여는 페이지)이 같이 쓴다.
// 이미지 파일 대신 sprite-data.js 픽셀을 직접 그려서 어디서든 저장이 막히지 않는다.

const CARD_W = 1080;
const CARD_H = 1350;
const CARD_INK = "#535353";
const CARD_BG = "#f7f7f7";
const CARD_FONT =
  '"Press Start 2P", "Galmuri11", "Malgun Gothic", "Apple SD Gothic Neo", monospace';

// ---- 결과 데이터 <-> URL ----

function encodeCardData(d) {
  const json = JSON.stringify([
    d.name,
    d.color,
    d.score,
    d.rank,
    d.total,
    d.cleared ? 1 : 0,
    d.reason || "",
    d.bits,
    d.meters,
    d.hits,
    d.at,
  ]);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCardData(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const json = new TextDecoder().decode(
    Uint8Array.from(bin, (c) => c.charCodeAt(0)),
  );
  const [
    name,
    color,
    score,
    rank,
    total,
    cleared,
    reason,
    bits,
    meters,
    hits,
    at,
  ] = JSON.parse(json);
  return {
    name,
    color,
    score,
    rank,
    total,
    cleared: !!cleared,
    reason,
    bits,
    meters,
    hits,
    at,
  };
}

// ---- 그리기 도우미 ----

function drawPixels(g, rows, x, y, unit, color) {
  g.fillStyle = color;
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++)
      if (row[c] === "#") g.fillRect(x + c * unit, y + r * unit, unit, unit);
  });
}

// 공룡 머리 위치 기준 (DINO_ART 22x24)
const SUNGLASSES = [
  // [x, y, color]  b = 검정, w = 반사광
  ...[9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((x) => [x, 1, "b"]),
  ...[12, 13, 14, 15, 16, 17].map((x) => [x, 2, "b"]),
  ...[13, 14, 15, 16].map((x) => [x, 3, "b"]),
  [13, 2, "w"],
  [14, 2, "w"],
];

const CROWN = ["#...#...#", "##.###.##", "#########", "#########"];
const CROWN_COLORS = { 1: "#f0b400", 2: "#a3abb8", 3: "#c0763a" };

const CACTUS = [
  "..##...",
  "..##...",
  "..##.#.",
  "#.##.#.",
  "#.##.#.",
  "#.####.",
  "#.##...",
  "####...",
  "..##...",
  "..##...",
  "..##...",
];

function cardTagline(d) {
  if (d.cleared && d.rank === 1) return "KING OF DINOS";
  if (d.cleared && d.hits === 0) return "UNTOUCHABLE";
  if (d.cleared) return "MISSION COMPLETE";
  if (d.reason === "fall") return "404 GROUND NOT FOUND";
  return "SEGMENTATION FAULT";
}

function textFit(g, text, maxW, size) {
  let s = size;
  do {
    g.font = `${s}px ${CARD_FONT}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 12);
}

// ---- 카드 ----

function drawCard(canvas, d) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext("2d");
  const hex = CONFIG.DINO_HEX[d.color];
  const dino = CONFIG.DINOS.find((x) => x.color === d.color);
  const cx = CARD_W / 2;

  g.fillStyle = CARD_BG;
  g.fillRect(0, 0, CARD_W, CARD_H);

  // 배경에 흩뿌린 비트 (같은 결과면 같은 배치)
  const rand = mulberry32(hashString(d.name + d.score));
  g.globalAlpha = 0.12;
  g.fillStyle = CARD_INK;
  for (let i = 0; i < 70; i++) {
    g.font = `${20 + Math.floor(rand() * 3) * 8}px ${CARD_FONT}`;
    g.fillText(
      rand() < 0.5 ? "0" : "1",
      rand() * CARD_W,
      40 + rand() * (CARD_H - 40),
    );
  }
  g.globalAlpha = 1;

  // 테두리 (픽셀 느낌의 이중선)
  g.fillStyle = CARD_INK;
  g.fillRect(24, 24, CARD_W - 48, 8);
  g.fillRect(24, CARD_H - 32, CARD_W - 48, 8);
  g.fillRect(24, 24, 8, CARD_H - 48);
  g.fillRect(CARD_W - 32, 24, 8, CARD_H - 48);

  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  // 제목
  g.fillStyle = CARD_INK;
  g.font = `56px ${CARD_FONT}`;
  g.fillText("MSG DINO RUN", cx, 130);
  g.font = `22px ${CARD_FONT}`;
  g.fillText(cardTagline(d), cx, 180);

  // 공룡 + 선글라스 (+ 1~3등이면 금/은/동 왕관)
  const U = 16;
  const art = DINO_ART[d.color];
  const dw = art[0].length * U;
  const dh = art.length * U;
  const dx = cx - dw / 2;
  const groundY = 690;
  const dy = groundY - dh;
  drawPixels(g, art, dx, dy, U, hex);
  for (const [x, y, c] of SUNGLASSES) {
    g.fillStyle = c === "b" ? "#111" : "#fff";
    g.fillRect(dx + x * U, dy + y * U, U, U);
  }
  const crownColor = CROWN_COLORS[d.rank];
  if (crownColor) drawPixels(g, CROWN, dx + 12 * U, dy - 5 * U, U, crownColor);

  // 땅 + 선인장
  g.fillStyle = CARD_INK;
  g.fillRect(90, groundY, CARD_W - 180, 6);
  for (let i = 0; i < 26; i++)
    g.fillRect(
      100 + rand() * (CARD_W - 200),
      groundY + 16 + rand() * 30,
      6 + rand() * 14,
      5,
    );
  drawPixels(g, CACTUS, 130, groundY - CACTUS.length * 10, 10, CARD_INK);
  drawPixels(g, CACTUS, 860, groundY - CACTUS.length * 10, 10, CARD_INK);

  // 분야
  g.fillStyle = hex;
  g.font = `40px ${CARD_FONT}`;
  g.fillText(`${dino.field} DINO`, cx, 790);

  // 닉네임
  g.fillStyle = CARD_INK;
  textFit(g, d.name, CARD_W - 200, 44);
  g.fillText(d.name, cx, 870);

  // 점수
  g.fillStyle = "#111";
  g.font = `110px ${CARD_FONT}`;
  g.fillText(String(d.score), cx, 1020);
  g.fillStyle = CARD_INK;
  g.font = `24px ${CARD_FONT}`;
  g.fillText("SCORE", cx, 1065);

  // 순위 + 상세
  g.font = `40px ${CARD_FONT}`;
  g.fillStyle = d.rank <= 3 ? "#e8541a" : CARD_INK;
  g.fillText(`RANK #${d.rank} / ${d.total}`, cx, 1150);
  g.fillStyle = CARD_INK;
  g.font = `20px ${CARD_FONT}`;
  const status = d.cleared
    ? "GOAL"
    : d.reason === "fall"
      ? "FALL DOWN"
      : "SYSTEM DOWN";
  g.fillText(
    `${status} · ${d.meters}m · BITS ${d.bits} · HIT ${d.hits}`,
    cx,
    1205,
  );

  // 날짜 / 태그
  const date = new Date(d.at);
  const ymd = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  g.font = `18px ${CARD_FONT}`;
  g.fillText(`#MSG #CTF #DINORUN   ${ymd}`, cx, 1280);
}
