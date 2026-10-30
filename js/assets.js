// 이미지 로딩 + 코드로 그리는 픽셀아트(선인장, 익룡, 방화벽, 구름, 비트 글자).

const Sprites = {};

function loadSprites() {
  const names = [];
  for (const c of CONFIG.DINO_COLORS) {
    for (const suffix of ["", "_run1", "_run2", "_crouch", "_slide"]) names.push(`dino_${c}${suffix}`);
  }
  for (const d of CONFIG.DINOS) names.push(`item_${d.item}`);

  return Promise.all(
    names.map(
      (name) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            Sprites[name] = img;
            resolve();
          };
          img.onerror = () => reject(new Error(`스프라이트 로드 실패: ${name}`));
          img.src = `assets/sprites/${name}.png`;
        })
    )
  );
}

// 문자열 배열 픽셀아트 → 오프스크린 캔버스
function pixelArt(rows, unit, color) {
  const c = document.createElement("canvas");
  c.width = rows[0].length * unit;
  c.height = rows.length * unit;
  const g = c.getContext("2d");
  g.fillStyle = color;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") g.fillRect(x * unit, y * unit, unit, unit);
    });
  });
  return c;
}

const CACTUS_SMALL = [
  "..##...",
  "..##...",
  "..##.#.",
  "#.##.#.",
  "#.##.#.",
  "#.##.#.",
  "#.####.",
  "#.##...",
  "####...",
  "..##...",
  "..##...",
  "..##...",
  "..##...",
  "..##...",
  "..##...",
  "..##...",
];

const PTERO_UP = [
  ".....#..........",
  ".....##.........",
  ".....###........",
  ".....####.......",
  "..##.#####......",
  ".###########....",
  "#############...",
  "....##########..",
  ".....#######....",
];

const PTERO_DOWN = [
  "................",
  "................",
  "................",
  "................",
  "..##............",
  ".###########....",
  "#############...",
  "....##########..",
  ".....######.....",
  ".....####.......",
  ".....###........",
  ".....##.........",
  ".....#..........",
];

const CLOUD = [
  "..........####........",
  "........##....##......",
  "....####........#.....",
  "...#.............###..",
  "..#..................#",
  "######################",
];

// 3x5 숫자 글꼴 (비트 0/1)
const GLYPH = {
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
};

function buildArt() {
  const ink = CONFIG.INK;
  Sprites.cactusSmall = pixelArt(CACTUS_SMALL, 2, ink);
  Sprites.cactusLarge = pixelArt(CACTUS_SMALL, 3, ink);
  Sprites.pteroUp = pixelArt(PTERO_UP, 3, ink);
  Sprites.pteroDown = pixelArt(PTERO_DOWN, 3, ink);
  Sprites.cloud = pixelArt(CLOUD, 2, "#d6d6d6");
  Sprites.bit0 = pixelArt(GLYPH[0], 3, ink);
  Sprites.bit1 = pixelArt(GLYPH[1], 3, ink);
  Sprites.bigBit = pixelArt(GLYPH[1], 4, "#f0a020");
  Sprites.bit0Small = pixelArt(GLYPH[0], 2, ink);
  Sprites.bit1Small = pixelArt(GLYPH[1], 2, ink);
  Sprites.firewall = buildFirewall(36, 130);
}

// 방화벽: 벽돌 패턴 벽 (2단 점프 필요)
function buildFirewall(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = CONFIG.INK;
  g.fillRect(0, 0, w, h);
  g.fillStyle = CONFIG.BG;
  const bh = 10;
  for (let y = 0; y < h; y += bh) {
    g.fillRect(2, y + bh - 2, w - 4, 2);
    const off = (y / bh) % 2 === 0 ? 0 : 9;
    for (let x = off + 2; x < w - 2; x += 18) g.fillRect(x, y, 2, bh - 2);
  }
  // 불꽃 장식
  g.fillStyle = "#e8541a";
  for (let x = 2; x < w - 2; x += 8) g.fillRect(x, 0, 4, 4);
  return c;
}
