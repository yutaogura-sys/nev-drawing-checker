/* ============================================================
   checker.js — Gemini API を使った設置場所見取図の要件チェック
   正確な補助金要件（充電設備 設置場所見取図）に基づく
   ============================================================ */

const DrawingChecker = (() => {

  // ─── チェック項目定義 ───────────────────────────
  // 共通チェック項目（基礎・目的地の両方に適用）
  const COMMON_CHECKS = [
    {
      id: 'setting_place',
      category: 'basic_info',
      label: '設置場所の記載',
      description: '申請で入力した設置場所名称（略称不可）が表題欄に記載されているか。例）○○モール 充電設備設置工事',
      required: true,
    },
    {
      id: 'drawing_name',
      category: 'basic_info',
      label: '図面名称「設置場所見取図」の記載',
      description: '図面名称として正確に「設置場所見取図」が表題欄に記載されているか。不備例：設置見取図、設置場所図等は不可',
      required: true,
    },
    {
      id: 'creator',
      category: 'basic_info',
      label: '作成者の記載',
      description: '会社名または個人名が表題欄の「作成者」欄に記載されているか',
      required: true,
    },
    {
      id: 'scale',
      category: 'basic_info',
      label: '縮尺の記載',
      description: '縮尺（例: 1/150）が表題欄に記載されているか。縮尺サイズの指定なし。市販の地図等で縮尺が不明の場合は「-」と記載',
      required: true,
    },
    {
      id: 'creation_date',
      category: 'basic_info',
      label: '作成日の記載',
      description: '作成日が表題欄に記載されているか（本補助金の事業開始日以降であること）',
      required: true,
    },
    {
      id: 'public_road',
      category: 'drawing_content',
      label: '公道の記載',
      description: '充電設備設置場所が公道に接していることを担保するために公道が描かれているか。公道名（国道○号線、県道○号、市道○号線等）が記載されているか',
      required: true,
    },
    {
      id: 'road_name',
      category: 'drawing_content',
      label: '公道名の記載',
      description: '接している公道の名称（例: 国道××号線、県道○号、市道○○線）がテキストで記載されているか',
      required: true,
    },
    {
      id: 'entrance',
      category: 'drawing_content',
      label: '充電設備設置場所の入口',
      description: '公道から充電設備設置場所への入口が全て記載されているか（▼マーク・「出入口」テキスト等）',
      required: true,
    },
    {
      id: 'charging_space',
      category: 'drawing_content',
      label: '充電スペースの図示',
      description: '充電設備設置場所での充電スペース位置が図示されているか（赤色ハッチング等で明示）',
      required: true,
    },
    {
      id: 'site_shape',
      category: 'drawing_content',
      label: '施設全体の敷地形状',
      description: '施設全体の敷地形状が把握できる図面になっているか（敷地境界線等）',
      required: true,
    },
    {
      id: 'surrounding',
      category: 'drawing_content',
      label: '公道と他施設との位置関係',
      description: '施設に接する公道と他の施設との位置関係が確認できるか（周辺建物の描画等）',
      required: true,
    },
  ];

  // 基礎充電（マンション・集合住宅）固有チェック項目
  const KISO_CHECKS = [
    {
      id: 'building_name',
      category: 'kiso_specific',
      label: '建物名称の明記',
      description: 'マンション・団地などの建物名称が図中に大きく表示されているか',
      required: true,
    },
    {
      id: 'parking_capacity',
      category: 'kiso_specific',
      label: '収容台数の記載',
      description: '駐車場の収容台数（例: ○○マンション：収容台数 XX台）が図面上に記載されているか',
      required: true,
    },
    {
      id: 'charging_count',
      category: 'kiso_specific',
      label: '充電スペース数の記載',
      description: '充電スペースの台数（例: 充電スペース×8）が記載されているか',
      required: true,
    },
    {
      id: 'existing_charging_kiso',
      category: 'kiso_specific',
      label: '既設充電スペースの表示',
      description: '既設充電設備がある場合、既存の充電スペース場所が区別して表示されているか（該当する場合のみ）',
      required: false,
    },
  ];

  // 目的地充電（商業施設等）固有チェック項目
  const MOKUTEKICHI_CHECKS = [
    {
      id: 'facility_name',
      category: 'mokutekichi_specific',
      label: '施設名称の明記',
      description: '店舗・ホテル・施設の名称が図中に大きく表示されているか',
      required: true,
    },
    {
      id: 'charging_count',
      category: 'mokutekichi_specific',
      label: '充電スペース数の記載',
      description: '充電スペースの台数（例: 充電スペース×4）が記載されているか',
      required: true,
    },
    {
      id: 'signboard_position',
      category: 'signboard',
      label: '案内板の設置位置',
      description: '案内板が接している公道の入口に設置されていることが図面上で確認できるか（位置が図示されているか）',
      required: true,
    },
    {
      id: 'signboard_direction',
      category: 'signboard',
      label: '案内板の向き',
      description: '案内板の向きが確認できるか。両面の場合は公道に対し垂直、片面の場合は公道に対し平行であること',
      required: true,
    },
    {
      id: 'signboard_spec',
      category: 'signboard',
      label: '案内板の設置方法・仕様',
      description: '案内板の設置方法（新設ポール/既設ポール/壁付）と仕様（片面/両面、サイズ 例:500×500）が記載されているか',
      required: true,
    },
    {
      id: 'signboard_new_existing',
      category: 'signboard',
      label: '案内板の新設/既設の区別',
      description: '案内板が新設か既設（流用）かが記載されているか。例）新設案内板、※既設案内板（両面）流用',
      required: true,
    },
    {
      id: 'existing_charging',
      category: 'mokutekichi_specific',
      label: '既設充電スペースの表示',
      description: '既設充電設備がある場合、既設充電スペース位置が区別して図示されているか（青色ハッチング等）',
      required: false,
    },
  ];

  // カテゴリ定義
  const CATEGORIES = {
    basic_info: { title: '①図面基本情報', icon: '&#128203;', order: 1 },
    drawing_content: { title: '②公道・入口・敷地・充電スペース', icon: '&#128506;', order: 2 },
    kiso_specific: { title: '基礎充電 固有項目', icon: '&#127970;', order: 3 },
    mokutekichi_specific: { title: '目的地充電 固有項目', icon: '&#127978;', order: 3 },
    signboard: { title: '④案内板（目的地充電 必須）', icon: '&#129517;', order: 4 },
  };

  // ─── Gemini プロンプト生成 ──────────────────────
  function buildPrompt(type) {
    const checks = type === 'kiso'
      ? [...COMMON_CHECKS, ...KISO_CHECKS]
      : [...COMMON_CHECKS, ...MOKUTEKICHI_CHECKS];

    const checkListText = checks.map((c, i) => {
      return `${i + 1}. [${c.id}] ${c.label}\n   確認内容: ${c.description}\n   必須: ${c.required ? 'はい' : 'いいえ（該当する場合のみ）'}`;
    }).join('\n\n');

    const typeLabel = type === 'kiso' ? '基礎充電（マンション・集合住宅向け）' : '目的地充電（商業施設・ホテル・ゴルフ場等向け）';

    return `あなたはNeV補助金（次世代自動車充電インフラ整備促進事業）の「設置場所見取図」の審査エキスパートです。
これはEV充電設備の補助金申請図面です（V2Hではありません）。

アップロードされた図面PDFを非常に高い精度で分析し、以下のチェック項目について判定してください。

## 図面タイプ
${typeLabel}

## 補助金要件（設置場所見取図 5-9-1）

### 記載が必要な内容
以下の項目が審査できるように記載する必要があります：
- 施設全体の敷地形状
- 敷地内における充電スペースの位置
${type === 'mokutekichi' ? '- 案内板設置位置\n' : ''}- 施設に接する公道と他の施設との位置関係

### ①図面基本情報（表題欄）
- **設置場所**: 申請で入力した設置場所名称（略称不可）＋「充電設備設置工事」等
- **図面名称**: 必ず「設置場所見取図」と記載（不備事例：設置見取図、設置場所図等は不可）
- **作成者**: 会社名または個人名
- **縮尺**: 例）1/150（縮尺サイズの指定なし。市販の地図等で不明の場合は「-」）
- **作成日**: 本補助金の事業開始日以降の日付

### ②公道
- 充電設備設置場所が公道に接していることを担保するために公道を記載
- **公道名を必ず記載**すること（例: 国道××号線、県道○号、市道○○線）

### ③充電設備設置場所の入口
- 公道からの充電設備設置場所への入口を**全て**記載

### ④案内板${type === 'kiso' ? '（基礎充電では不要）' : '（目的地充電では必須）'}
${type === 'mokutekichi' ? `- 充電設備設置場所の入口に設置する案内板の**位置**と**向き**がわかるように図示
- **位置**: 接している公道の入口に設置すること
- **向き**: 公道に対し、案内板が両面の場合には垂直、片面の場合は平行に設置すること
- **高さ**: 公道の上下線から視認できる位置および高さに設置すること
- 案内板の**設置方法と仕様**を記載（例: 新設ポール 片面 500×500 / 既設ポール 両面 600×600 / 壁付 片面 500×500）
- 案内板を区別するために**既設か新設か**を記載（例: 新設案内板、※既設案内板（両面）流用）` : '- 基礎充電タイプでは案内板のチェックは不要です'}

### ⑤充電スペース
- 充電設備設置場所での充電スペース位置を図示

### ⑥既設充電スペース（該当する場合のみ）
- 既設充電設備がある場合、既設充電設備の充電スペース位置を図示（新設と区別）

## 正解事例から学んだパターン

### 表題欄（図面右下の枠内）
- 「設置場所」欄に施設名＋「充電設備設置工事」「普通充電設備設置工事」等
- 「作成者」欄に会社ロゴ＋会社名（例: ENECHANGE EVラボ株式会社）
- 「図面名称」欄に「設置場所見取図」
- 「縮尺」欄に数値（1/150等）または「-」
- 「作成日」欄に年月日

### 図面内容の共通パターン
- 敷地境界線で施設全体の敷地形状を表現
- 充電スペースは**赤色のハッチング（斜線）**で表示し、「充電スペース×数」のラベル付き
- 既設充電スペースは**青色のハッチング（斜線）**で表示し区別
- 出入口は**▼（赤い三角）マーク**または「出入口」テキストで表示
- 公道は敷地外に描画され、公道名がテキストで記載
- 周辺建物も描画して位置関係を表現
- 方位記号（N）が右上に表示されることが多い
${type === 'kiso' ? `
### 基礎充電の正解パターン
- 「○○マンション：収容台数 XX台」の表記が図面上にある
- 建物名称が図面中央付近に大きく枠囲みで表示
- 立体駐車場の場合は階数・各階台数の内訳も記載
- 出入口は1箇所の場合が多い
- 案内板は不要
` : `
### 目的地充電の正解パターン
- 公道名称（国道○号線、県道○号、市道○号線等）が図面に明記
- 施設名が図面中央に大きく枠囲みで表示
- 案内板情報が青色テキストで記載（例: 案内板 500×500 両面 既設ポール取付）
  - 新設/既設の区別あり（例: ※既設案内板（両面）流用）
  - 設置方法（新設ポール/既設ポール/壁付）
  - 仕様（片面/両面、サイズ）
- 既設充電スペースがある場合は青色ハッチングで区別表示し「既設充電スペース×数」のラベル
- 出入口が複数ある場合は全てに▼マーク
`}

## チェック項目
${checkListText}

## 回答フォーマット（厳密にこのJSON形式で返してください）
以下のJSON形式のみで回答してください。JSONの前後に余計なテキストは不要です。

\`\`\`json
{
  "results": [
    {
      "id": "チェック項目ID",
      "status": "pass | fail | warn",
      "found_text": "図面から実際に読み取れた内容（なるべく具体的に）",
      "detail": "判定理由の詳細説明"
    }
  ],
  "overall_comment": "図面全体に対する総合コメント（良い点・改善点を含む。300文字程度）",
  "detected_info": {
    "facility_name": "読み取れた施設名",
    "drawing_title": "読み取れた図面名称",
    "creator": "読み取れた作成者",
    "scale": "読み取れた縮尺",
    "creation_date": "読み取れた作成日",
    "road_info": "読み取れた公道情報（公道名含む）",
    "entrance_count": "読み取れた出入口の数",
    "charging_space_info": "読み取れた充電スペース情報",
    "signboard_info": "読み取れた案内板情報（目的地のみ）"
  }
}
\`\`\`

## 判定基準
- **pass**: 要件を満たしている（明確に記載が確認できる）
- **fail**: 要件を満たしていない（記載が見当たらない、または不十分）
- **warn**: 記載はあるが不明瞭、または要件を部分的にしか満たしていない

## 重要な注意事項
画像を非常に注意深く、隅々まで確認してください。特に：
- **図面右下の表題欄**を重点的に確認（設置場所・図面名称・作成者・縮尺・作成日）
- **赤色のハッチング（斜線エリア）**が充電スペース
- **青色のハッチング（斜線エリア）**が既設充電スペース
- **▼マーク（赤い三角）**や「出入口」テキストが入口の表示
- **公道名称のテキスト**を確認（道路上に記載されている）
${type === 'mokutekichi' ? '- **案内板の情報**（サイズ・設置方法・新設/既設・位置・向き）を注意深く読み取る\n- 案内板情報は青色テキストで記載されていることが多い' : ''}
- 図面上のすべてのテキストラベルを漏れなく読み取る
- 「設置場所見取図」の文字が正確に表記されているかを厳密にチェック`;
  }

  // ─── PDF → 画像変換 ────────────────────────────
  // canvasの最大ピクセル数を制限（ブラウザクラッシュ防止）
  const MAX_CANVAS_PIXELS = 16_000_000; // 16MP上限
  const MAX_CANVAS_DIM = 4096;          // 1辺の最大px

  function calcSafeScale(page, targetScale) {
    const viewport = page.getViewport({ scale: targetScale });
    let w = viewport.width;
    let h = viewport.height;

    // 1辺が上限を超える場合はスケールを下げる
    if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
      const dimRatio = Math.min(MAX_CANVAS_DIM / w, MAX_CANVAS_DIM / h);
      return targetScale * dimRatio;
    }
    // 総ピクセル数が上限を超える場合
    if (w * h > MAX_CANVAS_PIXELS) {
      const pixelRatio = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
      return targetScale * pixelRatio;
    }
    return targetScale;
  }

  async function pdfToImages(file) {
    let pdf;
    try {
      const arrayBuffer = await file.arrayBuffer();
      pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
      throw new Error('PDFファイルの読み込みに失敗しました。ファイルが破損しているか、パスワードで保護されている可能性があります。');
    }

    const images = [];
    const pageCount = pdf.numPages;
    const maxPages = Math.min(pageCount, 5);
    let totalBase64Size = 0;

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const safeScale = calcSafeScale(page, 3.0);
      const viewport = page.getViewport({ scale: safeScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
      const base64 = dataUrl.split(',')[1];
      totalBase64Size += base64.length;

      // Gemini APIのリクエストサイズ上限チェック（約20MB）
      if (totalBase64Size > 18_000_000) {
        console.warn(`ページ${i}でペイロードサイズ上限に近づいたため、以降のページをスキップします`);
        break;
      }

      images.push({ base64, mimeType: 'image/jpeg', pageNum: i });

      // canvasメモリを即時解放
      canvas.width = 0;
      canvas.height = 0;
    }

    if (images.length === 0) {
      throw new Error('PDFから画像を生成できませんでした。');
    }

    return { images, pageCount };
  }

  // ─── プレビュー用画像生成 ──────────────────────
  async function pdfToPreview(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const safeScale = calcSafeScale(page, 1.5);
    const viewport = page.getViewport({ scale: safeScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // ─── Gemini API 呼び出し ───────────────────────
  async function callGemini(apiKey, images, type) {
    const prompt = buildPrompt(type);

    const imageParts = images.map(img => ({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64,
      }
    }));

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            ...imageParts,
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API エラー (${response.status})`);
    }

    const data = await response.json();

    // 安全フィルタによるブロックチェック
    if (!data.candidates || data.candidates.length === 0) {
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Gemini がリクエストをブロックしました（理由: ${blockReason}）。別の図面で再試行してください。`);
      }
      throw new Error('Gemini から応答が返りませんでした。しばらく待ってから再試行してください。');
    }

    const candidate = data.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Gemini の安全フィルタにより応答がブロックされました。図面の内容を確認してください。');
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini から有効なテキスト応答が得られませんでした。再試行してください。');
    }

    // JSONパース（コードブロックで囲まれている場合も対応）
    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }

    try {
      return JSON.parse(jsonStr.trim());
    } catch (parseErr) {
      console.error('Gemini応答のJSONパースに失敗:', text.substring(0, 500));
      throw new Error('Gemini の応答を解析できませんでした。再試行してください。');
    }
  }

  // ─── API キー検証 ─────────────────────────────
  async function verifyApiKey(apiKey) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );
    return response.ok;
  }

  // ─── 結果集計 ──────────────────────────────────
  function aggregateResults(geminiResult, type) {
    const checks = type === 'kiso'
      ? [...COMMON_CHECKS, ...KISO_CHECKS]
      : [...COMMON_CHECKS, ...MOKUTEKICHI_CHECKS];

    const resultMap = {};
    if (geminiResult.results) {
      geminiResult.results.forEach(r => { resultMap[r.id] = r; });
    }

    const items = checks.map(check => {
      const result = resultMap[check.id] || { status: 'fail', found_text: '', detail: '判定結果が取得できませんでした' };
      return {
        ...check,
        status: result.status,
        found_text: result.found_text || '',
        detail: result.detail || '',
      };
    });

    const categoryResults = {};
    items.forEach(item => {
      if (!categoryResults[item.category]) {
        categoryResults[item.category] = { items: [], pass: 0, fail: 0, warn: 0, total: 0 };
      }
      const cat = categoryResults[item.category];
      cat.items.push(item);
      cat.total++;
      if (item.status === 'pass') cat.pass++;
      else if (item.status === 'fail') cat.fail++;
      else cat.warn++;
    });

    const totalRequired = items.filter(i => i.required);
    const requiredPass = totalRequired.filter(i => i.status === 'pass').length;
    const requiredFail = totalRequired.filter(i => i.status === 'fail').length;
    const totalPass = items.filter(i => i.status === 'pass').length;

    let overall;
    if (requiredFail === 0) {
      overall = 'pass';
    } else if (requiredFail <= 2) {
      overall = 'warn';
    } else {
      overall = 'fail';
    }

    return {
      items,
      categoryResults,
      overall,
      totalPass,
      totalItems: items.length,
      requiredPass,
      requiredTotal: totalRequired.length,
      requiredFail,
      overallComment: geminiResult.overall_comment || '',
      detectedInfo: geminiResult.detected_info || {},
    };
  }

  // ─── メインチェック実行 ────────────────────────
  async function check(apiKey, file, type) {
    const { images, pageCount } = await pdfToImages(file);
    const geminiResult = await callGemini(apiKey, images, type);
    const aggregated = aggregateResults(geminiResult, type);
    aggregated.pageCount = pageCount;
    aggregated.analyzedPages = images.length;
    return aggregated;
  }

  // ─── 結果テキスト出力 ──────────────────────────
  function resultToText(result, type) {
    const typeLabel = type === 'kiso' ? '基礎充電' : '目的地充電';
    let text = `=== NeV 設置場所見取図 要件判定結果 ===\n`;
    text += `図面タイプ: ${typeLabel}\n`;
    text += `判定: ${result.overall === 'pass' ? '合格' : result.overall === 'warn' ? '要確認' : '不合格'}\n`;
    text += `合格項目: ${result.totalPass} / ${result.totalItems}\n`;
    text += `必須項目: ${result.requiredPass} / ${result.requiredTotal}\n\n`;

    result.items.forEach(item => {
      const icon = item.status === 'pass' ? '[OK]' : item.status === 'fail' ? '[NG]' : '[!?]';
      text += `${icon} ${item.label}${item.required ? '' : ' [任意]'}\n`;
      if (item.found_text) text += `    検出: ${item.found_text}\n`;
      if (item.detail) text += `    詳細: ${item.detail}\n`;
      text += '\n';
    });

    if (result.overallComment) {
      text += `--- AI コメント ---\n${result.overallComment}\n`;
    }

    return text;
  }

  // ─── 公開API ──────────────────────────────────
  return {
    check,
    verifyApiKey,
    pdfToPreview,
    resultToText,
    CATEGORIES,
    COMMON_CHECKS,
    KISO_CHECKS,
    MOKUTEKICHI_CHECKS,
  };

})();
