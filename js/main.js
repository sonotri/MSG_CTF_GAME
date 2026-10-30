// 엔트리 포인트: 에셋 로드 → 타이틀 화면 → 루프 시작.

(async function main() {
  try {
    await Promise.all([loadSprites(), document.fonts.load('10px "Press Start 2P"').catch(() => {}), document.fonts.load('10px "Galmuri11"', "가").catch(() => {})]);
  } catch (err) {
    document.body.insertAdjacentHTML("afterbegin", `<p class="error">${err.message}</p>`);
    return;
  }
  buildArt();
  resetGame(); // 타이틀 뒤에 코스 미리보기
  UI.init();
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("온라인 랭킹 응답 없음")), 8000));
    await Promise.race([Store.init(() => UI.refreshBoards()), timeout]);
  } catch (err) {
    // 온라인 랭킹 연결 실패 → 이 브라우저에만 저장하며 계속 진행
    console.error(err);
    await Store.fallbackToLocal();
    document.body.insertAdjacentHTML("afterbegin", `<p class="error banner">온라인 랭킹 연결 실패 · 이 PC에만 저장됩니다</p>`);
  }
  UI.showTitle();
  requestAnimationFrame(frame);
})();
