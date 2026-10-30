// 랭킹/계정 저장소.
// CONFIG.FIREBASE 가 있으면 Firestore (여러 PC가 실시간 공유), 없으면 이 브라우저 localStorage.

const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2";

// 닉네임 = 사람. 대소문자는 구분하고 앞뒤 공백만 무시한다.
const nameKey = (name) => name.trim();
// Firestore 문서 id로 쓸 수 있게 ('/' 등 금지 문자 회피)
const docId = (name) => "n_" + encodeURIComponent(nameKey(name));

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.head.appendChild(s);
  });
}

function sortBoard(entries) {
  return entries.sort((a, b) => b.score - a.score || a.at - b.at);
}

// ---------- localStorage 백엔드 ----------

const LocalBackend = {
  boardKey: `msg-dino-run:board:${CONFIG.COURSE_SEED}`,
  accountsKey: "msg-dino-run:accounts",

  read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 불가 환경이면 생략
    }
  },

  async init(store) {
    store.accounts = this.read(this.accountsKey, {});
    // 이름당 최고 기록 하나만 남긴다
    const best = new Map();
    for (const e of this.read(this.boardKey, [])) {
      const k = nameKey(e.name);
      if (!best.has(k) || e.score > best.get(k).score) best.set(k, e);
    }
    store.board = sortBoard([...best.values()]);
  },

  async login(store, name, hash) {
    const saved = store.accounts[nameKey(name)];
    if (saved && saved !== hash) return "wrong";
    if (!saved) {
      store.accounts[nameKey(name)] = hash;
      this.write(this.accountsKey, store.accounts);
    }
    return "ok";
  },

  async submit(store, entry) {
    const prev = store.findRecord(entry.name);
    if (!prev || entry.score > prev.score) {
      store.board = sortBoard([...store.board.filter((e) => e !== prev), entry]);
      this.write(this.boardKey, store.board);
    }
    return prev || null;
  },
};

// ---------- Firestore 백엔드 ----------

const FirebaseBackend = {
  async init(store) {
    await loadScript(`${FIREBASE_SDK}/firebase-app-compat.js`);
    await loadScript(`${FIREBASE_SDK}/firebase-firestore-compat.js`);
    firebase.initializeApp(CONFIG.FIREBASE);
    this.db = firebase.firestore();
    this.accounts = this.db.collection("accounts");
    this.scores = this.db.collection(`scores-${CONFIG.COURSE_SEED}`);

    // 두 컬렉션을 실시간 구독해서 메모리에 캐시 → 화면은 캐시만 보고 즉시 그린다
    const first = (col, apply) =>
      new Promise((resolve, reject) => {
        col.onSnapshot(
          (snap) => {
            if (store.backend !== FirebaseBackend) return; // 연결 실패로 로컬 모드 전환된 뒤 늦게 온 응답
            apply(snap);
            store.onChange();
            resolve();
          },
          (err) => {
            console.error(err);
            reject(err);
          }
        );
      });
    await Promise.all([
      first(this.accounts, (snap) => {
        store.accounts = {};
        snap.forEach((d) => (store.accounts[nameKey(d.data().name)] = d.data().hash));
      }),
      first(this.scores, (snap) => {
        store.board = sortBoard(snap.docs.map((d) => d.data()));
      }),
    ]);
  },

  // 두 PC에서 같은 새 닉네임을 동시에 만들어도 한 명만 등록되도록 트랜잭션
  login(store, name, hash) {
    const ref = this.accounts.doc(docId(name));
    return this.db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) {
        t.set(ref, { name: nameKey(name), hash });
        return "ok";
      }
      return snap.data().hash === hash ? "ok" : "wrong";
    });
  },

  submit(store, entry) {
    const ref = this.scores.doc(docId(entry.name));
    return this.db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const prev = snap.exists ? snap.data() : null;
      if (!prev || entry.score > prev.score) t.set(ref, entry);
      return prev;
    });
  },
};

// ---------- 공통 인터페이스 ----------

const Store = {
  board: [], // 이름당 최고 기록, 점수순
  accounts: {}, // 닉네임 -> 비밀번호 해시
  online: false,
  onChange: () => {},

  init(onChange) {
    this.onChange = onChange;
    this.backend = CONFIG.FIREBASE ? FirebaseBackend : LocalBackend;
    // 연결이 끝나기 전에 START를 눌러도 기다렸다가 처리되도록
    this.ready = this.backend.init(this).then(() => (this.online = this.backend === FirebaseBackend));
    return this.ready;
  },

  // 온라인 연결 실패 시 이 브라우저 저장으로 전환
  async fallbackToLocal() {
    this.backend = LocalBackend;
    this.online = false;
    this.ready = LocalBackend.init(this);
    await this.ready;
  },

  findRecord(name) {
    return this.board.find((e) => nameKey(e.name) === nameKey(name));
  },

  hasAccount(name) {
    return Boolean(this.accounts[nameKey(name)]);
  },

  // "ok" | "wrong" (비밀번호 틀림). 새 닉네임이면 등록까지 한다.
  async login(name, hash) {
    await this.ready;
    return this.backend.login(this, name, hash);
  },

  // 최고 기록이면 갱신. 이전 최고 기록(없으면 null)을 돌려준다.
  async submit(entry) {
    await this.ready;
    return this.backend.submit(this, entry);
  },
};
