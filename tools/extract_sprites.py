"""img/ 의 원본 시트에서 개별 스프라이트를 잘라 assets/sprites/ 에 저장한다.

원본 이미지가 확대+블러된 픽셀아트라서, 각 스프라이트를 잘라낸 뒤
목표 높이로 축소하고 색을 단일 톤으로 정리해 선명한 픽셀아트로 만든다.

사용법: python3 tools/extract_sprites.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "img"
OUT = ROOT / "assets" / "sprites"

COLORS = ["red", "blue", "pink", "green", "orange"]
ITEMS = ["bug", "globe", "magnifier", "lock", "wrench"]


def ink_mask(im):
    """배경(흰색/투명)이 아닌 픽셀이면 True."""
    px = im.load()
    w, h = im.size
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if min(r, g, b) < 200:
                mask[y][x] = True
    return mask


def segments(mask, min_gap=6):
    """빈 열로 구분되는 가로 구간들을 찾는다."""
    h, w = len(mask), len(mask[0])
    cols = [any(mask[y][x] for y in range(h)) for x in range(w)]
    segs, start, gap = [], None, 0
    for x, c in enumerate(cols):
        if c:
            if start is None:
                start = x
            gap = 0
            end = x
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                segs.append((start, end))
                start = None
    if start is not None:
        segs.append((start, end))
    return segs


def crop_segment(im, mask, x0, x1):
    h = len(mask)
    rows = [y for y in range(h) if any(mask[y][x] for x in range(x0, x1 + 1))]
    return im.crop((x0, rows[0], x1 + 1, rows[-1] + 1))


def pixelize(crop, target_h, mono=None, ink=175):
    """목표 높이로 축소 후 알파 이진화 + 단일색 정리."""
    w, h = crop.size
    tw = max(1, round(w * target_h / h))
    small = crop.convert("RGBA").resize((tw, target_h), Image.BOX)
    px = small.load()
    # 대표색: 가장 진한 픽셀들의 평균
    inks = []
    for y in range(target_h):
        for x in range(tw):
            r, g, b, a = px[x, y]
            if a > 128 and min(r, g, b) < 170:
                inks.append((r, g, b))
    if mono is None:
        if not inks:
            mono = (83, 83, 83)
        else:
            sat = sorted(inks, key=lambda c: max(c) - min(c), reverse=True)[: max(1, len(inks) // 3)]
            mono = tuple(sum(c[i] for c in sat) // len(sat) for i in range(3))
    out = Image.new("RGBA", (tw, target_h), (0, 0, 0, 0))
    op = out.load()
    for y in range(target_h):
        for x in range(tw):
            r, g, b, a = px[x, y]
            if a > 128 and min(r, g, b) < ink:
                op[x, y] = (*mono, 255)
    return out


def extract(name, labels, target_h, mono=None, suffix="", ink=175):
    im = Image.open(SRC / f"{name}.png").convert("RGBA")
    mask = ink_mask(im)
    segs = segments(mask)
    if len(segs) != len(labels):
        raise SystemExit(f"{name}: {len(segs)}개 구간 발견 (기대 {len(labels)}) -> {segs}")
    for (x0, x1), label in zip(segs, labels):
        sprite = pixelize(crop_segment(im, mask, x0, x1), target_h, mono, ink)
        path = OUT / f"{label}{suffix}.png"
        sprite.save(path)
        print(f"{path.relative_to(ROOT)}  {sprite.size}")


def make_run_frames(color):
    """서 있는 스프라이트에서 다리를 하나씩 들어 올린 달리기 2프레임을 만든다."""
    base = Image.open(OUT / f"dino_{color}.png")
    w, h = base.size
    mid = w * 9 // 22  # 왼다리 / 오른다리 경계
    for i, erase_left in enumerate((True, False), start=1):
        frame = base.copy()
        px = frame.load()
        for y in range(h - 3, h):
            for x in range(w):
                if (x < mid) == erase_left:
                    px[x, y] = (0, 0, 0, 0)
        frame.save(OUT / f"dino_{color}_run{i}.png")


def to_rows(path):
    im = Image.open(path)
    w, h = im.size
    px = im.load()
    return ["".join("#" if px[x, y][3] else "." for x in range(w)) for y in range(h)]


def write_sprite_data():
    """카드 이미지용: 스프라이트를 JS 문자열 배열로 내보낸다.
    (file:// 에서 이미지를 캔버스에 그리면 저장이 막혀서, 픽셀을 코드로 직접 그린다)"""
    lines = ["// tools/extract_sprites.py 가 생성한 파일. 직접 수정하지 마세요.", "const DINO_ART = {"]
    for c in COLORS:
        lines.append(f"  {c}: {to_rows(OUT / f'dino_{c}.png')!r},".replace("'", '"'))
    lines.append("};")
    lines.append("const ITEM_ART = {")
    for n in ITEMS:
        lines.append(f"  {n}: {to_rows(OUT / f'item_{n}.png')!r},".replace("'", '"'))
    lines.append("};")
    path = ROOT / "js" / "sprite-data.js"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(path.relative_to(ROOT))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    extract("dino", [f"dino_{c}" for c in COLORS], 24)
    for c in COLORS:
        make_run_frames(c)
    extract("dino_slide1", [f"dino_{c}" for c in COLORS], 15, suffix="_crouch")
    extract("dino_slide2", [f"dino_{c}" for c in COLORS], 11, suffix="_slide")
    # 아이템은 선이 얇아서 조금 크게 + 임계값을 느슨하게
    extract("item", [f"item_{n}" for n in ITEMS], 22, mono=(32, 32, 32), ink=215)
    write_sprite_data()
