// 시드 기반 코스 생성기. 같은 시드면 누구나 같은 맵을 달린다.

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speedAt(worldX, course) {
  const p = Math.min(1, Math.max(0, (worldX - course.startX) / (course.finishX - course.startX)));
  return CONFIG.SPEED_START + (CONFIG.SPEED_END - CONFIG.SPEED_START) * Math.pow(p, CONFIG.SPEED_CURVE);
}

// 비트로 글자를 그리는 5줄 픽셀 글꼴
const LETTERS = {
  A: [".##.", "#..#", "####", "#..#", "#..#"],
  C: ["####", "#...", "#...", "#...", "####"],
  D: ["###.", "#..#", "#..#", "#..#", "###."],
  E: ["####", "#...", "###.", "#...", "####"],
  F: ["####", "#...", "###.", "#...", "#..."],
  G: ["####", "#...", "#.##", "#..#", "####"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#"],
  O: ["####", "#..#", "#..#", "#..#", "####"],
  S: ["####", "#...", "####", "...#", "####"],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
};

// 비트로 그리는 공룡 (스프라이트를 절반으로 줄인 모양). 머리는 2단 점프해야 닿는다.
const DINO_BITS = [
  "......#####",
  ".....#.####",
  ".....######",
  ".....###...",
  "#....#####.",
  "#..#####.#.",
  "########...",
  "########...",
  ".######....",
  "..####.....",
  "..##.#.....",
  "..##.##....",
];

function generateCourse(seed) {
  const rand = mulberry32(hashString(seed));
  const between = (a, b) => a + rand() * (b - a);

  const G = CONFIG.GROUND_Y;
  const startX = CONFIG.START_RUNUP_PX;
  const finishX = startX + CONFIG.COURSE_METERS * CONFIG.PX_PER_METER;
  const course = { seed, startX, finishX, obstacles: [], pickups: [], pits: [] };

  const addBit = (x, y, big = false, small = false) =>
    course.pickups.push({ kind: big ? "bigBit" : "bit", glyph: course.pickups.length % 2, small, x, y, taken: false });

  const addObstacle = (type, x, y, w, h, hit) => course.obstacles.push({ type, x, y, w, h, hit });

  // 점프 궤적을 따라 비트를 배치 (장애물 중심 위로 포물선)
  const bitArc = (centerX, n = 9) => {
    const v = speedAt(centerX, course);
    const T = (2 * CONFIG.JUMP_VELOCITY) / CONFIG.GRAVITY;
    const x0 = centerX - (v * T) / 2;
    for (let i = 0; i < n; i++) {
      const t = (T * i) / (n - 1);
      const h = CONFIG.JUMP_VELOCITY * t - (CONFIG.GRAVITY * t * t) / 2;
      addBit(x0 + v * t, G - 34 - h, i === Math.floor(n / 2) && rand() < 0.25);
    }
  };

  const bitLine = (x, n, y = G - 24, gap = 28) => {
    for (let i = 0; i < n; i++) addBit(x + i * gap, y);
    return n * gap;
  };

  const patterns = {
    bits: (x) => bitLine(x, 5 + Math.floor(rand() * 6)),

    cactus: (x) => {
      const s = Sprites.cactusSmall;
      addObstacle("cactusSmall", x, G - s.height, s.width, s.height, 3);
      bitArc(x + s.width / 2);
      return s.width;
    },

    cactusGroup: (x) => {
      const s = Sprites.cactusSmall;
      const n = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) addObstacle("cactusSmall", x + i * (s.width + 2), G - s.height, s.width, s.height, 3);
      const w = n * (s.width + 2);
      bitArc(x + w / 2, 10);
      return w;
    },

    cactusLarge: (x) => {
      const s = Sprites.cactusLarge;
      addObstacle("cactusLarge", x, G - s.height, s.width, s.height, 4);
      bitArc(x + s.width / 2);
      return s.width;
    },

    ptero: (x) => {
      const s = Sprites.pteroUp;
      const top = G - 26 - s.height;
      addObstacle("ptero", x, top, s.width, s.height, { x: 3, y: 12, w: s.width - 6, h: 15 });
      // 슬라이드하면 먹을 수 있는 낮은 비트
      bitLine(x - 40, 5, G - 12, 26);
      return s.width;
    },

    pit: (x) => {
      const w = between(90, 150);
      course.pits.push({ x, w });
      bitArc(x + w / 2);
      return w;
    },

    firewall: (x) => {
      const s = Sprites.firewall;
      addObstacle("firewall", x, G - s.height, s.width, s.height, 2);
      // 2단 점프 높이에 보상 비트
      for (let i = 0; i < 4; i++) addBit(x - 20 + i * 26, G - s.height - 30, i === 1);
      return s.width;
    },

    // ---- 어려운 조합 ----

    // 익룡 두 마리 연속: 슬라이드를 길게 유지
    pteroPair: (x) => {
      const w = patterns.ptero(x);
      return w + 70 + patterns.ptero(x + w + 70);
    },

    // 슬라이드 → 바로 점프
    slideJump: (x) => {
      const w = patterns.ptero(x);
      const gap = speedAt(x, course) * 0.55 + 60;
      return w + gap + patterns.cactus(x + w + gap);
    },

    // 점프 → 착지하자마자 슬라이드
    jumpSlide: (x) => {
      const w = patterns.cactus(x);
      const v = speedAt(x, course);
      const gap = (v * (2 * CONFIG.JUMP_VELOCITY)) / CONFIG.GRAVITY / 2 + 100;
      return w + gap + patterns.ptero(x + w + gap);
    },

    // 고인물 구간: 익룡 사이에 특별 아이템. 슬라이드 → 잠깐 일어나서 먹기 → 다시 슬라이드
    pteroTrap: (x) => {
      const w = patterns.ptero(x);
      const gap = 150 + speedAt(x, course) * 0.15;
      course.pickups.push({ kind: "item", x: x + w + gap / 2, y: G - 40, taken: false });
      return w + gap + patterns.ptero(x + w + gap);
    },

    // 넓은 구덩이: 한 번 점프로는 모자라서 2단 점프 필요
    pitWide: (x) => {
      const v = speedAt(x, course);
      const w = (v * (2 * CONFIG.JUMP_VELOCITY)) / CONFIG.GRAVITY + between(20, 70);
      course.pits.push({ x, w });
      bitLine(x + 30, Math.floor((w - 40) / 30), G - 150, 30);
      return w;
    },

    // 방화벽 넘고 바로 선인장
    firewallCactus: (x) => {
      const w = patterns.firewall(x);
      const gap = speedAt(x, course) * 0.75 + 80;
      return w + gap + patterns.cactus(x + w + gap);
    },
  };

  // 진행도별 등장 가중치 [초반, 후반]
  const weights = {
    bits: [4, 1],
    cactus: [5, 2],
    cactusGroup: [1, 3],
    cactusLarge: [1, 2],
    ptero: [2, 2],
    pit: [1, 2],
    firewall: [1, 2],
    pteroPair: [0, 2],
    slideJump: [0, 2.5],
    jumpSlide: [0, 2.5],
    pitWide: [0, 2],
    firewallCactus: [0, 2],
  };

  const choosePattern = (p) => {
    const entries = Object.entries(weights).map(([k, [a, b]]) => [k, a + (b - a) * p]);
    let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) {
      if ((r -= w) <= 0) return k;
    }
    return "bits";
  };

  // 비트 그림: 점프 타이밍을 잘 맞춰야 많이 먹을 수 있는 보너스 구간
  const bitArt = (x, rows, cell, small = false) => {
    rows.forEach((row, r) => {
      [...row].forEach((c, i) => {
        if (c === "#") addBit(x + i * cell, G - 22 - (rows.length - 1 - r) * cell, false, small);
      });
    });
    return rows[0].length * cell;
  };
  const WORD_CELL = 26; // 5줄 x 26px ≈ 1단 점프 최고점
  const bitWord = (x, word) => {
    let w = 0;
    for (const ch of word) w += bitArt(x + w, LETTERS[ch], WORD_CELL) + WORD_CELL;
    return w - WORD_CELL;
  };
  const bonuses = [
    { at: 0.12, draw: (x) => bitWord(x, "MSG") },
    { at: 0.27, draw: (x) => bitArt(x, DINO_BITS, 13, true) },
    { at: 0.34, draw: (x) => patterns.pteroTrap(x) },
    { at: 0.42, draw: (x) => bitWord(x, "CTF") },
    { at: 0.58, draw: (x) => bitWord(x, "DINO") },
    { at: 0.66, draw: (x) => patterns.pteroTrap(x) },
    { at: 0.72, draw: (x) => bitArt(x, DINO_BITS, 13, true) },
    { at: 0.86, draw: (x) => bitWord(x, "GAME") },
    { at: 0.93, draw: (x) => patterns.pteroTrap(x) },
  ];

  // 특별 아이템: 위치는 모두 같고, 모양은 고른 공룡 분야에 따라 그려진다
  let nextItemX = startX + 1200;

  let x = startX + 400;
  while (x < finishX - 500) {
    const p = (x - startX) / (finishX - startX);
    const v = speedAt(x, course);
    if (bonuses.length && p >= bonuses[0].at) {
      x += bonuses.shift().draw(x + 150) + 150;
    } else {
      x += patterns[choosePattern(p)](x);
    }
    // 다음 패턴까지 최소 간격: 착지 후 반응할 시간 확보
    x += v * between(0.55, 1.0 - 0.35 * p) + 90;

    if (x > nextItemX && x < finishX - 800) {
      const high = rand() < 0.5;
      course.pickups.push({ kind: "item", x, y: high ? G - 110 : G - 40, taken: false });
      x += 120;
      nextItemX = x + between(1500, 2600);
    }
  }

  return course;
}
