# 技術スタック

## コア技術

- **フロントエンドフレームワーク**: React/Vue.js SPA（シングルページアプリケーション）
- **OCRエンジン**: onnxruntime-webを使用したPaddleOCR ONNXモデル
- **ランタイム**: 推論用WebAssembly（WASM）
- **ストレージ**: ローカルデータ永続化用IndexedDB
- **ビルドシステム**: モダンJavaScriptバンドラー（Webpack/Vite推奨）

## 主要依存関係

- `onnxruntime-web`: ブラウザ内でのONNXモデル推論
- PaddleOCR日本語軽量ONNXモデル:
  - 検出モデル（`det_model.onnx`）
  - 認識モデル（`rec_model.onnx`）
- 画像処理用Canvas API
- カメラ/ファイル入力用File API

## 開発ガイドライン

### コードスタイル
- 型安全性のためTypeScriptを使用
- OCR失敗に対する適切なエラーバウンダリを実装
- モデル読み込みと推論にasync/awaitパターンを使用
- 大きな画像処理に対する適切なメモリ管理

### パフォーマンス考慮事項
- 初期バンドルサイズを削減するためONNXモデルを遅延読み込み
- 処理時間最適化のためOCR前に画像リサイズを実装
- 可能な場合は重い計算にWeb Workersを使用
- 再読み込みを避けるためモデルセッションをキャッシュ

### ブラウザ互換性
- WebAssemblyサポートのあるモダンブラウザをターゲット
- カメラ機能のモバイルブラウザ互換性を確保
- 特にiOS SafariとAndroid Chromeでテスト

## 共通コマンド

これはクライアントサイドのみのアプリケーションなので、典型的なコマンドは：

```bash
# 開発サーバー
npm run dev

# 本番用ビルド
npm run build

# テスト実行
npm test

# 型チェック
npm run type-check
```

## モデル管理

- ONNXモデルを`/public/models/`ディレクトリに保存
- モデルは静的アセットとして提供
- 高速読み込みのためモデル圧縮を検討
- モデル読み込み失敗に対するフォールバック機構を実装