# PopPop Racing

2人限定の観戦型2DオートレースMVPです。ブラウザ上でプレイヤーのステータスを設定し、Canvasでレース進行を可視化します。レースロジックはフロントエンド内で完結します。

## 機能
- 2人分のステータス入力（0–100）
- Canvas上で楕円トラックとレーサー描画
- requestAnimationFrameによるリアルタイムレース進行
- 勝者表示と再走

## 技術スタック
- Next.js (App Router)
- React
- TypeScript
- HTML Canvas

## セットアップ

```bash
npm install
```

## 開発起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

## スクリプト
- `npm run dev` : 開発サーバー起動
- `npm run build` : 本番ビルド
- `npm run start` : 本番サーバー起動

## 画面構成
- `/` にUIを集約
  - Player Setup: ステータス入力とレース開始
  - Race View: Canvas表示、勝者、ステータス

## レース仕様（簡易）
- 周回トラック：1周 L=400、3周
- 速度モデル：
  - topSpeed / accel / stamina / cornering / weight / luck を利用
  - カーブ時に cornering 補正
  - stamina 低下で vMax/accel が減衰
- 接触判定：距離が近いときに減速ペナルティ

## ディレクトリ構成（主要）
- `app/page.tsx` : UIとレースロジック
- `app/layout.tsx` : ルートレイアウト
- `app/globals.css` : 全体スタイル

## 目的
最短で「動く」MVPを構築し、レース体験の検証を優先します。

## ライセンス
未設定
