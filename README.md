# MSG DINO RUN

크롬 공룡 그래픽 + 쿠키런식 아이템/체력/정해진 코스를 섞은 달리기 게임.

## 실행

`index.html`을 브라우저로 바로 열면 됩니다. 빌드 과정은 없습니다.

## 조작

| 동작 | 키보드 | 모바일 |
| --- | --- | --- |
| 점프 / 2단 점프 | `Space`, `↑`, `W` | JUMP 버튼 |
| 슬라이드 (공중에서는 급강하) | `↓`, `S` 꾹 누르기 | SLIDE 버튼 |

## 규칙

- 코스는 **시드 고정**(`CONFIG.COURSE_SEED`)이라 모든 참가자가 같은 맵을 달립니다.
- 체력은 시간이 지날수록 줄어들고, 장애물에 부딪히면 크게 깎입니다. 0이 되면 SYSTEM DOWN.
- 구덩이에 빠지면 즉시 게임 오버 (FALL DOWN).
- 코스 중간중간 비트로 `MSG` `CTF` `DINO` `GAME` 글자와 공룡 그림이 그려져 있습니다. 점프 타이밍을 잘 맞추면 많이 먹을 수 있습니다 (공룡 머리는 2단 점프).
- 속도는 초반엔 느리고 후반으로 갈수록 가파르게 빨라집니다 (`SPEED_START`, `SPEED_END`, `SPEED_CURVE`).
- 최종 점수 = 비트/아이템 점수 + 완주 보너스 + 남은 체력 보너스 + 무피격 보너스

| 장애물 | 피하는 법 |
| --- | --- |
| 선인장 (작은/큰/무리) | 점프 |
| 익룡 | 슬라이드 (아래쪽 비트도 먹을 수 있음) |
| 구덩이 | 점프 |
| 방화벽 | 2단 점프 |
| 넓은 구덩이 | 2단 점프 |
| 연속 조합 (익룡 2마리, 슬라이드→점프, 점프→슬라이드, 방화벽→선인장) | 후반에 자주 등장 |
| 고인물 구간 (익룡 사이 특별 아이템) | 슬라이드 → 잠깐 일어나 아이템 → 다시 슬라이드 |

## 공룡 = 분야

타이틀에서 ◀ ▶ (또는 ← →)로 고릅니다. 고른 분야의 특별 아이템만 코스에 나옵니다 (+500점).
아이템 위치와 점수는 모두 같아서 어떤 공룡을 골라도 공정합니다.

| 공룡 | 분야 | 특별 아이템 |
| --- | --- | --- |
| 빨강 | PWN | 버그 |
| 파랑 | WEB | 지구본 |
| 분홍 | FORENSIC | 돋보기 |
| 초록 | CRYPTO | 자물쇠 |
| 주황 | REV | 렌치 |

매핑은 `js/config.js`의 `DINOS`에서 바꿀 수 있습니다.

## 온라인 랭킹 (PC 여러 대)

`js/config.js`의 `FIREBASE`가 `null`이면 랭킹은 그 브라우저에만 저장됩니다. 여러 PC가 랭킹을 공유하려면:

1. https://console.firebase.google.com 에서 프로젝트 생성 (Google 애널리틱스는 꺼도 됨)
2. 빌드 → Firestore Database → 데이터베이스 만들기 (위치 `asia-northeast3` 서울, 프로덕션 모드)
3. Firestore → 규칙 탭에 `firestore.rules` 내용을 붙여넣고 게시
4. 프로젝트 설정(톱니) → 내 앱 → 웹(`</>`) 앱 추가 → 나오는 `firebaseConfig`를 `CONFIG.FIREBASE`에 붙여넣기

연결이 안 되면 화면 위에 빨간 안내가 뜨고 그 PC에만 저장하며 계속 진행합니다.
테스트 기록을 지우려면 Firestore 콘솔에서 `scores-MSG-2026` 컬렉션을 삭제하거나 `COURSE_SEED`를 바꾸면 됩니다.

## 결과 카드 (인스타용)

게임이 끝나면 결과 화면에 QR이 뜹니다. 폰으로 찍으면 `card.html`이 열리고, 고른 공룡(선글라스 착용, 1등은 왕관), 닉네임, 점수, 순위가 담긴 1080x1350 카드를 저장하거나 공유할 수 있습니다.
점수 정보는 QR 주소 안에 들어 있어서 서버 저장소가 필요 없고, QR 주소는 게임이 떠 있는 사이트 기준으로 자동으로 만들어집니다.
`index.html`을 파일로 바로 열면(file://) 폰이 접근할 수 없어서 QR 대신 PC 저장 버튼만 동작합니다.

## 구조

```
index.html          화면 레이아웃 (타이틀 / 결과 오버레이)
css/style.css
js/config.js        밸런스 수치 전부 (속도, 체력, 점수, 코스 길이/시드)
js/assets.js        스프라이트 로드 + 코드로 그리는 픽셀아트 (선인장, 익룡, 방화벽 등)
js/course.js        시드 기반 코스 생성 (장애물 패턴, 비트 배치, 아이템)
js/game.js          게임 루프, 물리, 충돌, 렌더링, HUD
js/ui.js            타이틀/결과 화면, 로컬 랭킹 (localStorage), 닉네임+비밀번호
js/store.js         랭킹/계정 저장 (Firestore 또는 localStorage)
js/card.js          결과 카드 그리기 + QR용 데이터 인코딩
js/sprite-data.js   카드용 픽셀 데이터 (extract_sprites.py가 생성)
js/vendor/qrcode.js QR 생성 라이브러리 (MIT, Kazuhiko Arase)
card.html           QR로 여는 카드 저장 페이지
firestore.rules     Firestore 보안 규칙 (점수는 오를 때만 갱신)
js/main.js          진입점
tools/extract_sprites.py   img/ 원본 → assets/sprites/ 개별 스프라이트
```

`img/`의 원본 그림을 바꾸면 `python3 tools/extract_sprites.py`로 스프라이트를 다시 만드세요 (Pillow 필요).
