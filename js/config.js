// 게임 밸런스/설정값. 숫자만 바꿔서 난이도를 조절할 수 있게 한 곳에 모아둔다.
const CONFIG = {
  // 화면 (논리 해상도, CSS로 정수배 확대)
  WIDTH: 800,
  HEIGHT: 260,
  GROUND_Y: 220,
  PLAYER_SCREEN_X: 110,

  // 코스: 모두 같은 시드 = 같은 맵 → 공정한 점수 경쟁
  COURSE_SEED: "MSG-2026",
  COURSE_METERS: 2500,
  PX_PER_METER: 10,
  START_RUNUP_PX: 500, // 시작선 이전 여유 구간

  // 속도 (px/s): 초반엔 천천히, 후반으로 갈수록 가파르게 빨라진다
  SPEED_START: 320,
  SPEED_END: 760,
  SPEED_CURVE: 1.6, // 1 = 일정하게 증가, 클수록 후반에 몰아서 빨라짐

  // 물리
  GRAVITY: 2400,
  JUMP_VELOCITY: 760,
  DOUBLE_JUMP_VELOCITY: 640,
  FAST_FALL: 3600,

  // 체력 (쿠키런식: 시간이 지나면 줄어든다)
  HP_MAX: 100,
  HP_DRAIN_PER_SEC: 0.7,
  HIT_DAMAGE: 15,
  INVINCIBLE_SEC: 1.2,

  // 점수
  SCORE: {
    BIT: 10,
    BIG_BIT: 50,
    SPECIAL: 500, // 분야별 특별 아이템
    FINISH: 2000,
    HP_LEFT: 20, // 남은 체력 1당
    NO_HIT: 1000, // 무피격 완주 보너스
  },

  // 공룡 = 분야. 고른 분야의 특별 아이템(img/item.png)만 코스에 등장한다.
  // 위치와 점수는 분야와 상관없이 같아서 어떤 공룡을 골라도 공정하다.
  DINOS: [
    { color: "red",    field: "PWN",      item: "bug" },
    { color: "blue",   field: "WEB",      item: "globe" },
    { color: "pink",   field: "FORENSIC", item: "magnifier" },
    { color: "green",  field: "CRYPTO",   item: "lock" },
    { color: "orange", field: "REV",      item: "wrench" },
  ],

  DINO_COLORS: ["red", "blue", "pink", "green", "orange"],
  DINO_HEX: { red: "#ec1c24", blue: "#0a8ce8", pink: "#ea3290", green: "#08bf51", orange: "#f8890d" },

  // 온라인 랭킹 (여러 PC 공유). null 이면 이 브라우저에만 저장.
  // Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) 의 firebaseConfig 를 그대로 붙여넣기.
  FIREBASE: {
    apiKey: "AIzaSyD4_AWyB3LGoYbVQDtQHKRwOQvrKhbn9FU",
    authDomain: "msg-dino-run.firebaseapp.com",
    projectId: "msg-dino-run",
    storageBucket: "msg-dino-run.firebasestorage.app",
    messagingSenderId: "92731486150",
    appId: "1:92731486150:web:6a30b749f77c7540188cc7",
  },

  INK: "#535353",
  BG: "#f7f7f7",
};
