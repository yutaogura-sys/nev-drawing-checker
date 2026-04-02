/* ============================================================
   checker.js — Gemini API を使った設置場所見取図の要件チェック
   ============================================================ */

const DrawingChecker = (() => {

  // ─── チェック項目定義 ───────────────────────────
  // 共通チェック項目（基礎・目的地の両方に適用）
  const COMMON_CHECKS = [
    {
      id: 'setting_place',
      category: 'basic_info',
      label: '設置場所の記載',
      description: '施設名・物件名など設置場所の名称が図面表題欄または図中に明記されているか',
      required: true,
    },
    {
      id: 'drawing_name',
      category: 'basic_info',
      label: '図面名称「設置場所見取図」の記載',
      description: '図面名称として「設置場所見取図」が表題欄に記載されているか',
      required: true,
    },
    {
      id: 'creator',
      category: 'basic_info',
      label: '作成者の記載',
      description: '会社名または個人名が表題欄に記載されているか',
      required: true,
    },
    {
      id: 'scale',
      category: 'basic_info',
      label: '縮尺の記載',
      description: '縮尺（例: 1/150）または「-」が表題欄に記載されているか',
      required: true,
    },
    {
      id: 'creation_date',
      category: 'basic_info',
      label: '作成日の記載',
      description: '作成日が表題欄に記載されているか（事業開始日以降であること）',
      required: true,
    },
    {
      id: 'road',
      category: 'drawing_content',
      label: '道路の記載',
      description: '設置場所に接する道路が図面に描かれているか（敷地が道路に接していることの担保）',
      required: true,
    },
    {
      id: 'entrance',
      category: 'drawing_content',
      label: '出入口の記載',
      description: '道路から設置場所への出入口が全て記載されているか（▼マーク・テキスト等）',
      required: true,
    },
    {
      id: 'charging_space',
      category: 'drawing_content',
      label: '充電/充放電スペースの図示',
      description: '充電スペース（赤ハッチング等）の位置が図面上に明示されているか',
      required: true,
    },
    {
      id: 'site_shape',
      category: 'drawing_content',
      label: '敷地全体の形状把握',
      description: '施設全体の敷地形状が把握できる図面になっているか',
      required: true,
    },
    {
      id: 'surrounding',
      category: 'drawing_content',
      label: '周辺施設との位置関係',
      description: '施設に接する公道と周辺建物・施設との位置関係が確認できるか',
      required: true,
    },
  ];

  // 基礎充電（マンション・集合住宅）固有チェック項目
  const KISO_CHECKS = [
    {
      id: 'parking_capacity',
      category: 'kiso_specific',
      label: '収容台数の記載',
      description: '駐車場の収容台数が図面上に記載されているか',
      required: true,
    },
    {
      id: 'building_name',
      category: 'kiso_specific',
      label: '建物名称の明記',
      description: 'マンション・団地などの建物名称が図中に大きく表示されているか',
      required: true,
    },
    {
      id: 'charging_count',
      category: 'kiso_specific',
      label: '充電スペース数の記載',
      description: '充電スペースの台数（例: 充電スペース×8）が記載されているか',
      required: true,
    },
  ];

  // 目的地充電（商業施設等）固有チェック項目
  const MOKUTEKICHI_CHECKS = [
    {
      id: 'road_name',
      category: 'mokutekichi_specific',
      label: '道路名称の記載',
      description: '接する道路の正式名称（例: 国道○号線、県道○号、市道○号線）が記載されているか',
      required: true,
    },
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
      id: 'signboard',
      category: 'mokutekichi_specific',
      label: '案内板情報の記載',
      description: '案内板（サイズ・設置方法等）が図面に記載されているか',
      required: false,
    },
    {
      id: 'existing_charging',
      category: 'mokutekichi_specific',
      label: '既設充電スペースの表示',
      description: '既設の充電スペースがある場合、青色ハッチング等で区別して表示されているか',
      required: false,
    },
  ];

  // カテゴリ定義
  const CATEGORIES = {
    basic_info: { title: '図面基本情報', icon: '&#128203;', order: 1 },
    drawing_content: { title: '図面内容', icon: '&#128506;', order: 2 },
    kiso_specific: { title: '基礎充電 固有項目', icon: '&#127970;', order: 3 },
    mokutekichi_specific: { title: '目的地充電 固有項目', icon: '&#127978;', order: 3 },
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

    return `あなたはNeV補助金（次世代自動車充電インフラ整備促進事業）の設置場所見取図の審査エキスパートです。

アップロードされた図面PDFを非常に高い精度で分析し、以下のチェック項目について判定してください。

## 図面タイプ
${typeLabel}

## 補助金要件（設置場所見取図の共通事項）
設置場所見取図には以下を記載する必要があります：
- ①図面基本情報：設置場所名称、図面名称「設置場所見取図」、作成者、縮尺、作成日
- ②道路：V2H充放電設備設置場所が道路に接していることを担保するために道路を記載
- ③出入口：道路からのV2H充放電設備設置場所への入口を全て記載
- ④充放電スペース：充放電スペース位置を図示
- 施設全体の敷地形状を把握できること
- 敷地内における充放電スペースの位置
- 施設に接する公道と他の施設との位置関係

## 正解事例から学んだパターン
### 表題欄（図面右下）
- 「設置場所」欄に施設名＋「充電設備設置工事」「普通充電設備設置工事」等
- 「作成者」欄に会社名（例: ENECHANGE EVラボ株式会社）
- 「図面名称」欄に「設置場所見取図」
- 「縮尺」欄に数値または「-」
- 「作成日」欄に日付

### 図面内容
- 敷地境界線で施設全体の敷地形状を表現
- 充電スペースは赤色のハッチング（斜線）で表示し、「充電スペース×数」のラベル付き
- 出入口は▼（赤い三角）マークまたは「出入口」テキストで表示
- 道路は敷地外に描画
- 周辺建物も描画して位置関係を表現
${type === 'kiso' ? `
### 基礎充電特有
- 「○○マンション：収容台数 XX台」の表記が図面上にある
- 建物名称が図面中央付近に大きく表示
- 立体駐車場の場合は階数・各階台数の内訳記載あり
` : `
### 目的地充電特有
- 道路名称（国道○号線、県道○号、市道○号線等）が図面に明記
- 施設名が図面中央に大きく表示
- 案内板のサイズ・設置方法（例: 案内板 500×500 両面 既設ポール取付）を記載
- 既設充電スペースがある場合は青色ハッチングで区別表示
- 出入口が複数ある場合は全て記載
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
  "overall_comment": "図面全体に対する総合コメント（良い点・改善点を含む。200文字程度）",
  "detected_info": {
    "facility_name": "読み取れた施設名",
    "drawing_title": "読み取れた図面名称",
    "creator": "読み取れた作成者",
    "scale": "読み取れた縮尺",
    "creation_date": "読み取れた作成日",
    "road_info": "読み取れた道路情報",
    "entrance_count": "読み取れた出入口の数",
    "charging_space_info": "読み取れた充電スペース情報"
  }
}
\`\`\`

## 判定基準
- **pass**: 要件を満たしている（明確に記載が確認できる）
- **fail**: 要件を満たしていない（記載が見当たらない、または不十分）
- **warn**: 記載はあるが不明瞭、または要件を部分的にしか満たしていない

画像を非常に注意深く、隅々まで確認してください。特に：
- 図面右下の表題欄を重点的に確認
- 赤色やカラーのハッチング（斜線エリア）を見逃さない
- ▼マークや「出入口」テキストを確認
- 道路名称のテキストを確認
- 図面上のすべてのテキストラベルを読み取る`;
  }

  // ─── PDF → 画像変換 ────────────────────────────
  async function pdfToImages(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images = [];

    const pageCount = pdf.numPages;
    // 全ページ（最大5ページ）を高解像度で変換
    const maxPages = Math.min(pageCount, 5);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      // 高解像度のためscale=3.0で描画
      const scale = 3.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;
      // JPEG 品質0.92で十分高精度
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split(',')[1];
      images.push({ base64, mimeType: 'image/jpeg', pageNum: i });
    }

    return { images, pageCount };
  }

  // ─── プレビュー用画像生成 ──────────────────────
  async function pdfToPreview(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // ─── Gemini API 呼び出し ───────────────────────
  async function callGemini(apiKey, images, type) {
    const prompt = buildPrompt(type);

    // 画像パーツを構築
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini から有効な応答が得られませんでした');
    }

    // JSONパース（コードブロックで囲まれている場合も対応）
    let jsonStr = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
    return JSON.parse(jsonStr.trim());
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

    // チェック項目ごとに結果をマッピング
    const items = checks.map(check => {
      const result = resultMap[check.id] || { status: 'fail', found_text: '', detail: '判定結果が取得できませんでした' };
      return {
        ...check,
        status: result.status,
        found_text: result.found_text || '',
        detail: result.detail || '',
      };
    });

    // カテゴリ別に集計
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

    // 総合判定
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
    // 1. PDF → 画像変換
    const { images, pageCount } = await pdfToImages(file);

    // 2. Gemini API 呼び出し
    const geminiResult = await callGemini(apiKey, images, type);

    // 3. 結果集計
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
      text += `${icon} ${item.label}\n`;
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
