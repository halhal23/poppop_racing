設計概要
- 目的: 2人限定の観戦型2Dオートレースを最短で動かすMVP。ブラウザ完結でレースロジックを回し、Canvasで可視化。バックエンドは将来拡張用の薄い枠のみ。
- スタック: Frontend = Next.js (App Router前提, CSRでCanvas描画), Backend = FastAPI, DB = SQLite（MVPでは未使用可）。

アーキテクチャ
- フロント: 単一ページにSetupフォームとCanvasレースビューを同居。状態をReact stateで管理（players, raceState: idle/running/finished, frame data）。
- バックエンド: FastAPIアプリ（/players GET/POST, /races/result POST をスタブ実装）。CORS許可。SQLite接続は起動時に初期化のみ。
- データフロー: ユーザー入力→React stateへ→「開始」でシミュレーション開始→requestAnimationFrameでロジック更新と描画→ゴールで勝者表示→再走可能。APIはオフラインでも動作する前提、送信は任意。

フロント詳細
- ページ: `/` に集約。セクション1: Player A/B 入力フォーム（数値入力orスライダー, 0–100）。セクション2: Canvas 2D表示 + ステータス表示 + 勝者表示 + 再走ボタン。
- コンポーネント例: PlayerForm({label, player, onChange}), RaceCanvas({players, raceState}), ControlBar({onStart, onReset, winner}).
- 状態管理: players: {accel, topSpeed, stamina, cornering, weight, luck}; raceState: idle/running/finished; simulationState: per-player dist, vel, staminaLeft, lapCount.
- キャンバス: トラック楕円 (cx, cy, rx, ry)。位置変換: θ = 2π * (d % L) / L, x = cx + rx cosθ, y = cy + ry sinθ。色はプレイヤーごとに固定。
- 描画ループ: requestAnimationFrame → ロジック更新 → Canvas描画。running時のみループ。

レースロジック（ブラウザ内）
- 定数: L = 400, laps = 3, dt = 1/60 想定（フレーム刻み）。contact_eps = 3 など。
- 速度モデル（簡易）:
  - v_max = topSpeed * corneringCoeff(曲率区間で 0.6–1.0 補正)
  - a_eff = accel - weightPenalty - fatiguePenalty
  - stamina減衰: staminaLeft を毎フレーム消費し、一定以下で v_max/accel を段階的に下げる
  - luckノイズ: v += randn * luckScale（小さめ）
  - v = clamp(v + a_eff*dt, 0, v_max)
  - dist += v*dt
- 接触: abs(distA - distB) < contact_eps → 劣勢側の v *= 0.7（cornering高で軽減、カーブ区間でペナルティ増）。
- ゴール: dist >= L * laps で finished。先着を勝者とする。

バックエンド（枠）
- エンドポイント:
  - GET /players: 保存済みプレイヤー一覧（MVPでは空配列返却で可）
  - POST /players: プレイヤー保存（MVPでは受信をそのまま返すダミー）
  - POST /races/result: 勝者やシードを受け取り200返却
- SQLiteテーブル案（任意）: players(id, name, accel, top_speed, stamina, cornering, weight, luck, created_at); races(id, winner_id, seed, created_at)。MVPではmigrationのみ/未使用でも可。

UXフロー
- idle: 初期ステータス入力可能。「レース開始」活性。
- running: 入力フォームはロック。Canvasで進行表示。ラップ/距離/速度を簡易表示。
- finished: 勝者テキスト表示。「再走」ボタンでstateリセット（入力値は保持）。

非目標（MVP外）
- トーナメント、複数レース管理、大量生成
- 正確な物理シミュレーションや高度なAI
- マルチプレイ/同期、サーバー側でのシミュレーション
- リッチなデータ永続化/過去リプレイ

検証・テスト最小
- フロント: 速度更新とゴール判定のユニット（演算関数）を1–2ケースで担保。ブラウザで手動確認（動く・勝者が出る・再走できる）。
- バックエンド: 起動確認と3エンドポイントの200レスポンス確認（curl/postman）。
