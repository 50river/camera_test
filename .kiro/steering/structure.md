# プロジェクト構造

## ディレクトリ構成

```
/
├── public/
│   ├── models/           # ONNXモデルファイル
│   │   ├── det_model.onnx
│   │   └── rec_model.onnx
│   └── index.html
├── src/
│   ├── components/       # UIコンポーネント
│   │   ├── CameraCapture.tsx
│   │   ├── ImagePreview.tsx
│   │   ├── RegionSelector.tsx
│   │   ├── ReceiptForm.tsx
│   │   └── ExportPanel.tsx
│   ├── engines/          # コア処理モジュール
│   │   ├── ImageCaptureModule.ts
│   │   ├── OCREngine.ts
│   │   ├── DataExtractionEngine.ts
│   │   └── NormalizationEngine.ts
│   ├── types/            # TypeScriptインターフェース
│   │   ├── receipt.ts
│   │   ├── ocr.ts
│   │   └── config.ts
│   ├── utils/            # ヘルパー関数
│   │   ├── imageProcessing.ts
│   │   ├── dateNormalization.ts
│   │   └── storage.ts
│   ├── hooks/            # Reactフック（React使用時）
│   └── App.tsx
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── package.json
```

## モジュールアーキテクチャ

### コアモジュール
- **engines/**: ビジネスロジックと処理エンジン
- **components/**: 単一責任原則に従うUIコンポーネント
- **types/**: 集約されたTypeScript定義
- **utils/**: 純粋関数とヘルパー

### コンポーネント階層
```
App
├── CameraCapture
├── ImagePreview
│   └── RegionSelector
├── ReceiptForm
└── ExportPanel
```

## ファイル命名規則

- **コンポーネント**: PascalCase（例：`CameraCapture.tsx`）
- **モジュール/ユーティリティ**: camelCase（例：`imageProcessing.ts`）
- **型定義**: 説明的な名前のcamelCase（例：`receipt.ts`）
- **定数**: 別ファイルでUPPER_SNAKE_CASE

## インポート構成

```typescript
// 外部ライブラリ
import React from 'react'
import { InferenceSession } from 'onnxruntime-web'

// 内部モジュール（エンジン）
import { OCREngine } from '../engines/OCREngine'

// 型定義
import type { ReceiptData, OCRResult } from '../types/receipt'

// ユーティリティ
import { normalizeDate } from '../utils/dateNormalization'
```

## 状態管理

- UI操作にはローカルコンポーネント状態を使用
- 共有データにはContext APIまたは軽量状態管理を使用
- 処理済み領収書はstorageユーティリティ経由でIndexedDBに保存
- 再初期化を避けるためOCRエンジンインスタンスをアプリレベルで保持

## エラーハンドリング構造

- `types/errors.ts`での集約されたエラー型
- コンポーネントレベルでのエラーバウンダリ
- OCR失敗に対する優雅な劣化
- 日本語と英語でのユーザーフレンドリーなエラーメッセージ