// 엔트리 포인트: 에셋 로드 → 타이틀 화면 → 루프 시작.

(async function main() {
  try {
    await Promise.all([loadSprites(), document.fonts.load('10px "Press Start 2P"').catch(() => {})]);
  } catch (err) {
    document.body.insertAdjacentHTML("afterbegin", `<p class="error">${err.message}</p>`);
    return;
  }
  buildArt();
  resetGame(); // 타이틀 뒤에 코스 미리보기
  UI.init();
  UI.showTitle();
  requestAnimationFrame(frame);
})();
