---
description: バージョンカウントアップ - 機能追加・修正のたびに実施
---

# バージョンカウントアップ手順

機能追加や修正を行った際、以下の3箇所のバージョン番号を更新する。

## バージョニングルール
- **パッチ (x.x.X)**: バグ修正、小さな調整
- **マイナー (x.X.0)**: 新機能追加、大きな修正
- **メジャー (X.0.0)**: 破壊的変更

## 更新箇所

1. **package.json** (`d:\app\bizflow-mobile\package.json`)
   - `"version"` フィールドを更新

2. **LoginPage.tsx** (`d:\app\bizflow-mobile\src\features\auth\LoginPage.tsx`)
   - ログイン画面下部のバージョン表示テキストを更新
   - 例: `v1.1.0 - Auth & Input Fixes` → `v1.2.0 - 新機能名`

3. **SettingsPage.tsx** (`d:\app\bizflow-mobile\src\pages\SettingsPage.tsx`)
   - 設定画面下部の `GANTACT vX.X.X` を更新

## コミット
// turbo
```
git add package.json src/features/auth/LoginPage.tsx src/pages/SettingsPage.tsx
git commit -m "chore: bump version to vX.X.X"
```
