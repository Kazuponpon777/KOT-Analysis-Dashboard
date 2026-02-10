# KING OF TIME Analysis App

KING OF TIMEの勤怠データを分析・可視化するWebアプリケーション。

## プロジェクト構成
- `client/`: フロントエンド (React + Vite)
- `server/`: バックエンド (Express API Proxy)

## セットアップと起動方法

### 前提条件
- Node.js (v18以上推奨)
- KOT APIキーの設定 (server/.env)

### 1. 依存関係のインストール

```bash
# クライアント
cd client
npm install

# サーバー
cd ../server
npm install
```

### 2. アプリケーションの起動

ターミナルを2つ開き、それぞれで以下を実行してください。

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
# ポート3001で起動します
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
# ポート5173で起動します (http://localhost:5173)
```

## 注意事項: API接続について
現在、提供されたAPIキーを使用すると `403 Forbidden` エラーが発生します。
`server/.env` にAPIキーは設定済みですが、KOT管理画面での以下の確認が必要です：
1. **IPアドレス制限**: 現在の接続元IPアドレスが許可されているか。
2. **トークン有効期限**: トークンが正しく発行・有効化されているか。

API接続が成功すると、`http://localhost:3001/api/health` などのエンドポイントが正常に応答します。
