# 領収書OCR Webアプリケーション

ブラウザ内で完全に動作する日本語領収書OCRアプリケーション。PaddleOCR ONNXモデルとWebAssembly推論を使用して、日本の領収書から構造化データを抽出します。

## 特徴

- **完全クライアントサイド**: サーバー通信不要
- **日本語特化**: 日本語テキストとビジネス形式に最適化
- **モバイルファースト**: スマートフォンカメラ撮影向け設計
- **プライバシーファースト**: すべての処理がブラウザ内でローカル実行

## 技術スタック

- React + TypeScript
- Vite (ビルドツール)
- onnxruntime-web (ONNX推論)
- PaddleOCR ONNXモデル
- IndexedDB (ローカルストレージ)

## セットアップ

1. 依存関係のインストール:
```bash
npm install
```

2. PaddleOCR ONNXモデルを `public/models/` ディレクトリに配置:
   - `det_model.onnx` (検出モデル)
   - `rec_model.onnx` (認識モデル)

3. 開発サーバーの起動:
```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## プロジェクト構造

```
src/
├── components/     # UIコンポーネント
├── engines/        # コア処理モジュール
├── types/          # TypeScript型定義
├── utils/          # ヘルパー関数
└── App.tsx         # メインアプリケーション
```

## 使用方法

1. カメラまたはファイル選択で領収書画像を取得
2. 自動OCR処理で構造化データを抽出
3. 必要に応じて手動で領域選択して再OCR
4. データを確認・編集して保存
5. JSON/CSV形式でエクスポート