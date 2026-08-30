---
title: 【Blender】メモリクラッシュとの戦い — bm.clear() は bm.free() にすべき
date: 2026-08-30 18:00:00
tags:
  - Blender
  - Tips
categories:
  - 技術メモ
cover: /img/cover-alt.png
---

Blender 4.5 LTS を使っていて、特定の操作でクラッシュする問題に悩まされていました。
原因を特定できたので、同じ問題に遭遇した人のためにメモを残します。

## 症状

MACHIN3tools の特定のオペレーター実行後、**Undo（Ctrl+Z）時に Blender がクラッシュ**する。

## 原因

`bm.clear()` を呼び出した場合、**ジオメトリデータはクリアされるが BMesh オブジェクト自体は解放されない**。
残った BMesh は Python のガベージコレクションに回収を任されるのですが、このとき **C 側のポインタはすでに無効**になっているため、GC が走った瞬間にダングリングポインタアクセスでクラッシュします。

## 解決策

```python
# ❌ 悪い例 — クラッシュの原因
bm.clear()

# ✅ 良い例 — メモリを確実に解放
bm.free()
```

`bm.clear()` はジオメトリだけ消して BMesh を保持したい場合に使うもの。
**使い終わった BMesh は必ず `bm.free()` で解放**しましょう。

## まとめ

| メソッド | 動作 | 使いどころ |
| --- | --- | --- |
| `bm.clear()` | ジオメトリ削除、BMesh は存続 | BMesh を再利用する場合 |
| `bm.free()` | BMesh 自体を解放 | 使い終わったら必ず呼ぶ |

この修正で MACHIN3tools の `utils/mesh.py` と `ui/operators/shade.py` を直して以来、クラッシュは一度も起きていません。

---

*中文说明：Blender 4.5 LTS 中，`bm.clear()` 只清空几何数据但不释放 BMesh 对象，残留对象被 Python GC 回收时会触发悬空指针导致崩溃。改用 `bm.free()` 即可根治。*
