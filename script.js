  const firebaseConfig = {
    apiKey: "AIzaSyA5Bhf6p6zVjnKc9npB85fxG_1BBdUdGKY",
  authDomain: "nicotwibukka.firebaseapp.com",
  databaseURL: "https://nicotwibukka-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "nicotwibukka",
  storageBucket: "nicotwibukka.firebasestorage.app",
  messagingSenderId: "766242176253",
  appId: "1:766242176253:web:7cddf2145711b5e3595294",
  measurementId: "G-S7XZMPDKJB"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const form = document.getElementById('tweetForm');
  const tweetStream = document.getElementById('tweetStream');
  const topUserList = document.getElementById('topUserList'); 
  const allUserList = document.getElementById('allUserList'); 
  const commentArea = document.getElementById('commentArea');
  const mainAreaEl = document.getElementById('mainArea'); 
  const commentInput = document.getElementById('comment');
  const concurrentUsersDiv = document.getElementById('concurrentUsers');
  const submitButton = form.querySelector('button[type="submit"]'); 
  const usageWarningDiv = document.getElementById('usageWarning');
  const predefinedColorSelect = document.getElementById('predefinedColor');
  const commentColorPicker = document.getElementById('commentColorPicker');
  const commentTypeSelect = document.getElementById('commentType');
  const commentSizeSelect = document.getElementById('commentSize');
  // 文字サイズ（小・中・大）に対応する基準スケール（中=1.0）
  const COMMENT_SIZE_SCALE = { small: 0.6, medium: 1.0, large: 1.4 };
  function getSizeScale(size) {
      return COMMENT_SIZE_SCALE[size] || COMMENT_SIZE_SCALE.medium;
  }
  const toggleLogDisplayCheckbox = document.getElementById('toggleLogDisplayCheckbox');
  const toggleRainbowCheckbox = document.getElementById('toggleRainbowCheckbox');
  let rainbowAnimEnabled = localStorage.getItem('rainbowAnimEnabled') !== 'false';
  toggleRainbowCheckbox.checked = rainbowAnimEnabled;
  if (!rainbowAnimEnabled) document.body.classList.add('rainbow-anim-off');

  const toggleLogDisplayContainer = document.getElementById('toggleLogDisplayContainer');
  const FLOATING_COMMENT_HEIGHT = 60; // フローティングコメント1つあたりの高さ（フォントサイズ+余白）
  const FLOATING_COMMENT_MARGIN = 10; // フローティングコメント間の垂直方向の隙
  const logContainer = document.getElementById('logContainer');



  let floatingCommentLines = []; // 各レーンの可用性（利用可能になる時刻）を管理
  let activeFloatingComments = new Map(); // 現在表示中のフローティングコメントのMap (key -> {element, animationEndTime, key})
  const MAX_LOG_COMMENT_LENGTH = 150;
  const usageStatsRef = db.ref('usageStats');
  const lastAccessTimestampRef = usageStatsRef.child('lastAccessTimestamp');
  const writeCountRef = usageStatsRef.child('writeCount');
  const readCountRef = usageStatsRef.child('readCount');
  const tweetsCountRef = db.ref('tweetsCount');
  const totalTweetCountRef = db.ref('config/totalTweetCount'); // 累計コメント番号（削除されても増え続ける）
  let activeCenterFixedComments = new Map(); 
  // --- バージョンチェック関連の追加 ---
  const VERSION_CONFIG_REF = db.ref('config/current_version_key'); // Firebase上のバージョンキーのパス
  // ローディングオーバーレイ制御
  const loadingOverlay = document.getElementById('loadingOverlay');
  function showLoading(msg) {
      loadingOverlay.textContent = msg || '読み込み中…';
      // body の transform 影響を受けないよう html 直下に移動
      if (loadingOverlay.parentElement !== document.documentElement) {
          document.documentElement.appendChild(loadingOverlay);
      }
      loadingOverlay.classList.remove('hidden');
  }
  function hideLoading() {
      loadingOverlay.classList.add('hidden');
  }

  const THIS_HTML_VERSION_KEY = "v1.7.6"; // <-- ここ
  let isCurrentVersion = false; // 現在のHTMLが最新バージョンかどうかを示すフラグ
  // --- ここまで ---

  const CENTRAL_COMMENT_LIFESPAN = 20000; // 20秒
  const NORMAL_COMMENT_MAX_LENGTH = 140; // 通常コメントの最大文字数

  // 同一内容の投稿制限
  const SAME_CONTENT_RATE_LIMIT_1MIN = 60 * 1000; // 1分
  const MAX_SAME_CONTENT_1MIN = 3; // 1分間に3個まで (4個目から禁止)

  const SAME_CONTENT_RATE_LIMIT_5MIN = 5 * 60 * 1000; // 5分
  const MAX_SAME_CONTENT_5MIN = 5; // 5分間に5個まで (6個目から禁止)

  // 同一人物の投稿間隔制限
  const MIN_POST_INTERVAL_PER_USER = 3 * 1000; // 3秒

  const SPAM_KEYWORDS = [
      "bit.ly", "goo.gl", "tinyurl.com", // 短縮URL
      "http", "https", "www.", ".com", ".net", ".org", // 一般的なURLパターン
    
  ];
  const SPAM_URL_PATTERNS = [
      /https?:\/\/(?:www\.)?(?:bit\.ly|goo\.gl|tiny\.cc)\/[\w-]+/i, // 短縮URL
      /https?:\/\/(?:www\.)?[\w.-]+\.(?:com|net|org|jp)\/[\w.-]*/i // 一般的なURL
  ];

  // HTMLフォーム要素や危険な可能性のあるタグを検出する正規表現
  const FORBIDDEN_HTML_TAGS_REGEX = /<(input|select|textarea|button|form|iframe|script|style|link)[\s>]/i;


  let allTweets = {};
  let tweetsQueryRef = null;
  const tweetDomCache = new Map(); // key → DOM要素キャッシュ // child_addedクエリ参照（off()用） // 全ツイートデータのキャッシュ
  let userRecentPosts = {}; 
  let userLastPostTime = {}; // 各ユーザーの最終投稿時刻を記録する
  
  let currentReadCount = 0; 
  let currentWriteCount = 0; 
  let currentTweetCount = 0; 

  let userCounts = {};
  let userFirstTweetTime = {}; 
  
let firebaseUserId = localStorage.getItem('firebaseUserId');
if (!firebaseUserId) {
    firebaseUserId = db.ref().push().key;
    localStorage.setItem('firebaseUserId', firebaseUserId);
}
// currentUser は一意のIDとしてconstで定義する（変更しない）
const currentUser = firebaseUserId;

const nicknameInput = document.getElementById('nickname');

// ページ読み込み時にlocalStorageからユーザー名をロードする
const savedUserName = localStorage.getItem('userName');
if (savedUserName) {
    nicknameInput.value = savedUserName;
}

// nicknameInputのイベントリスナー
// currentUserを上書きしないように修正
nicknameInput.addEventListener('input', (e) => {
    // ユーザー名をlocalStorageに保存するだけ
    localStorage.setItem('userName', e.target.value);
});

  function setLogDisplayMode(showLog) {
      if (showLog) {
          document.body.classList.remove('comment-only'); 
          localStorage.setItem('logDisplayMode', 'true');
          updateAllTweetDisplayVisibility(true);
      } else {
          document.body.classList.add('comment-only'); 
          localStorage.setItem('logDisplayMode', 'false');
          updateAllTweetDisplayVisibility(false);
      }
      adjustOverallScale();
  }

  function initializeLogDisplayMode() {
      const storedMode = localStorage.getItem('logDisplayMode');
      // アプリ起動時はデフォルトでログ表示 (true)
      const initialDisplay = (storedMode === null || storedMode === 'true'); 

      toggleLogDisplayCheckbox.checked = initialDisplay;
      setLogDisplayMode(initialDisplay);
  }
  initializeLogDisplayMode(); 

  toggleLogDisplayCheckbox.addEventListener('change', (e) => {
      setLogDisplayMode(e.target.checked);
  });

  function updateAllTweetDisplayVisibility(visible) {
      const tweets = tweetStream.children;
      for (let i = 0; i < tweets.length; i++) {
          tweets[i].style.display = visible ? 'block' : 'none';
      }
  }


  function isNewDay(timestamp) {
      if (!timestamp) return true;
      const lastDate = new Date(timestamp);
      const now = new Date();

      const offset = 9 * 60 * 60 * 1000;
      const lastDayJST = Math.floor((lastDate.getTime() + offset) / (24 * 60 * 60 * 1000));
      const currentDayJST = Math.floor((now.getTime() + offset) / (24 * 60 * 60 * 1000));
      
      return currentDayJST > lastDayJST;
  }

  async function initializeUsageMonitoring() {
      const lastAccessSnapshot = await lastAccessTimestampRef.once('value');
      const lastAccessTimestamp = lastAccessSnapshot.val();

      if (isNewDay(lastAccessTimestamp)) {
          console.log("日付が変わったため、使用量カウントをリセットします。");
          await writeCountRef.set(0);
          await readCountRef.set(0);
          await lastAccessTimestampRef.set(Date.now());
      } else {
          console.log("日付は変わっていません。既存のカウントを読み込みます。");
      }

      readCountRef.on('value', (snapshot) => {
          currentReadCount = snapshot.val() || 0;
      });

      writeCountRef.on('value', (snapshot) => {
          currentWriteCount = snapshot.val() || 0;
      });

      tweetsCountRef.on('value', (snapshot) => {
          currentTweetCount = snapshot.val() || 0;
          checkTweetLimit();
      });

      setInterval(() => {
          lastAccessTimestampRef.set(Date.now()).catch(e => console.error("Failed to update lastAccessTimestamp:", e));
      }, 60 * 1000); 
  }

// 中央固定コメントの位置更新と20秒後の削除を、500ミリ秒（0.5秒）ごとに行う
setInterval(updateCenterFixedCommentPositions, 500);

  function checkTweetLimit() {
      console.log(`Current Usage: Reads: ${currentReadCount}, Writes: ${currentWriteCount}, Tweets: ${currentTweetCount}`);
  }

     // --- インターネット接続監視ロジック ---
function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (navigator.onLine) {
        // オンラインの時は非表示
        statusDiv.style.display = 'none';
        console.log("インターネットに接続されました。");
    } else {
        // オフラインの時に「接続切れました」を表示
        statusDiv.style.display = 'block';
        console.log("インターネット接続が切れました。");
    }
}

// 接続状態の変化を監視
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);

// ページ読み込み時にも一度チェック
updateConnectionStatus();
// --- ここまで ---

  async function incrementReadCount() {
      await readCountRef.transaction((currentCount) => {
          return (currentCount || 0) + 1;
      }).catch(e => console.error("Failed to increment readCount:", e));
  }

  async function incrementWriteCount() {
      await writeCountRef.transaction((currentCount) => {
          return (currentCount || 0) + 1;
      }).catch(e => console.error("Failed to increment writeCount:", e));
  }

  async function incrementTweetCount() {
      await tweetsCountRef.transaction((currentCount) => {
          return (currentCount || 0) + 1;
      }).catch(e => console.error("Failed to increment tweetCount:", e));
  }

  async function decrementTweetCount() {
      await tweetsCountRef.transaction((currentCount) => {
          return Math.max(0, (currentCount || 0) - 1); 
      }).catch(e => console.error("Failed to decrement tweetCount:", e));
  }

  function containsSpam(text) {
      const lowerText = text.toLowerCase();

      for (const keyword of SPAM_KEYWORDS) {
          if (lowerText.includes(keyword.toLowerCase())) {
              return true;
          }
      }

      for (const pattern of SPAM_URL_PATTERNS) {
          if (pattern.test(lowerText)) {
              return true;
          }
      }
      return false;
  }

  // 追加: 禁止されたHTMLタグが含まれているかチェックする関数
  function containsForbiddenHtmlTags(text) {
      // DOMPurifyでサニタイズした後に、特定のタグが残っていないかを確認
      // DOMPurifyは基本的な危険なタグを除去するが、念のため最終チェック
      const sanitizedText = DOMPurify.sanitize(text);
      return FORBIDDEN_HTML_TAGS_REGEX.test(sanitizedText);
  }

// activeFloatingCommentsMap はグローバルな activeFloatingComments を指す

function getFloatingCommentYPosition(durationMs) { // durationMs が正確か確認
    const commentAreaHeight = commentArea.offsetHeight;
    const currentTime = Date.now(); // 現在時刻をミリ秒で取得

    // レーン数を計算 (現在の画面の高さから何レーン確保できるか)
    const numLines = Math.floor(commentAreaHeight / (FLOATING_COMMENT_HEIGHT + FLOATING_COMMENT_MARGIN));

    // レーン配列の初期化またはサイズ変更
    if (floatingCommentLines.length !== numLines) {
        floatingCommentLines = Array(numLines).fill(null).map(() => ({ availableTime: 0 })); // nullではなくオブジェクトで初期化
    }

    let bestLineIndex = -1;
    let earliestAvailableTime = Infinity;

    // 最も早く利用可能になるレーンを探す
    for (let i = 0; i < numLines; i++) {
        // レーンが現在利用可能（availableTimeが現在時刻以下）な場合
        if (floatingCommentLines[i].availableTime <= currentTime) {
            bestLineIndex = i; // すぐに利用可能なレーンがあればそれを優先
            break; // 見つかったらすぐにループを抜ける
        }
        // まだ利用可能でないが、最も早く空くレーンを探す
        if (floatingCommentLines[i].availableTime < earliestAvailableTime) {
            earliestAvailableTime = floatingCommentLines[i].availableTime;
            bestLineIndex = i;
        }
    }

    if (bestLineIndex !== -1) {
        const yPos = bestLineIndex * (FLOATING_COMMENT_HEIGHT + FLOATING_COMMENT_MARGIN);
        // !!! ここが最も重要 !!!
        // このレーンが、コメントが完全に画面外に出るまで占有されるように、availableTimeを更新
        floatingCommentLines[bestLineIndex].availableTime = currentTime + durationMs;
        return yPos; // 割り当てられたY座標を返す
    } else {
        // 利用可能なレーンがない場合（画面がコメントでいっぱいの時など）
        console.warn("フローティングコメントの配置に利用可能なレーンがありませんでした。コメントが重なる可能性があります。");
        // この場合でも、最低限のY位置を返すか、エラーとして処理するかを決定
        // 例: 最上段に強制的に表示（重なりを許容する場合）
        return 0; // 最上段に表示
        // または null を返して showFloatingComment 側で表示しない判断をさせる
        // return null;
    }
}
     /**
 * スクロールコメントの件数をチェックし、タイムスタンプに基づいて古いコメントを削除する
 */
function limitComments() {
    // コメントが流れるコンテナのIDは "tweetStream" であることをコードから確認済み
    const commentContainer = document.getElementById('tweetStream'); 
    const MAX_COMMENTS = 100;

    // コンテナが見つからない場合は処理を終了（エラー防止）
    if (!commentContainer) {
        console.warn("#tweetStream が見つかりません。コメント制限は実行されません。");
        return;
    }

    // 現在表示されている全てのコメント要素を取得
    const allComments = Array.from(commentContainer.children);
    
    // 100件以下なら何もしない
    if (allComments.length <= MAX_COMMENTS) {
        return; 
    }

    // タイムスタンプ（data-timestamp属性）を基に、古い順にソートする
    allComments.sort((a, b) => {
        // data-timestampを数値に変換（属性がない要素は0として扱い、エラーを防ぐ）
        const timeA = parseInt(a.getAttribute('data-timestamp')) || 0;
        const timeB = parseInt(b.getAttribute('data-timestamp')) || 0;
        return timeA - timeB; // 昇順（タイムスタンプが小さい（古い）順）
    });

    // 削除するコメントの数を計算 (例: 105件あれば 5件削除)
    const commentsToRemoveCount = allComments.length - MAX_COMMENTS;

    // ソートされた配列の先頭から、削除すべき件数分だけDOMから削除
    for (let i = 0; i < commentsToRemoveCount; i++) {
        const commentToRemove = allComments[i];
        if (commentToRemove) {
            commentContainer.removeChild(commentToRemove);
        }
    }
    
    if (commentsToRemoveCount > 0) {
        console.log(`コメント数が${MAX_COMMENTS}件を超えたため、古いコメント${commentsToRemoveCount}件を削除しました。`);
    }
}


  // ---- リプレイ機能 ----
  let replayTimer = null;

  function showFloatingCommentReplay(key, text, color, size = 'medium') {
    // 通常の弾幕表示と同じコードパスを使用（DOMPurify・タイムスタンプチェックをスキップ）
    showFloatingComment(key, text, color, Date.now(), true, size);
  }

  async function startReplay() {
    if (replayTimer) stopReplay();
    const from = Math.max(1, parseInt(document.getElementById('replayFrom').value) || 1);
    const to   = Math.max(from, parseInt(document.getElementById('replayTo').value) || 10);
    const interval = parseInt(document.getElementById('replayInterval').value) || 1000;
    const status = document.getElementById('replayStatus');

    status.textContent = `Firebaseからtweetナンバー${from}〜${to}を取得中...`;
    document.getElementById('replayStartBtn').disabled = true;
    document.getElementById('replayStopBtn').disabled = false;

    // tweetNumberで範囲指定して取得
    let snapshot;
    try {
        snapshot = await db.ref('tweets')
            .orderByChild('tweetNumber')
            .startAt(from)
            .endAt(to)
            .once('value');
    } catch(e) {
        status.textContent = '取得失敗: ' + e.message;
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = true;
        return;
    }

    const entries = [];
    snapshot.forEach(child => { entries.push({ key: child.key, data: child.val() }); });
    // tweetNumber昇順でソート
    entries.sort((a, b) => (a.data.tweetNumber || 0) - (b.data.tweetNumber || 0));

    if (entries.length === 0) {
        status.textContent = `tweetナンバー${from}〜${to}の投稿がありません`;
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = true;
        return;
    }

    let idx = 0;
    function playNext() {
        if (idx >= entries.length) {
            status.textContent = `再現完了 (tweetナンバー${from}〜${to}、${entries.length}件)`;
            stopReplay();
            return;
        }
        const { key, data } = entries[idx];
        status.textContent = `再現中: tweetナンバー${data.tweetNumber} (${idx + 1}/${entries.length}件)`;
        if (data) {
            if (data.type === 'center_fixed') {
                showCenterFixedComment(key + '_r' + idx, data.text, data.color, Date.now(), true, data.size || 'medium');
            } else {
                showFloatingCommentReplay(key + '_r' + idx, data.text, data.color, data.size || 'medium');
            }
        }
        idx++;
        replayTimer = setTimeout(playNext, interval);
    }
    playNext();
  }

  function stopReplay() {
    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    document.getElementById('replayStartBtn').disabled = false;
    document.getElementById('replayStopBtn').disabled = true;
    document.getElementById('replayTxtStartBtn').disabled = false;
  }

  /**
   * txt一行をパースして { text, color, type, size } を返す
   * 書式: #NUM [日時] 名前: 内容 |color:XXX|type:YYY|size:ZZZ
   * ※ |size:ZZZ は旧バージョンのtxtには存在しないため省略可（その場合はmedium扱い）
   */
  function parseTxtLine(line) {
    // 末尾のメタタグを取り出す（sizeは旧形式との互換のため任意）
    const metaMatch = line.match(/\|color:([^\|]+)\|type:([^\|]+)(?:\|size:([^\|]+))?\s*$/);
    let savedColor = null;
    let savedType  = 'normal';
    let savedSize  = 'medium';
    let body = line;
    if (metaMatch) {
        savedColor = metaMatch[1].trim();
        savedType  = metaMatch[2].trim();
        savedSize  = metaMatch[3] ? metaMatch[3].trim() : 'medium';
        body = line.slice(0, metaMatch.index); // メタ部分を除いた行
    }

    // "#NNN [日時] 名前: 内容" の形式
    const m = body.match(/^#\S+\s+\[.*?\]\s+.+?:\s(.+)$/);
    if (!m) return null;
    let content = m[1].trim();
    let text, color, type, size;

    if (content.startsWith('【五千兆】')) {
        const bodyPart = content.replace('【五千兆】', '').trim();
        const spIdx = bodyPart.indexOf(' ');
        const part1 = spIdx >= 0 ? bodyPart.slice(0, spIdx) : bodyPart;
        const part2 = spIdx >= 0 ? bodyPart.slice(spIdx + 1) : '';
        text  = `__SPLIT__${part1}\n${part2}`;
        color = savedColor || '5000trillion';
        type  = savedType;
        size  = savedSize;
    } else if (content.startsWith('【ドット】')) {
        text  = content.replace('【ドット】', '');
        color = savedColor || 'dot';
        type  = savedType;
        size  = savedSize;
    } else {
        text  = content;
        color = savedColor || '#ffffff';
        type  = savedType;
        size  = savedSize;
    }
    return { text, color, type, size };
  }

  async function startTxtReplay() {
    const fileInput = document.getElementById('replayTxtFile');
    const status    = document.getElementById('replayStatus');
    if (!fileInput.files || fileInput.files.length === 0) {
        status.textContent = 'txtファイルを選択してください';
        return;
    }
    if (replayTimer) stopReplay();

    const interval = parseInt(document.getElementById('replayInterval').value) || 500;
    document.getElementById('replayTxtStartBtn').disabled = true;
    document.getElementById('replayStartBtn').disabled = true;
    document.getElementById('replayStopBtn').disabled = false;
    status.textContent = 'ファイル読み込み中...';

    const text = await fileInput.files[0].text();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    const targets = lines.map((l, i) => ({ line: l, idx: i }))
                         .filter(({ line }) => parseTxtLine(line) !== null);

    if (targets.length === 0) {
        status.textContent = '再生できる投稿がありません（形式が違う可能性があります）';
        document.getElementById('replayTxtStartBtn').disabled = false;
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = true;
        return;
    }

    let idx = 0;
    function playNextTxt() {
        if (idx >= targets.length) {
            status.textContent = `再現完了（${targets.length}件）`;
            stopReplay();
            return;
        }
        const { line } = targets[idx];
        const parsed = parseTxtLine(line);
        status.textContent = `再現中: ${idx + 1} / ${targets.length}件目`;
        if (parsed) {
            const key = 'txt_' + idx + '_' + Date.now();
            if (parsed.type === 'center_fixed') {
                showCenterFixedComment(key, parsed.text, parsed.color, Date.now(), true, parsed.size || 'medium');
            } else {
                showFloatingCommentReplay(key, parsed.text, parsed.color, parsed.size || 'medium');
            }
        }
        idx++;
        replayTimer = setTimeout(playNextTxt, interval);
    }
    playNextTxt();
  }

  function showFloatingComment(key, text, color, timestamp, skipSanitize = false, size = 'medium') {
    // skipSanitize=true のとき（リプレイ時）はDOMPurifyをスキップしてサロゲートペア文字を保持
    const sanitizedText = skipSanitize ? (text || '') : DOMPurify.sanitize(text, { USE_PROFILES: { html: true } });
    if (!skipSanitize && (containsSpam(sanitizedText) || containsForbiddenHtmlTags(text))) {
        console.log(`禁止コメントをスキップ（フローティング）: ${sanitizedText}`);
        return;
    }

    let displayText = sanitizedText;
    if (displayText.startsWith('__SPLIT__')) {
        const parts = displayText.replace('__SPLIT__', '').split('\n');
        displayText = `<div class="split-special">
            <span class="part-upper">${parts[0]}</span>
            <span class="part-lower">${parts[1] || ''}</span>
        </div>`;
    } else if (displayText.length > NORMAL_COMMENT_MAX_LENGTH) {
        displayText = displayText.substring(0, NORMAL_COMMENT_MAX_LENGTH) + "...";
    }

    // 5秒以上前のコメントは表示しない（タイムラグ対策）、リプレイ時(skipSanitize=true)はスキップ
    if (!skipSanitize && Date.now() - timestamp > 5000) {
        return;
    }


    if (activeFloatingComments.has(key)) {
        const existingCommentData = activeFloatingComments.get(key);
        if (existingCommentData.element && existingCommentData.element.parentNode) {
            existingCommentData.element.remove();
        }
        activeFloatingComments.delete(key);
    }

    const commentElement = document.createElement('div');
    commentElement.className = 'floating-comment';
    commentElement.classList.add('size-' + (size || 'medium'));
    commentElement.setAttribute('data-key', key); // Firebaseキーをデータ属性として設定

    if (color === 'rainbow') {
        commentElement.innerHTML = toRainbowText(displayText);
        commentElement.style.color = '';
    } else if (color === 'split_custom' || color === '5000trillion') {
        // 5000兆円のときは色を固定しない（CSSのグラデーションを優先する）
        commentElement.innerHTML = displayText;
        commentElement.style.color = ''; 
    } else if (color === 'dot') {
        commentElement.innerHTML = displayText;
        commentElement.style.color = '#FFFFFF';
        commentElement.classList.add('dot-font');
    } else {
        commentElement.innerHTML = displayText;
        commentElement.style.color = color || '#FFFFFF';
    }

    // ★★★ここを修正します★★★
    // 新しいフローティングコメントの親要素を取得
    const floatingCommentsWrapper = document.getElementById('floatingCommentsWrapper');
    if (floatingCommentsWrapper) {
        floatingCommentsWrapper.appendChild(commentElement); // 新しい親要素に追加
    } else {
        // フォールバック（もし floatingCommentsWrapper が見つからなかった場合）
        // 開発環境でデバッグしやすくするため、console.warn を追加しています
        commentArea.appendChild(commentElement); // 以前の commentArea に追加
        console.warn("Element with ID 'floatingCommentsWrapper' not found. Appending to 'commentArea' as fallback.");
    }
    // ★★★ここまで修正★★★

    // コメントの幅と親要素の幅を取得する際には、新しい親要素の幅を使うべきです。
    // floatingCommentsWrapper があればその幅を、なければ commentArea の幅を使用します。
    const parentWidth = floatingCommentsWrapper ? floatingCommentsWrapper.offsetWidth : commentArea.offsetWidth;

    const commentWidth = commentElement.offsetWidth;
    // commentAreaWidth は parentWidth に変更
    // const commentAreaWidth = commentArea.offsetWidth; // この行は不要になるか、parentWidthで代用

    const animationDurationMs = 10 * 1000; // 常に10秒 (ミリ秒単位)

    const startX = parentWidth; // 親要素の右端からスタート

    // getFloatingCommentYPosition 関数も、もし必要なら
    // floatingCommentsWrapper の高さに基づいて調整する必要があるかもしれません。
    // 現在は commentArea の高さを基準にしている可能性があるので、確認が必要です。
    const assignedY = getFloatingCommentYPosition(animationDurationMs);

    if (assignedY === null) {
        commentElement.remove();
        return;
    }
    commentElement.style.top = `${assignedY}px`;
    commentElement.style.left = `0px`;
    commentElement.style.transform = `translateX(${startX}px)`;
    commentElement.style.willChange = 'transform';

    const startTime = performance.now();
    const animationEndTime = startTime + animationDurationMs;

    activeFloatingComments.set(key, {
        element: commentElement,
        animationEndTime: animationEndTime,
        key: key,
        lineIndex: assignedY / (FLOATING_COMMENT_HEIGHT + FLOATING_COMMENT_MARGIN)
    });

    function animateFloatingComment() {
        const now = performance.now();
        const elapsed = now - startTime;

        if (elapsed < animationDurationMs) {
            const currentX = startX - (elapsed / animationDurationMs) * (startX + commentWidth);
            commentElement.style.transform = `translateX(${currentX}px)`;
            requestAnimationFrame(animateFloatingComment);
        } else {
            if (commentElement.parentNode) {
                commentElement.remove();
            }
            activeFloatingComments.delete(key);
        }
    }

    requestAnimationFrame(animateFloatingComment);
}

  function showCenterFixedComment(key, text, color, timestamp, skipSanitize = false, size = 'medium') {
    // skipSanitize=true（リプレイ時）: DOMPurifyをスキップしてサロゲートペア文字を保持
    const sanitizedText = skipSanitize ? (text || '') : DOMPurify.sanitize(text);

    // 表示前に各種フィルターを適用（リプレイ時はスキップ）
    if (!skipSanitize && (containsSpam(sanitizedText) || containsForbiddenHtmlTags(sanitizedText))) {
        console.log(`禁止コメントをスキップ（中央固定）: ${sanitizedText}`);
        return;
    }

    // リプレイ時はタイムスタンプチェックをスキップ
    if (!skipSanitize && Date.now() - timestamp > CENTRAL_COMMENT_LIFESPAN) {
        return;
    }

    // すでに存在する場合は更新
    if (activeCenterFixedComments.has(key)) {
        const existing = activeCenterFixedComments.get(key);
        existing.timestamp = timestamp;

        // 文字サイズクラスを更新
        existing.element.classList.remove('size-small', 'size-medium', 'size-large');
        existing.element.classList.add('size-' + (size || 'medium'));
        existing.element.dataset.size = size || 'medium';

        // ★★★ 既存のコメントを更新する部分を修正 ★★★
        if (color === 'rainbow') {
            existing.element.innerHTML = toRainbowText(sanitizedText);
            existing.element.style.color = '';
        } else if (color === '5000trillion' || color === 'split_custom') {
            const parts = text.replace('__SPLIT__', '').split('\n');
            const p1 = skipSanitize ? (parts[0] || '') : DOMPurify.sanitize(parts[0] || '');
            const p2 = skipSanitize ? (parts[1] || '') : DOMPurify.sanitize(parts[1] || '');
            existing.element.innerHTML = `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
            existing.element.style.color = '';
        } else {
            existing.element.innerHTML = sanitizedText;
            existing.element.style.color = color || '#FFFFFF';
        }

        adjustCenterFixedCommentFontSize(existing.element);
        updateCenterFixedCommentPositions();
        return;
    }

    const div = document.createElement('div');
    div.className = 'center-fixed-comment';
    div.classList.add('size-' + (size || 'medium'));
    div.dataset.size = size || 'medium';

    // ★★★ 新規コメントを作成する部分を修正 ★★★
    if (color === 'rainbow') {
        div.innerHTML = toRainbowText(sanitizedText);
        div.style.color = '';
    } else if (color === '5000trillion' || color === 'split_custom') {
        const parts = text.replace('__SPLIT__', '').split('\n');
        const p1 = skipSanitize ? (parts[0] || '') : DOMPurify.sanitize(parts[0] || '');
        const p2 = skipSanitize ? (parts[1] || '') : DOMPurify.sanitize(parts[1] || '');
        div.innerHTML = `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
        div.style.color = '';
    } else if (color === 'dot') {
        div.innerHTML = sanitizedText;
        div.style.color = '#FFFFFF';
        div.classList.add('dot-font');
    } else {
        div.innerHTML = sanitizedText;
        div.style.color = color || '#FFFFFF';
    }

    const floatingCommentsWrapper = document.getElementById('floatingCommentsWrapper');
    (floatingCommentsWrapper || commentArea).appendChild(div);
    activeCenterFixedComments.set(key, { element: div, timestamp: timestamp });

    adjustCenterFixedCommentFontSize(div);
    updateCenterFixedCommentPositions();

    // 指定時間経過後にコメントを削除
    setTimeout(() => {
        if (activeCenterFixedComments.has(key)) {
            activeCenterFixedComments.get(key).element.remove();
            activeCenterFixedComments.delete(key);
            updateCenterFixedCommentPositions(); // コメント削除後に位置を再調整
        }
    }, CENTRAL_COMMENT_LIFESPAN - (Date.now() - timestamp));
}
     
  function adjustCenterFixedCommentFontSize(element) {
      const targetWidth = commentArea.clientWidth * 0.9;
      const sizeScale = getSizeScale(element.dataset.size);
      const baseNormalSize = 70 * sizeScale;
      const baseSplitSize = 70 * sizeScale;

      const partUpper = element.querySelector('.part-upper');
      const partLower = element.querySelector('.part-lower');

      if (partUpper && partLower) {
          const splitSpecial = element.querySelector('.split-special');
          if (splitSpecial) {
              splitSpecial.style.flexWrap = 'nowrap';
              splitSpecial.style.whiteSpace = 'nowrap';
          }

          // 測定用の一時要素をbodyに追加して実幅を確実に取得
          const testDiv = document.createElement('div');
          testDiv.style.cssText = `
              position: fixed;
              top: -9999px;
              left: -9999px;
              visibility: hidden;
              white-space: nowrap;
              font-family: serif;
              font-weight: 900;
              font-style: italic;
              display: flex;
              flex-direction: row;
              gap: 8px;
          `;
          const testUpper = document.createElement('span');
          const testLower = document.createElement('span');
          testUpper.textContent = partUpper.textContent;
          testLower.textContent = partLower.textContent;
          testDiv.appendChild(testUpper);
          testDiv.appendChild(testLower);
          document.body.appendChild(testDiv);

          testUpper.style.fontSize = `${baseSplitSize}px`;
          testLower.style.fontSize = `${baseSplitSize}px`;
          const totalW = testDiv.offsetWidth;
          document.body.removeChild(testDiv);

          if (totalW > targetWidth && totalW > 0) {
              const scale = targetWidth / (totalW + 20); // 20px余裕を持たせて見切れ防止
              const newSize = Math.max(10, Math.floor(baseSplitSize * scale));
              partUpper.style.fontSize = `${newSize}px`;
              partLower.style.fontSize = `${newSize}px`;
          } else {
              partUpper.style.fontSize = `${baseSplitSize}px`;
              partLower.style.fontSize = `${baseSplitSize}px`;
          }

      } else {
          // 通常コメント
          element.style.whiteSpace = 'nowrap';
          // 測定用一時要素で実幅取得
          const testDiv = document.createElement('div');
          testDiv.style.cssText = `
              position: fixed;
              top: -9999px;
              left: -9999px;
              visibility: hidden;
              white-space: nowrap;
              font-size: ${baseNormalSize}px;
              font-weight: bold;
          `;
          testDiv.textContent = element.textContent;
          document.body.appendChild(testDiv);
          const textW = testDiv.offsetWidth;
          document.body.removeChild(testDiv);

          if (textW > targetWidth && textW > 0) {
              const scale = targetWidth / textW;
              const newSize = Math.max(10, Math.floor(baseNormalSize * scale));
              element.style.fontSize = `${newSize}px`;
          } else {
              element.style.fontSize = `${baseNormalSize}px`;
          }
      }
  }


  function updateCenterFixedCommentPositions() {
      const now = Date.now();
      const floatingCommentsWrapper = document.getElementById('floatingCommentsWrapper');
      const containerEl = floatingCommentsWrapper || commentArea;

      // 古いコメントを削除
      activeCenterFixedComments.forEach((comment, key) => {
          if (now - comment.timestamp > CENTRAL_COMMENT_LIFESPAN) {
              comment.element.remove();
              activeCenterFixedComments.delete(key);
          }
      });

      // 残った有効なコメントを新しい順にソート（新しいものほど下）
      const sortedComments = Array.from(activeCenterFixedComments.entries())
          .filter(([, comment]) => now - comment.timestamp <= CENTRAL_COMMENT_LIFESPAN)
          .sort(([, a], [, b]) => b.timestamp - a.timestamp);

      if (sortedComments.length === 0) {
          return;
      }

      const overlapOffset = 20; // コメントが重なる量
      let currentYFromBottom = 0;
      const containerHeight = containerEl.clientHeight;

      sortedComments.forEach(([key, comment]) => {
          if (!comment.element.parentNode) {
              comment.element.style.position = 'absolute';
              comment.element.style.visibility = 'hidden';
              comment.element.style.left = '50%';
              comment.element.style.bottom = '0';
              comment.element.style.transform = 'translateX(-50%)';
              containerEl.appendChild(comment.element);
          }

          // visibility:hidden のままレイアウトを計算
          comment.element.style.visibility = 'hidden';
          const commentHeight = comment.element.clientHeight;

          if (currentYFromBottom + commentHeight > containerHeight) {
              comment.element.remove();
              activeCenterFixedComments.delete(key);
              return;
          }

          comment.element.style.bottom = `${currentYFromBottom}px`;
          comment.element.style.left = '50%';
          comment.element.style.transform = 'translateX(-50%)';
          comment.element.style.visibility = 'visible';

          currentYFromBottom += commentHeight - overlapOffset;
      });
  }

  async function sha256(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer)); 
      const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hexHash;
  }

 async function submitTweet() {
    // --- 連打防止: 処理中はボタンを無効化 ---
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    // --- ここまで ---

    try {
    // --- バージョンチェックの追加 ---
    if (!isCurrentVersion) {
        alert('このバージョンは古くなっています。最新版をご利用ください。');
        return;
    }
    // --- ここまで ---

    const name = nicknameInput.value.trim();
    let text = ''; 
    
    // ▼「五千兆」と「通常」でテキスト取得を分ける▼
    if (predefinedColorSelect.value === 'split_custom') {
        const part1 = document.getElementById('comment_part1').value.trim();
        const part2 = document.getElementById('comment_part2').value.trim();
        if (part1 || part2) {
            text = `__SPLIT__${part1}\n${part2}`;
        }
    } else {
        text = commentInput.value.trim();
    }
    // ▲ここまで▲

    const commentType = commentTypeSelect.value;
    const commentSize = commentSizeSelect.value;
    const now = Date.now();

    if (!name || !text) {
        alert('名前と感想を入力してください。');
        return;
    }
    
    // コメントタイプに関わらずNORMAL_COMMENT_MAX_LENGTH（140字）を適用し、カットする
    // __SPLIT__フォーマットの場合は各パートに70字制限があるため、全体チェックをスキップ
    if (!text.startsWith('__SPLIT__') && text.length > NORMAL_COMMENT_MAX_LENGTH) {
        text = text.substring(0, NORMAL_COMMENT_MAX_LENGTH);
        alert(`コメントは${NORMAL_COMMENT_MAX_LENGTH}字にカットされました。`);
    }

    // サニタイズはカット後に行う（__SPLIT__プレフィックスを除いた部分のみチェック用にサニタイズ）
    const textForCheck = text.startsWith('__SPLIT__') ? text.replace('__SPLIT__', '') : text;
    const sanitizedTextForCheck = DOMPurify.sanitize(textForCheck);

    // 禁止タグのチェック
    if (containsForbiddenHtmlTags(sanitizedTextForCheck)) {
        alert('投稿内容に禁止されているHTML要素が含まれています。');
        return;
    }
    
    // スパムキーワードのチェック
    if (containsSpam(sanitizedTextForCheck)) {
        alert('投稿内容に不適切な表現が含まれているため送信できません。');
        return;
    }

    // 中央固定コメントの場合、投稿間隔制限をスキップ
    if (commentType !== 'center_fixed') {
        // 同一人物の投稿間隔制限
        if (userLastPostTime[name] && (now - userLastPostTime[name] < MIN_POST_INTERVAL_PER_USER)) {
            const remainingTime = Math.ceil((MIN_POST_INTERVAL_PER_USER - (now - userLastPostTime[name])) / 1000);
            alert(`${name}さんの連続投稿は、${remainingTime}秒待ってから投稿してください。`);
            return;
        }
    }

    const textHash = await sha256(sanitizedTextForCheck); 
    if (!userRecentPosts[name]) {
        userRecentPosts[name] = [];
    }

    // 1分間の同一内容コメントのフィルタリングとチェック
    userRecentPosts[name] = userRecentPosts[name].filter(post => now - post.timestamp < SAME_CONTENT_RATE_LIMIT_1MIN);
    let sameContentCount1Min = userRecentPosts[name].filter(post => post.textHash === textHash).length;

    if (sameContentCount1Min >= MAX_SAME_CONTENT_1MIN) {
        alert(`同一内容の連続投稿は1分間に${MAX_SAME_CONTENT_1MIN}回までです。（${MAX_SAME_CONTENT_1MIN + 1}回目）`);
        return; 
    }

    // 5分間の同一内容コメントのフィルタリングとチェック
    const userRecentPosts5Min = userRecentPosts[name].filter(post => now - post.timestamp < SAME_CONTENT_RATE_LIMIT_5MIN);
    let sameContentCount5Min = userRecentPosts5Min.filter(post => post.textHash === textHash).length;

    if (sameContentCount5Min >= MAX_SAME_CONTENT_5MIN) {
        alert(`同一内容の連続投稿は5分間に${MAX_SAME_CONTENT_5MIN}回までです。（${MAX_SAME_CONTENT_5MIN + 1}回目）`);
        return; 
    }
    
    const newTweetKey = String(now);
if (predefinedColorSelect.value === 'rainbow') {
    selectedColorValue = 'rainbow';
} else if (predefinedColorSelect.value === 'split_custom') {
    selectedColorValue = '5000trillion'; 
} else if (predefinedColorSelect.value === 'custom') { 
    selectedColorValue = commentColorPicker.value;
} else if (predefinedColorSelect.value === 'dot') {
    selectedColorValue = 'dot';
} else {
    selectedColorValue = predefinedColorSelect.value;
}

        // 累計コメント番号をtransactionで取得（最小限の通信）
        let tweetNumber = 1;
        await totalTweetCountRef.transaction((current) => {
            tweetNumber = (current || 0) + 1;
            return tweetNumber;
        });

        console.log({
    name,
    text,
    color: selectedColorValue,
    type: commentType,
    size: commentSize,
    reactions: 0,
    reactedUsers: {},
    parent: null,
    timestamp: now,
    tweetNumber: tweetNumber,
    appVersion: THIS_HTML_VERSION_KEY
});


        // 投稿データをtweets直下に書き込む
        await db.ref('tweets/' + newTweetKey).set({
            name,
            text: text,
            color: selectedColorValue,
            type: commentType,
            size: commentSize,
            reactions: 0,
            reactedUsers: {},
            parent: null,
            timestamp: now,
            tweetNumber: tweetNumber,
            appVersion: THIS_HTML_VERSION_KEY
        });

        // 書き込みカウントを別途更新
        await db.ref('usageStats/writeCount').set(currentWriteCount + 1);
        currentWriteCount++;

        userRecentPosts[name].push({ textHash: textHash, timestamp: now }); 
        userLastPostTime[name] = now; // 最終投稿時刻を更新
        limitComments();
      
        nicknameInput.value = name;

        // ▼投稿後のリセットとフォーカス処理▼
        // 中央固定は連打しやすいようフォームをクリアしない
        if (commentType !== 'center_fixed') {
            if (predefinedColorSelect.value === 'split_custom') {
                document.getElementById('comment_part1').value = '';
                document.getElementById('comment_part2').value = '';
            } else {
                commentInput.value = '';
            }
        }
        // ▲ここまで▲

    } catch (error) {
        console.error("ツイートの送信に失敗しました:", error);
        alert("ツイートの送信に失敗しました。詳細をコンソールで確認してください。");
    } finally {
        // 処理完了後（成功・失敗・バリデーションエラー問わず）ボタンを再有効化
        if (isCurrentVersion) {
            submitButton.disabled = false;
        }
    }
}

  form.addEventListener('submit', function(e) {
    e.preventDefault(); 
    submitTweet(); 

  });


  // リプレイパネルのイベント
  toggleRainbowCheckbox.addEventListener('change', () => {
      rainbowAnimEnabled = toggleRainbowCheckbox.checked;
      localStorage.setItem('rainbowAnimEnabled', rainbowAnimEnabled);
      document.body.classList.toggle('rainbow-anim-off', !rainbowAnimEnabled);
  });

  document.getElementById('replayStartBtn').addEventListener('click', startReplay);
  document.getElementById('replayStopBtn').addEventListener('click', stopReplay);
  document.getElementById('replayTxtStartBtn').addEventListener('click', startTxtReplay);
  document.getElementById('replayInterval').addEventListener('input', function() {
      document.getElementById('replayIntervalLabel').textContent = (this.value / 1000).toFixed(1) + '秒';
  });

  document.fonts.ready.then(() => {
    // フォント読み込み完了後にselectを強制再描画（初回ロード時の文字切れ対策）
    [predefinedColorSelect, commentTypeSelect].forEach(el => {
        el.style.display = 'none';
        void el.offsetHeight; // reflow
        el.style.display = '';
    });

    // フォント確定後にh1サイズを調整
    balanceHeader();

    const colorPickerContainer = document.getElementById('colorPickerContainer');

    // predefinedColor の値に応じてUIを切り替える関数（カラーピッカー＋splitInput）
    function onPredefinedColorChange() {
        const val = predefinedColorSelect.value;
        const isSplit = val === 'split_custom';
        // splitInputContainer の切り替え
        document.getElementById('comment').style.display = isSplit ? 'none' : 'block';
        document.getElementById('splitInputContainer').style.display = isSplit ? 'flex' : 'none';
        document.getElementById('comment').required = !isSplit;
        // カラーピッカーの切り替え
        colorPickerContainer.style.display = (val === 'custom') ? 'flex' : 'none';
    }

    // ページ読み込み時に一度実行
    onPredefinedColorChange();

    // 選択肢が変わったときに実行（リスナーはここの1か所のみ）
    predefinedColorSelect.addEventListener('change', () => {
        onPredefinedColorChange();
        saveSettingsToLocalStorage();
    });

    // カラーピッカーの値が変更されたときにも保存
    commentColorPicker.addEventListener('input', () => {
        saveSettingsToLocalStorage();
    });

    // 文字サイズが変更されたときにも保存
    commentSizeSelect.addEventListener('change', () => {
        saveSettingsToLocalStorage();
    });

    loadSettingsFromLocalStorage();
});

     
  function updateUserStats() {
    let tempUserCounts = {};
    let tempUserFirstTweetTime = {}; 
    const uniqueUsers = new Set(); 

    // 直近100件のみを対象にする
    const allKeys = Object.keys(allTweets).sort((a, b) => parseInt(b) - parseInt(a)); // 新しい順
    const recentKeys = new Set(allKeys.slice(0, 100));

    for (const key in allTweets) {
        if (!recentKeys.has(key)) continue; // 直近100件以外はスキップ
        const tweet = allTweets[key];
        const sanitizedText = tweet && tweet.text ? DOMPurify.sanitize(tweet.text) : '';
        
        // 統計情報更新時も各種フィルターを適用
        if (tweet && tweet.name && 
            !containsSpam(sanitizedText) && 
            !containsForbiddenHtmlTags(sanitizedText) &&
            !isSameContentRateLimited(tweet.name, sanitizedText, tweet.timestamp) && // 同一内容コメントチェック
            (tweet.type === 'center_fixed' || !isPostIntervalViolated(tweet.name, tweet.timestamp)) // 中央固定コメントは間隔制限なし
        ) { 
            if (!tempUserCounts[tweet.name]) {
                tempUserCounts[tweet.name] = 0;
            }
            tempUserCounts[tweet.name]++;
            uniqueUsers.add(tweet.name); 

            if (!tempUserFirstTweetTime[tweet.name] || tweet.timestamp < tempUserFirstTweetTime[tweet.name]) {
                tempUserFirstTweetTime[tweet.name] = tweet.timestamp;
            }
        }
    }
    userCounts = tempUserCounts;
    userFirstTweetTime = tempUserFirstTweetTime; 
    renderUserStats(); 
  }

    // 同一内容のコメント制限をチェックするヘルパー関数
    function isSameContentRateLimited(name, text, timestamp) {
        const textHash = calculateTweetHash(text); // テキストハッシュを再計算または取得

        const recentPostsForUser = Object.values(allTweets).filter(
            t => t.name === name && calculateTweetHash(t.text) === textHash && t.timestamp <= timestamp
        ).sort((a, b) => a.timestamp - b.timestamp);

        // 1分間のチェック
        const postsInLast1Min = recentPostsForUser.filter(
            t => timestamp - t.timestamp < SAME_CONTENT_RATE_LIMIT_1MIN
        );
        if (postsInLast1Min.length > MAX_SAME_CONTENT_1MIN) {
            return true;
        }

        // 5分間のチェック
        const postsInLast5Min = recentPostsForUser.filter(
            t => timestamp - t.timestamp < SAME_CONTENT_RATE_LIMIT_5MIN
        );
        if (postsInLast5Min.length > MAX_SAME_CONTENT_5MIN) {
            return true;
        }

        return false;
    }
    
    // 投稿間隔をチェックするヘルパー関数
    function isPostIntervalViolated(name, timestamp) {
        const postsForUser = Object.values(allTweets).filter(
            t => t.name === name && t.timestamp < timestamp && t.type !== 'center_fixed' // 中央固定コメントはチェックしない
        ).sort((a, b) => b.timestamp - a.timestamp); // 最新の投稿からチェック

        if (postsForUser.length > 0) {
            const previousPostTime = postsForUser[0].timestamp;
            if (timestamp - previousPostTime < MIN_POST_INTERVAL_PER_USER) {
                return true;
            }
        }
        return false;
    }

    // `sha256`の同期版（実際にはPromiseを返すので、呼び出し側でawaitが必要）
    // allTweetsの初期ロード時に同期的に使えるように調整（ここではPromiseを考慮して仮実装）
    function calculateTweetHash(text) {
        // Warning: This is a simplified, non-cryptographic hash for demonstration.
        // For actual security, await sha256(text) would be needed.
        // For filtering existing tweets, a simple string hash for quick comparison is sufficient.
        let hash = 0;
        if (text.length === 0) return hash;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }


  function renderUserStats() {
    const sortedByCount = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);

    // 固定スロット3つを取得してリセット
    const slots = [
        document.getElementById('top-rank-1'),
        document.getElementById('top-rank-2'),
        document.getElementById('top-rank-3'),
    ];
    const rankLabels = ['1位', '2位', '3位'];
    slots.forEach((slot, i) => {
        slot.textContent = `${rankLabels[i]}: ―`;
        slot.style.opacity = '0.4';
    });
    // 同率情報の古いliを除去
    topUserList.querySelectorAll('.equal-rank-info').forEach(el => el.remove());

    if (sortedByCount.length > 0) {
        const top3Names = [];
        let lastCount = -1;
        let currentRank = 0;
        let slotIndex = 0;

        for (let i = 0; i < sortedByCount.length && slotIndex < 3; i++) {
            const [user, count] = sortedByCount[i];
            if (count !== lastCount) currentRank = i + 1;
            if (currentRank <= 3) {
                slots[slotIndex].textContent = `${rankLabels[slotIndex]}: ${user}　${count}件`;
                slots[slotIndex].style.opacity = '1';
                top3Names.push(user);
                slotIndex++;
            }
            lastCount = count;
        }

        // 同率情報
        const top3Scores = new Set();
        if (sortedByCount[0]) top3Scores.add(sortedByCount[0][1]);
        if (sortedByCount[1]) top3Scores.add(sortedByCount[1][1]);
        if (sortedByCount[2]) top3Scores.add(sortedByCount[2][1]);
        const equalRankCounts = {};
        for (const [user, count] of sortedByCount) {
            if (!top3Names.includes(user) && top3Scores.has(count)) {
                equalRankCounts[count] = (equalRankCounts[count] || 0) + 1;
            }
        }
        for (const score in equalRankCounts) {
            const li = document.createElement('li');
            li.className = 'equal-rank-info';
            li.textContent = `同率${equalRankCounts[score]}人: ${score}件`;
            topUserList.appendChild(li);
        }
    }

    // top3の内容が変わったのでヘッダーバランスを再調整
    requestAnimationFrame(() => balanceHeader());

    allUserList.innerHTML = '';
    if (sortedByCount.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'まだ投稿者がいません。';
        allUserList.appendChild(li);
    } else {
        const sortedAllUsers = Object.entries(userCounts).sort((a, b) => {
            const countA = a[1];
            const countB = b[1];
            const nameA = a[0];
            const nameB = b[0];

            if (countB !== countA) {
                return countB - countA; 
            } else {
                const timeA = userFirstTweetTime[nameA] || 0; 
                const timeB = userFirstTweetTime[nameB] || 0;
                return timeA - timeB; 
            }
        });

        sortedAllUsers.forEach(([user, count]) => {
            const li = document.createElement('li');
            li.textContent = `${user}: ${count} 件`;
            allUserList.appendChild(li);
        });
    }
  }


  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  function updateTweetDisplay(tweetElement, tweetData) {
    const tweetTextElement = tweetElement.querySelector('.tweet-text-content');
    const toggleButton = tweetElement.querySelector('.toggle-text-button');
    const tweetFooter = tweetElement.querySelector('.tweet-footer');

    if (!tweetTextElement) {
        console.warn("tweetTextElement not found for tweet key:", tweetElement.getAttribute('data-key'));
        return;
    }

    // 虹色と通常色の表示を正しく処理
    const sanitizedText = DOMPurify.sanitize(tweetData.text, { USE_PROFILES: { html: false } });
    if (tweetData.color === 'rainbow') {
        tweetTextElement.innerHTML = toRainbowText(sanitizedText);
        tweetTextElement.style.color = 'initial';
    } else if (tweetData.color === '5000trillion' || tweetData.color === 'split_custom') {
        // appendTweetToStream で既にHTMLをセット済みのため何もしない
    } else {
        tweetTextElement.textContent = sanitizedText;
        tweetTextElement.style.color = tweetData.color || '#FFFFFF';
    }

    // 判定のために、一時的に短縮表示のスタイルを適用
    const is5000 = tweetData.color === '5000trillion' || tweetData.color === 'split_custom';
    const tempClass = is5000 ? 'temp-clamp-2' : 'temp-clamp';
    if (is5000) tweetTextElement.classList.add('clamp-2');
    else tweetTextElement.classList.remove('clamp-2');

    if (is5000) {
        const splitSpecial = tweetTextElement.querySelector('.split-special');
        if (!splitSpecial) {
            tweetTextElement.classList.add('no-toggle');
            return;
        }

        // clamped クラスをリセット
        splitSpecial.classList.remove('clamped');
        tweetTextElement.classList.remove('clamp-2');
        tweetTextElement.style.maxHeight = '';
        tweetTextElement.style.overflow = '';

        // DOMが確実にレイアウトされた後に高さを測定するためrAFを2回ネスト
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const pu = splitSpecial.querySelector('.part-upper');
            const pl = splitSpecial.querySelector('.part-lower');

            if (!pu || !pl) {
                tweetTextElement.classList.add('no-toggle');
                return;
            }

            const lineHeight = parseFloat(getComputedStyle(pu).lineHeight) || 34.1;
            const twoLineHeight = lineHeight * 2;

            // maxHeightをリセットして正確な高さを取得
            tweetTextElement.style.maxHeight = '';
            tweetTextElement.style.overflow = '';
            // .tweet内ではsplit-specialがinline表示になっているため
            // 測定前だけ一時的にflex縦並びに戻して正確な高さを取得する
            splitSpecial.style.display = 'flex';
            splitSpecial.style.flexDirection = 'column';
            const puTemp = splitSpecial.querySelector('.part-upper');
            const plTemp = splitSpecial.querySelector('.part-lower');
            if (puTemp) puTemp.style.display = 'block';
            if (plTemp) plTemp.style.display = 'block';

            void splitSpecial.offsetHeight; // 強制reflow
            const measuredHeight = splitSpecial.offsetHeight;

            // 表示を元に戻す
            splitSpecial.style.display = '';
            splitSpecial.style.flexDirection = '';
            if (puTemp) puTemp.style.display = '';
            if (plTemp) plTemp.style.display = '';

            const needsClamp = measuredHeight > twoLineHeight * 1.05;

            let existingButton = tweetElement.querySelector('.toggle-text-button');

            if (needsClamp) {
                tweetTextElement.style.maxHeight = `${twoLineHeight}px`;
                tweetTextElement.style.overflow = 'hidden';
                tweetTextElement.classList.add('clamp-2');
                tweetTextElement.classList.remove('no-toggle');

                if (!existingButton) {
                    existingButton = document.createElement('button');
                    existingButton.className = 'toggle-text-button';
                    tweetTextElement.insertAdjacentElement('afterend', existingButton);
                }
                existingButton.style.display = 'block';
                existingButton.textContent = tweetTextElement.classList.contains('expanded') ? '折りたたむ' : 'もっと見る';
                existingButton.onclick = () => {
                    const isExpanded = tweetTextElement.classList.toggle('expanded');
                    tweetTextElement.style.maxHeight = isExpanded ? '' : `${twoLineHeight}px`;
                    tweetTextElement.style.overflow = isExpanded ? '' : 'hidden';
                    existingButton.textContent = isExpanded ? '折りたたむ' : 'もっと見る';
                };
            } else {
                tweetTextElement.style.maxHeight = '';
                tweetTextElement.style.overflow = '';
                tweetTextElement.style.display = '';
                tweetTextElement.classList.remove('expanded', 'clamp-2');
                tweetTextElement.classList.add('no-toggle');
                splitSpecial.classList.remove('clamped');
                const allButtons = tweetElement.querySelectorAll('.toggle-text-button');
                allButtons.forEach(b => b.style.display = 'none');
            }
        }));
        return;
    }

    tweetTextElement.classList.add(tempClass);
    
    requestAnimationFrame(() => {
        const isOverflown = tweetTextElement.scrollHeight > tweetTextElement.clientHeight;
        tweetTextElement.classList.remove(tempClass);

        if (isOverflown) {
            // もし、ボタンがまだなければ作成
            if (!toggleButton) {
                const newButton = document.createElement('button');
                newButton.className = 'toggle-text-button';
                tweetTextElement.insertAdjacentElement('afterend', newButton);
            }

            const existingButton = tweetElement.querySelector('.toggle-text-button');
            if (existingButton) {
                existingButton.style.display = 'block';
                tweetTextElement.classList.remove('no-toggle');

                if (tweetTextElement.classList.contains('expanded')) {
                    existingButton.textContent = '折りたたむ';
                } else {
                    existingButton.textContent = 'もっと見る';
                }

                existingButton.onclick = () => {
                    tweetTextElement.classList.toggle('expanded');
                    if (tweetTextElement.classList.contains('expanded')) {
                        existingButton.textContent = '折りたたむ';
                    } else {
                        existingButton.textContent = 'もっと見る';
                    }
                };
            }
        } else {
            // 短縮表示が不要な場合
            if (toggleButton) {
                toggleButton.style.display = 'none';
            }
            tweetTextElement.classList.remove('expanded');
            tweetTextElement.classList.add('no-toggle');
        }
    });
}
// ↓↓↓ appendTweetToLog 関数 ↓↓↓
function appendTweetToLog(key, text, color, timestamp, user) {
    const logCommentDiv = document.createElement('div');
    logCommentDiv.className = 'log-comment';
    logCommentDiv.setAttribute('data-key', key);

    const displayTime = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const userSpan = document.createElement('span');
    userSpan.className = 'log-user';
    userSpan.textContent = user + ': ';
    userSpan.style.color = '#FFFFFF';

    const contentSpan = document.createElement('span');
    contentSpan.className = 'log-content';
    // __SPLIT__フォーマットの場合はパーツを分解して表示用テキストを生成
    let displayTextForLog = text;
    if (text && text.startsWith('__SPLIT__')) {
        const parts = text.replace('__SPLIT__', '').split('\n');
        displayTextForLog = `【五千兆】${parts[0]} ${parts[1] || ''}`;
    }
    let originalText = DOMPurify.sanitize(displayTextForLog, { USE_PROFILES: { html: false } });

    if (color === 'rainbow') {
        contentSpan.innerHTML = toRainbowText(originalText);
    } else if (color === '5000trillion' || color === 'split_custom') {
        // 5000兆円はログでは特別な色付きテキストで表示
        contentSpan.innerHTML = toRainbowText(originalText);
    } else {
        contentSpan.textContent = originalText;
        contentSpan.style.color = color || '#E0E0E0';
    }

    logCommentDiv.appendChild(document.createTextNode(`[${displayTime}] `));
    logCommentDiv.appendChild(userSpan);
    logCommentDiv.appendChild(contentSpan);

    // DOMに追加してから高さをチェック
    logContainer.insertBefore(logCommentDiv, logContainer.firstChild);

    // 短縮表示が必要かどうかのチェック
    // CSSのline-clampが適用された後、scrollHeightがclientHeightより大きいかを判定
    // NOTE: このチェックは非同期で行う必要がある場合があります。
    // requestAnimationFrameを使用することで、DOM描画後の正確な値を取得できます。
    requestAnimationFrame(() => {
        const is5000 = color === '5000trillion' || color === 'split_custom';
        const shortenedClass = is5000 ? 'shortened-5000' : 'shortened';

        let isOverflowing;
        if (is5000) {
            // spanの塊にはscrollHeight計測が効かないため文字数で判定
            const plainLen = DOMPurify.sanitize(originalText, { ALLOWED_TAGS: [] }).length;
            isOverflowing = plainLen > 20;
        } else {
            contentSpan.classList.add(shortenedClass);
            isOverflowing = contentSpan.scrollHeight > contentSpan.clientHeight;
            contentSpan.classList.remove(shortenedClass);
        }

        if (isOverflowing) {
            contentSpan.classList.add(shortenedClass);

            const toggleLink = document.createElement('a');
            toggleLink.href = 'javascript:void(0)';
            toggleLink.className = 'log-toggle-link';
            toggleLink.textContent = 'もっと見る';
            contentSpan.insertAdjacentElement("afterend", toggleLink);

            toggleLink.onclick = function() {
                if (contentSpan.classList.contains(shortenedClass)) {
                    contentSpan.classList.remove(shortenedClass);
                    contentSpan.classList.add('expanded');
                    toggleLink.textContent = '折りたたむ';
                } else {
                    contentSpan.classList.add(shortenedClass);
                    contentSpan.classList.remove('expanded');
                    toggleLink.textContent = 'もっと見る';
                }
            };
        }
    });
}
// ↑↑↑ appendTweetToLog 関数 ↑↑↑
function appendTweetToStream(key, data, tweetIndex, isNewTweet = false) {
    // __SPLIT__フォーマットの場合はプレフィックスを除いたテキストでチェック
    const rawText = (data.text && data.text.startsWith('__SPLIT__'))
        ? data.text.replace('__SPLIT__', '').replace('\n', ' ')
        : data.text;
    const sanitizedText = DOMPurify.sanitize(rawText);
    const now = Date.now();

    // フィルタリングロジック（__SPLIT__除去後のテキストでチェック）
    if (containsSpam(sanitizedText) || containsForbiddenHtmlTags(sanitizedText) ||
        sanitizedText.length > NORMAL_COMMENT_MAX_LENGTH ||
        (data.type !== 'center_fixed' && isPostIntervalViolated(data.name, data.timestamp)) ||
        isSameContentRateLimited(data.name, sanitizedText, data.timestamp)) {
        console.log(`禁止コメントをスキップ： ${sanitizedText}`);
        removeTweetFromDOMAndMaps(key);
        delete allTweets[key];
        return;
    }

    let div = tweetDomCache.get(key) || document.querySelector(`.tweet[data-key="${key}"]`);
    if (!div) {
        div = document.createElement("div");
        div.className = "tweet";
        tweetDomCache.set(key, div);
        div.setAttribute('data-key', key);
        div.setAttribute('data-timestamp', data.timestamp);

        let inserted = false;
        const tweets = Array.from(tweetStream.children);
        for (let i = 0; i < tweets.length; i++) {
            const existingKey = tweets[i].getAttribute('data-key');
            if (parseInt(key) > parseInt(existingKey)) {
                tweetStream.insertBefore(div, tweets[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            tweetStream.appendChild(div);
        }
    }

    const formattedTime = formatTimestamp(data.timestamp);
    const reacted = data.reactedUsers && data.reactedUsers[currentUser];
    const reactionCount = data.reactions || 0;
    const originalName = data.name
    // 投稿者名が匿名かどうかをチェック
    const isAnonymousPost = !originalName || originalName.trim() === '';
    const maxNameLength = 15;
    const displayUserName = originalName.length > maxNameLength ? originalName.substring(0, maxNameLength) + '...' : originalName;
    const currentTweetNumber = data.tweetNumber || tweetIndex || 0;
    const isLongText = sanitizedText.length > MAX_LOG_COMMENT_LENGTH;
    const isOverFlow = isLongText; // 暫定的な判断。日本語対応は後述のJSで実施。
    const tweetElementWidth = div.offsetWidth;

    let commentContentHtml = '';
    let pStyle = '';

    if (data.color === 'rainbow') {
        commentContentHtml = toRainbowText(sanitizedText);
        pStyle = 'style="color: initial;"';
    } else if (data.color === '5000trillion' || data.color === 'split_custom') {
        // __SPLIT__フォーマットを投稿ストリーム用にHTMLに変換
        if (data.text && data.text.startsWith('__SPLIT__')) {
            const parts = data.text.replace('__SPLIT__', '').split('\n');
            const p1 = DOMPurify.sanitize(parts[0] || '');
            const p2 = DOMPurify.sanitize(parts[1] || '');
            commentContentHtml = `<div class="split-special"><span class="part-upper">${p1}</span><span class="part-lower">${p2}</span></div>`;
        } else {
            commentContentHtml = sanitizedText;
        }
        pStyle = 'style="color: initial; overflow: visible;"';
    } else if (data.color === 'dot') {
        commentContentHtml = sanitizedText;
        pStyle = 'style="color: #FFFFFF;"';
        div.classList.add('dot-font');
    } else {
        commentContentHtml = sanitizedText;
        pStyle = `style="color: ${data.color || '#FFFFFF'};"`;
    }

    div.innerHTML = `
    <div class="tweet-header">
        <strong>#${currentTweetNumber} @${displayUserName}</strong>
    </div>
    <div class="tweet-text-content" ${pStyle}>${commentContentHtml}</div>
    <div class="log-actions" style="display: ${isOverFlow ? 'flex' : 'none'};">
        <button class="toggle-log-btn">もっと見る</button>
    </div>
    <div class="tweet-footer">
        <div class="actions">
            <button class="reaction-btn" style="color: ${reacted ? '#87CEEB' : '#ccc'};" ${isAnonymousPost ? 'disabled' : ''}>
                👍️ ${reactionCount}
            </button>
        </div>
        <div class="timestamp">${formattedTime}</div>
    </div>
`;

    updateTweetDisplay(div, data);

    if (!toggleLogDisplayCheckbox.checked) {
        div.style.display = 'none';
    } else {
        div.style.display = 'block';
    }

    const reactionBtn = div.querySelector(".actions .reaction-btn");
    if (reactionBtn) {
        reactionBtn.onclick = async () => {
            // いいねをするユーザーが名前を記入しているかをチェック
            const currentUserName = nicknameInput.value;
            const isAnonymousUser = !currentUserName || currentUserName.trim() === '';
            if (isAnonymousUser) {
                alert('「いいね」をするには、フォームに名前を入力してください。');
                return; // 処理をここで中断
            }
            
            // 投稿者名が匿名の場合、ボタンはdisabledになっているため処理は実行されない
            
            // トランザクション処理を使って、いいね数の増減を安全に行う
            const reactionsRef = db.ref('tweets/' + key + '/reactions');
            const reactedUsersRef = db.ref('tweets/' + key + '/reactedUsers');
            
            const reactedUsers = (await reactedUsersRef.once('value')).val() || {};
            
            if (reactedUsers[currentUser]) {
                // すでにいいねしている場合、取り消す
                delete reactedUsers[currentUser];
                await reactedUsersRef.set(reactedUsers);
                
                // いいね数をデクリメント
                reactionsRef.transaction((currentCount) => {
                    return (currentCount || 0) - 1;
                });
                
            } else {
                // いいねしていない場合、追加する
                reactedUsers[currentUser] = true;
                await reactedUsersRef.set(reactedUsers);
                
                // いいね数をインクリメント
                reactionsRef.transaction((currentCount) => {
                    return (currentCount || 0) + 1;
                });
            }
        }; // ここでonclickのブロックが閉じます
    } // ここでif(reactionBtn)のブロックが閉じます
    
    updateUserStats();

    if (isNewTweet) {
        // フローティング表示より先にキューに積んで遅延を最小化
        enqueueSpeech(data.text, data.color);
        if (data.type === 'center_fixed') {
            showCenterFixedComment(key, data.text, data.color, data.timestamp, false, data.size || 'medium');
        } else {
            showFloatingComment(key, data.text, data.color, data.timestamp, false, data.size || 'medium');
        }
    }
} // ここで関数全体が閉じます

  // DOMとコメント管理マップからツイートを削除するヘルパー関数
  function removeTweetFromDOMAndMaps(key) {
      tweetDomCache.delete(key);
      const existingDiv = document.querySelector(`.tweet[data-key="${key}"]`);
      if (existingDiv) {
          existingDiv.remove();
      }
      if (activeCenterFixedComments.has(key)) {
          activeCenterFixedComments.get(key).element.remove();
          activeCenterFixedComments.delete(key);
          updateCenterFixedCommentPositions();
      }
      if (activeFloatingComments.has(key)) {
          activeFloatingComments.get(key).element.remove();
          activeFloatingComments.delete(key);
      }
  }


  async function loadInitialTweetsAndMonitorChanges() {
    showLoading('読み込み中…');
    db.ref('tweets').off(); 

    if (toggleLogDisplayCheckbox.checked) { 
      tweetStream.innerHTML = ''; 
    }
    userCounts = {}; 
    userFirstTweetTime = {}; 
    activeFloatingComments.forEach(comment => comment.element.remove());
    activeFloatingComments.clear();
    activeCenterFixedComments.forEach(comment => comment.element.remove());
    activeCenterFixedComments.clear();
    allTweets = {}; 

    try {
        const snapshot = await db.ref('tweets').orderByKey().limitToLast(100).once('value');
        await incrementReadCount();


        const data = snapshot.val();
        if (data) {
            // 初期ロード時は全データを一旦allTweetsに格納
            Object.assign(allTweets, data);

            // config/totalTweetCount が未設定の場合、既存ツイートの最大tweetNumberで初期化
            const totalCountSnapshot = await totalTweetCountRef.once('value');
            if (!totalCountSnapshot.val()) {
                const maxTweetNumber = Object.values(allTweets).reduce((max, t) => {
                    return Math.max(max, t.tweetNumber || 0);
                }, 0);
                if (maxTweetNumber > 0) {
                    await totalTweetCountRef.set(maxTweetNumber);
                    console.log(`totalTweetCount を ${maxTweetNumber} に初期化しました。`);
                }
            }

            const sortedKeysAscending = Object.keys(allTweets).sort((a, b) => parseInt(a) - parseInt(b));
            
            const fragment = document.createDocumentFragment();
            const _origParent = tweetStream;
            // DocumentFragmentに一時的にappendして最後にまとめてDOMに追加
            sortedKeysAscending.forEach((key, index) => {
                const tweet = allTweets[key];
                appendTweetToStream(key, tweet, index + 1, false);
            });
            // ※ appendTweetToStreamがtweetStreamに直接appendするため
            // Fragment化は構造上困難。代わりにrAFで非同期描画に分散。

            // フォント読み込み完了後に5000兆円ツイートを再評価
            document.fonts.ready.then(() => {
                requestAnimationFrame(() => {
                    sortedKeysAscending.forEach((key) => {
                        const tweet = allTweets[key];
                        if (tweet.color === '5000trillion' || tweet.color === 'split_custom') {
                            const div = document.querySelector(`.tweet[data-key="${key}"]`);
                            if (div) updateTweetDisplay(div, tweet);
                        }
                    });
                });
            });
        }
        updateUserStats();
    } catch (error) {
        console.error("初期データの読み込みに失敗しました:", error);
    }
  }

  // =============================================
  // 読み上げ機能 (Web Speech API / SpeechSynthesis)
  // =============================================
  const toggleSpeechCheckbox = document.getElementById('toggleSpeechCheckbox');
  let speechEnabled = false;
  let speechQueue = []; // 読み上げキュー
  let isSpeaking = false;

  toggleSpeechCheckbox.addEventListener('change', function() {
      speechEnabled = this.checked;
      if (!speechEnabled) {
          speechQueue = [];
          isSpeaking = true; // onendが発火しても再開しないよう先にブロック
          window.speechSynthesis.cancel();
          isSpeaking = false;
      }
  });

  /**
   * コメントデータからプレーンテキストを生成して読み上げキューに追加する
   * @param {string} name - 投稿者名
   * @param {string} rawText - Firebaseの生テキスト（__SPLIT__含む）
   * @param {string} color - カラー種別
   */
  function enqueueSpeech(rawText, color) {
      if (!speechEnabled) return;

      let plainText = '';
      if (rawText && rawText.startsWith('__SPLIT__')) {
          const parts = rawText.replace('__SPLIT__', '').split('\n');
          plainText = `${parts[0] || ''} ${parts[1] || ''}`.trim();
      } else {
          plainText = rawText || '';
      }

      plainText = DOMPurify.sanitize(plainText, { ALLOWED_TAGS: [] });
      if (!plainText) return;

      // キューが10件以上たまったら古いものを切り捨て
      if (speechQueue.length >= 10) {
          speechQueue.splice(0, speechQueue.length - 9);
      }
      speechQueue.push(plainText);
      processSpeechQueue();
  }

  function processSpeechQueue() {
      if (isSpeaking || speechQueue.length === 0) return;

      const text = speechQueue.shift();
      isSpeaking = true;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.6;
      utterance.pitch = 1.0;

      if (cachedJaVoice) utterance.voice = cachedJaVoice;

      let done = false;
      const onDone = () => {
          if (done) return;
          done = true;
          isSpeaking = false;
          processSpeechQueue();
      };
      utterance.onend = onDone;
      utterance.onerror = onDone;

      window.speechSynthesis.speak(utterance);
  }

  // 音声をキャッシュして毎回getVoicesを呼ばないようにする
  let cachedJaVoice = null;
  function cacheVoice() {
      const voices = window.speechSynthesis.getVoices();
      cachedJaVoice = voices.find(v => v.lang === 'ja-JP') || voices.find(v => v.lang.startsWith('ja')) || null;
  }
  window.speechSynthesis.onvoiceschanged = cacheVoice;
  cacheVoice();
  // =============================================
  // 読み上げ機能ここまで
  // =============================================

  function setupRealtimeListeners() {
    console.log("setupRealtimeListeners が実行されました。");

    // すべてのリスナーを一度オフにする
    db.ref('tweets').off(); // child_changed, child_removed をオフ
    if (tweetsQueryRef) { tweetsQueryRef.off(); tweetsQueryRef = null; } // child_addedクエリをオフ
    db.ref('presence').off('value');

    if (!isCurrentVersion) {
      console.warn("古いバージョンであるため、リアルタイムリスナーは設定されません。");
      return;
    }

    // child_added リスナー
    // startAfter(lastKey) により、初期ロード済みの件数分はFirebaseから流れてこない
    const loadedKeys = Object.keys(allTweets).sort((a, b) => parseInt(a) - parseInt(b));
    const lastLoadedKey = loadedKeys.length > 0 ? loadedKeys[loadedKeys.length - 1] : null;
    tweetsQueryRef = lastLoadedKey
        ? db.ref('tweets').orderByKey().startAfter(lastLoadedKey)
        : db.ref('tweets').orderByKey();
    tweetsQueryRef.on('child_added', async (snapshot) => {
      await incrementReadCount();

      const key = snapshot.key;
      const data = snapshot.val();
      allTweets[key] = data;

      appendTweetToStream(key, data, null, true);

      const totalCount = Object.keys(allTweets).length;

      if (totalCount >= 100) {
          // 100件以上：古いものをDOMとallTweetsから除去してからランキング更新
          while (tweetStream.children.length > 100) {
              const oldest = tweetStream.lastElementChild;
              const oldestKey = oldest.getAttribute('data-key');
              oldest.remove();
              delete allTweets[oldestKey];
          }
          updateUserStats();
      } else {
          // 100件未満：除去不要、投稿されたタイミングでランキング更新
          updateUserStats();
      }
    }, (error) => {
      console.error("child_added リスナーでエラー:", error);
    });
    hideLoading();

    // child_changed リスナー
    db.ref('tweets').on('child_changed', async (snapshot) => {
      await incrementReadCount();

      const key = snapshot.key;
      const data = snapshot.val();
      allTweets[key] = data; // allTweets の既存ツイートを更新



      // いいね等の変更はreaction-btnだけ差分更新（全体再描画しない）
      const cachedDiv = tweetDomCache.get(key);
      if (cachedDiv) {
          const btn = cachedDiv.querySelector('.reaction-btn');
          if (btn) {
              const reacted = data.reactedUsers && data.reactedUsers[currentUser];
              btn.style.color = reacted ? '#87CEEB' : '#ccc';
              btn.textContent = '👍️ ' + (data.reactions || 0);
          }
          allTweets[key] = data;
      } else {
          appendTweetToStream(key, data, null, false);
      }
      updateUserStats();
    }, (error) => {
      console.error("child_changed リスナーでエラー:", error);
    });


    // --- ↓ ここから元のコードで setupRealtimeListeners の外に出ていた部分を中に移動 ↓ ---
    // child_removed リスナー
    db.ref('tweets').on('child_removed', async (snapshot) => {
      await incrementReadCount();

      const key = snapshot.key;
      removeTweetFromDOMAndMaps(key);
      delete allTweets[key];
      updateUserStats();
      // 番号はdata.tweetNumberを使うため振り直し不要
    }, (error) => {
      console.error("child_removed リスナーでエラー:", error);
    });
    console.log("DEBUG: child_removed リスナーを設定しました。");

    // presence 関連のロジック
    const presenceRef = db.ref('presence');
    const amOnline = db.ref('.info/connected');

    let userId = localStorage.getItem('firebaseUserId');
    if (!userId) {
      userId = db.ref().push().key;
      localStorage.setItem('firebaseUserId', userId);
    }
    const userPresenceRef = presenceRef.child(userId);

    amOnline.on('value', (snapshot) => {
      if (snapshot.val()) {
        userPresenceRef.onDisconnect().remove();
        userPresenceRef.set(true).catch(e => console.error("Failed to set presence:", e));


      }
    });
    console.log("DEBUG: amOnline リスナーを設定しました。");

    presenceRef.on('value', async (snapshot) => {
      await incrementReadCount();
      const count = snapshot.numChildren();
      concurrentUsersDiv.textContent = `同接数: ${count}`;
    }, (error) => {
      console.error("presence リスナーでエラー:", error);
    });
    console.log("DEBUG: presenceRef リスナーを設定しました。");
  }

  function openExportModal() {
    const modal = document.getElementById('exportModal');
    // bodyのtransform: scale()の影響を完全に逃がすため、<html>直下に移動する
    if (modal.parentElement !== document.documentElement) {
        document.documentElement.appendChild(modal);
    }
    document.getElementById('exportModalStatus').textContent = '';
    // ボタンを有効状態に戻す
    ['exportBtnRecent','exportBtnToday','exportBtnAll'].forEach(id => {
        const btn = document.getElementById(id);
        btn.disabled = false;
        btn.classList.remove('loading');
    });
    modal.classList.add('open');
  }

  function closeExportModal() {
    document.getElementById('exportModal').classList.remove('open');
  }

  // モーダル外クリックで閉じる
  document.getElementById('exportModal').addEventListener('click', function(e) {
    if (e.target === this) closeExportModal();
  });

  /**
   * tweetsデータ（オブジェクト）をtxtに変換してダウンロード
   * @param {Object} tweetsObj  - { key: tweetData, ... }
   * @param {string} suffix     - ファイル名サフィックス（'recent' | 'today' | 'all'）
   */
  function downloadTweetsAsTxt(tweetsObj, suffix) {
    const sortedKeys = Object.keys(tweetsObj).sort((a, b) => {
        return (tweetsObj[a].timestamp || 0) - (tweetsObj[b].timestamp || 0);
    });

    if (sortedKeys.length === 0) {
        document.getElementById('exportModalStatus').textContent = '該当する投稿がありません。';
        return;
    }

    const lines = sortedKeys.map((key) => {
        const t = tweetsObj[key];
        const num = t.tweetNumber || key;
        const dt = formatTimestamp(t.timestamp || 0);
        const name = (t.name || '匿名').replace(/\r?\n/g, ' ');
        const colorTag = t.color || '#ffffff';
        const typeTag  = t.type  || 'normal';
        const sizeTag  = t.size  || 'medium';
        let content = '';
        if (t.text && t.text.startsWith('__SPLIT__')) {
            const parts = t.text.replace('__SPLIT__', '').split('\n');
            content = `【五千兆】${(parts[0] || '').trim()} ${(parts[1] || '').trim()}`.trim();
        } else if (t.color === 'dot') {
            content = `【ドット】${(t.text || '').replace(/\r?\n/g, ' ')}`;
        } else {
            content = (t.text || '').replace(/\r?\n/g, ' ');
        }
        return `#${num} [${dt}] ${name}: ${content} |color:${colorTag}|type:${typeTag}|size:${sizeTag}`;
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fileName = `nicotwi_${suffix}_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.getElementById('exportModalStatus').textContent = `✅ ${lines.length}件を書き出しました`;
    setTimeout(closeExportModal, 1200);
  }

  async function runExport(mode) {
    const statusEl = document.getElementById('exportModalStatus');
    // ボタンをローディング状態に
    ['exportBtnRecent','exportBtnToday','exportBtnAll'].forEach(id => {
        const btn = document.getElementById(id);
        btn.disabled = true;
        btn.classList.add('loading');
    });

    if (mode === 'recent') {
        // メモリ上のallTweets（直近100件）をそのまま使う
        statusEl.textContent = '準備中...';
        downloadTweetsAsTxt(allTweets, 'recent');

    } else if (mode === 'today') {
        // Firebaseから全件取得し、今日（JST）のものだけ絞り込む
        statusEl.textContent = 'Firebaseから取得中...';
        try {
            const JST_OFFSET = 9 * 60 * 60 * 1000;
            const nowJST = Date.now() + JST_OFFSET;
            const todayStartJST = Math.floor(nowJST / (24*60*60*1000)) * (24*60*60*1000) - JST_OFFSET;
            const snapshot = await db.ref('tweets').once('value');
            const todayObj = {};
            snapshot.forEach(child => {
                const t = child.val();
                if ((t.timestamp || 0) >= todayStartJST) todayObj[child.key] = t;
            });
            downloadTweetsAsTxt(todayObj, 'today');
        } catch (e) {
            statusEl.textContent = '取得失敗: ' + e.message;
            return;
        }

    } else if (mode === 'all') {
        // Firebaseから全件取得
        statusEl.textContent = 'Firebaseから取得中...';
        try {
            const snapshot = await db.ref('tweets').orderByKey().once('value');
            await incrementReadCount();
            const data = snapshot.val() || {};
            downloadTweetsAsTxt(data, 'all');
        } catch (err) {
            console.error('全件取得エラー:', err);
            statusEl.textContent = '❌ 取得に失敗しました。';
            ['exportBtnRecent','exportBtnToday','exportBtnAll'].forEach(id => {
                const btn = document.getElementById(id);
                btn.disabled = false;
                btn.classList.remove('loading');
            });
        }
    }
  }




  let resizeTimeout;
  const RESIZE_DEBOUNCE_TIME = 500; 

  function adjustOverallScale() {
    const container = document.getElementById('container'); 

    if (!container) {
        console.warn("container element not found. Skipping scale adjustment.");
        return;
    }

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let scale;

    if (!toggleLogDisplayCheckbox.checked) { 
        scale = Math.min(windowWidth / 800, windowHeight / 600);
        scale = Math.min(scale, 1.0);
    } else { 
        scale = (windowHeight * 1.5) / Math.max(windowWidth, windowHeight);
        scale = Math.max(0.5, scale);
        scale = Math.min(1.0, scale);
    }
    
    document.body.style.transform = `scale(${scale})`;

    const scaledLogicalWidth = windowWidth / scale;
    const scaledLogicalHeight = windowHeight / scale;

    container.style.width = `${scaledLogicalWidth}px`;
    container.style.height = `${scaledLogicalHeight}px`;
    container.style.maxWidth = `${scaledLogicalWidth}px`;
    container.style.maxHeight = `${scaledLogicalHeight}px`;

    // ログ表示中の比率調整
    const isPortrait = windowWidth <= windowHeight;
    const logShown = toggleLogDisplayCheckbox.checked;
    if (isPortrait && logShown) {
        // 縦長: commentArea高さ = 幅 × 9/16 → フローティングエリアが 縦:横 = 9:16 になる
        const targetCommentH = Math.min(scaledLogicalWidth * 9 / 16, scaledLogicalHeight * 0.85);
        commentArea.style.flex = 'none';
        commentArea.style.width = '';
        commentArea.style.height = `${targetCommentH}px`;
        // mainAreaはリセット（残り高さをflex:1で取る）
        mainAreaEl.style.flex = '';
        mainAreaEl.style.width = '';
    } else if (!isPortrait && logShown) {
        // 横長: mainArea幅 = 高さ × 9/16 → ログエリアが 縦:横 = 16:9 になる
        const targetMainW = scaledLogicalHeight * 9 / 16;
        mainAreaEl.style.flex = 'none';
        mainAreaEl.style.width = `${targetMainW}px`;
        // commentAreaはリセット（残り幅をflex:1で取る）
        commentArea.style.flex = '';
        commentArea.style.width = '';
        commentArea.style.height = '';
    } else {
        // ログ非表示 → 両方リセット
        commentArea.style.flex = '';
        commentArea.style.width = '';
        commentArea.style.height = '';
        mainAreaEl.style.flex = '';
        mainAreaEl.style.width = '';
    }

    // スケール調整後にコメントの位置を再調整
    updateCenterFixedCommentPositions();

    // h1サイズを再調整
    balanceHeader();

    // スケール調整後に5000兆円ツイートの省略を再評価（レイアウト確定後）
    setTimeout(() => {
        Object.keys(allTweets).forEach((key) => {
            const tweet = allTweets[key];
            if (tweet.color === '5000trillion' || tweet.color === 'split_custom') {
                const div = document.querySelector(`.tweet[data-key="${key}"]`);
                if (div) updateTweetDisplay(div, tweet);
            }
        });
    }, 600); // RESIZE_DEBOUNCE_TIME(500ms)より長く設定
  }

  // ヘッダーバランス調整:
  //   「h1幅 + topUsers幅 = 全体幅」かつ「h1高さ = topUsers高さ」を同時に満たすよう
  //   topUsersスケール s をバイナリサーチで求める。
  function balanceHeader() {
      const h1 = document.querySelector('#mainArea h1');
      const topUsersEl = document.getElementById('topUsers');
      const headerSection = document.getElementById('headerSection');
      if (!h1 || !topUsersEl || !headerSection) return;

      // h1をflexから外してscrollWidthを正確に計測できるようにする
      h1.style.flex = 'none';
      h1.style.width = 'auto';

      const totalWidth = headerSection.clientWidth;
      const h3 = topUsersEl.querySelector('h3');
      const lis = topUsersEl.querySelectorAll('li:not(.equal-rank-info)');
      const H3_BASE = 18, LI_BASE = 15;
      const _portrait = window.innerWidth <= window.innerHeight;

      const TOPUSERS_SCALE = 0.6; // ランキングサイズの調整係数（二分探索収束後に適用）
      function applyScale(s) {
          if (h3) h3.style.fontSize = (H3_BASE * s) + 'px';
          lis.forEach(li => li.style.fontSize = (LI_BASE * s) + 'px');
      }

      // h1がmaxW幅に収まる最大フォントサイズ
      function h1FontForWidth(maxW) {
          let lo = 1, hi = 600;
          while (lo < hi) {
              const mid = Math.ceil((lo + hi) / 2);
              h1.style.fontSize = mid + 'px';
              if (h1.scrollWidth <= maxW) lo = mid;
              else hi = mid - 1;
          }
          h1.style.fontSize = lo + 'px';
          return lo;
      }

      // h1がtargetH高さに収まる最大フォントサイズ
      function h1FontForHeight(targetH) {
          let lo = 1, hi = 600;
          while (lo < hi) {
              const mid = Math.ceil((lo + hi) / 2);
              h1.style.fontSize = mid + 'px';
              if (h1.offsetHeight <= targetH) lo = mid;
              else hi = mid - 1;
          }
          h1.style.fontSize = lo + 'px';
          return lo;
      }

      // topUsersスケール s のバイナリサーチ
      let slo = 0.2, shi = 8.0;
      for (let iter = 0; iter < 50; iter++) {
          const smid = (slo + shi) / 2;
          applyScale(smid);
          const tuW = topUsersEl.offsetWidth;
          const tuH = topUsersEl.offsetHeight;
          const remW = totalWidth - tuW;

          if (remW < 10) { shi = smid; continue; }

          const fw = h1FontForWidth(remW);
          const fh = h1FontForHeight(tuH);

          if (fw > fh) slo = smid;
          else shi = smid;

          if (shi - slo < 0.005) break;
      }

      // 均衡点をフルスケールで記録（h1の高さ制約に使う）
      const sEquil = (slo + shi) / 2;
      applyScale(sEquil);
      const tuHEquil = topUsersEl.offsetHeight; // TOPUSERS_SCALE適用前の高さ

      // 横長時のみTOPUSERS_SCALEを適用してtopUsersを縮小
      const LANDSCAPE_MARGIN = 30; // ランキングの右余白(px)
      applyScale(sEquil * (_portrait ? 1.0 : TOPUSERS_SCALE));

      // h1: 縮小後の残り幅からLANDSCAPE_MARGINを引き、高さは均衡点基準
      const remWFinal = totalWidth - topUsersEl.offsetWidth
                        - (_portrait ? 0 : LANDSCAPE_MARGIN);
      const fwFinal = h1FontForWidth(remWFinal);
      const fhFinal = h1FontForHeight(tuHEquil); // 均衡点の高さで制約
      h1.style.fontSize = Math.min(fwFinal, fhFinal) + 'px';
      // 幅を明示固定して被りを完全に防ぐ
      h1.style.width = remWFinal + 'px';
      // ランキング右余白（横長時のみ）
      topUsersEl.style.marginRight = _portrait ? '' : LANDSCAPE_MARGIN + 'px';

      // 横長時: topUsersの幅いっぱいまでテキストを拡大して密度を上げる
      if (!_portrait) {
          const boxW = topUsersEl.clientWidth;
          const allLis = Array.from(topUsersEl.querySelectorAll('li:not(.equal-rank-info)'));
          if (allLis.length > 0) {
              let flo = 1, fhi = 300;
              while (flo < fhi) {
                  const fmid = Math.ceil((flo + fhi) / 2);
                  allLis.forEach(li => li.style.fontSize = fmid + 'px');
                  const maxW = Math.max(...allLis.map(li => li.scrollWidth));
                  if (maxW <= boxW) flo = fmid;
                  else fhi = fmid - 1;
              }
              allLis.forEach(li => li.style.fontSize = flo + 'px');
              if (h3) h3.style.fontSize = Math.round(flo * H3_BASE / LI_BASE) + 'px';
          }
      }
  }

  function debounceAdjustScale() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
          adjustOverallScale();
      }, RESIZE_DEBOUNCE_TIME);
  }

  adjustOverallScale();
  window.addEventListener('resize', debounceAdjustScale);

  // --- バージョンチェック機能の追加 ---
  function setFormEnabled(enabled) {
      nicknameInput.disabled = !enabled;
      commentInput.disabled = !enabled;
      commentTypeSelect.disabled = !enabled;
      commentSizeSelect.disabled = !enabled;
      predefinedColorSelect.disabled = !enabled;
      commentColorPicker.disabled = !enabled;
      submitButton.disabled = !enabled;
      document.getElementById('clearInputBtn').disabled = !enabled;
  }
  let versionCheckInitialized = false;

  async function checkAppVersion(firebaseVersionKey) {
            if (!versionCheckInitialized) {
                // 初回のみ：フォーム無効＋「チェック中」表示
                setFormEnabled(false);
                usageWarningDiv.style.display = 'block';
                usageWarningDiv.textContent = 'バージョンチェック中...';
            }

            const matched = (firebaseVersionKey === THIS_HTML_VERSION_KEY);
            isCurrentVersion = matched;

            if (matched) {
                setFormEnabled(true);
                usageWarningDiv.style.display = 'none';
                usageWarningDiv.textContent = '';
                console.log("バージョンが一致しました。最新バージョンです。");
            } else {
                setFormEnabled(false);
                usageWarningDiv.style.display = 'block';
                usageWarningDiv.innerHTML = `このバージョンは古くなっています。<br>最新版をご利用ください。<br>(現在のバージョン: ${THIS_HTML_VERSION_KEY}, 最新バージョン: ${firebaseVersionKey})`;
                console.warn(`バージョンが一致しません。このHTMLのバージョン: ${THIS_HTML_VERSION_KEY}, Firebaseのバージョン: ${firebaseVersionKey}`);
            }

            if (!versionCheckInitialized) {
                versionCheckInitialized = true;
                try {
                    await incrementReadCount();
                    await initializeUsageMonitoring();
                    await loadInitialTweetsAndMonitorChanges();
                    setupRealtimeListeners();
                } catch (error) {
                    console.error("初期化に失敗しました:", error);
                    setFormEnabled(false);
                    usageWarningDiv.style.display = 'block';
                    usageWarningDiv.innerHTML = 'バージョンチェックに失敗しました。<br>インターネット接続を確認してください。';
                }
            }
        }

        // VERSION_CONFIG_REF.on が初回発火＆変更検知を兼ねる（.once との二重実行なし）
        VERSION_CONFIG_REF.on('value', (snapshot) => {
            const firebaseVersionKey = snapshot.val();
            checkAppVersion(firebaseVersionKey);
        });
        // --- ここまで ---

        // これらの変数は、HTML要素がすべて読み込まれた後に定義される必要があります。
        // なので、この <script> タグの先頭（または DOMContentLoaded イベント内）にまとめて定義されているはずです。
                // これも必要



     let _saveTimer = null;
     function saveSettingsToLocalStorage() {
         clearTimeout(_saveTimer);
         _saveTimer = setTimeout(_doSave, 500);
     }
     function _doSave() {
    const nickname = nicknameInput.value;
    const color = commentColorPicker.value;
    const predefinedColor = predefinedColorSelect.value;
    const commentType = commentTypeSelect.value;
    const commentSize = commentSizeSelect.value;

    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('commentType', commentType);
    localStorage.setItem('commentSize', commentSize);

    if (predefinedColor === 'rainbow') {
        localStorage.setItem('commentColorType', 'rainbow');
    } else {
        localStorage.setItem('commentColorType', 'custom');
        localStorage.setItem('commentColor', color);
    }
} // end _doSave

     function loadSettingsFromLocalStorage() {
    const savedNickname = localStorage.getItem('userNickname');
    const savedType = localStorage.getItem('commentType');
    const savedSize = localStorage.getItem('commentSize');
    const savedColorType = localStorage.getItem('commentColorType');
    const savedColor = localStorage.getItem('commentColor');

    if (savedNickname) {
        nicknameInput.value = savedNickname;
    }

    if (savedType) {
        commentTypeSelect.value = savedType;
    }

    if (savedSize) {
        commentSizeSelect.value = savedSize;
    }

    if (savedColorType === 'rainbow') {
        predefinedColorSelect.value = 'rainbow';
        commentColorPicker.disabled = true;
    } else if (savedColorType === 'custom' && savedColor) {
        predefinedColorSelect.value = 'custom';
        commentColorPicker.value = savedColor;
        commentColorPicker.disabled = false;
    } else {
        predefinedColorSelect.value = 'default';
        commentColorPicker.value = '#ffffff';
        commentColorPicker.disabled = true;
    }

    // split_custom（五千兆）の入力欄の表示状態を復元
    const isSplit = predefinedColorSelect.value === 'split_custom';
    document.getElementById('comment').style.display = isSplit ? 'none' : 'block';
    document.getElementById('splitInputContainer').style.display = isSplit ? 'flex' : 'none';
    document.getElementById('comment').required = !isSplit;

    // カラーピッカー表示状態を復元
    const colorPickerContainer = document.getElementById('colorPickerContainer');
    if (colorPickerContainer) {
        colorPickerContainer.style.display = (predefinedColorSelect.value === 'custom') ? 'flex' : 'none';
    }
}
     /**
 * テキストを6色基調のアニメーションHTMLに変換する
 * @param {string} text - 変換する元のテキスト
 * @returns {string} - アニメーション用の<span>タグでラップされたHTML文字列
 */
/**
 * 1. フローティングコメント（左側）用：アニメーションする虹色
 */
function toRainbowText(text) {
    const chars = Array.from(text);
    const totalChars = chars.length;
    let html = '';
    const animationDuration = 1; // CSSで定義したアニメーションの秒数（5s）に合わせる
    const RAINBOW_COLORS_COUNT = 6; // 6色をステップの基準にする

    const fixedDelayStep = animationDuration / RAINBOW_COLORS_COUNT; 

    for (let i = 0; i < totalChars; i++) {
        const colorStepIndex = i % RAINBOW_COLORS_COUNT;
        const delay = -(fixedDelayStep * colorStepIndex); 
        html += `<span class="rainbow-char" style="animation-delay: ${delay}s;">${chars[i]}</span>`;
    }

    return html;
}

/**
 * 2. 投稿ストリーム・ログ（右側）用：固定された虹色
 */
function toStaticRainbowText(text) {
    const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#BF00FF'];
    const chars = Array.from(text);
    let html = '';
    
    for (let i = 0; i < chars.length; i++) {
        const color = colors[i % colors.length];
        html += `<span style="color: ${color};">${chars[i]}</span>`;
    }
    
    return html;
}

     function generateFiveTrillionHtml(part1, part2) {
    // デフォルト値
    const p1 = part1 || "5000兆円";
    const p2 = part2 || "欲しい！";

    return `
    <div class="five-trillion-container" style="display: inline-block; font-family: 'serif'; font-weight: 900; font-style: italic; line-height: 1.1; padding: 10px;">
        <span style="
            display: block;
            font-size: 1.2em;
            background: linear-gradient(to bottom, #ff3a3a 0%, #ff3a3a 45%, #b30000 50%, #ff0000 55%, #ff3a3a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(2px 2px 0px #fff) drop-shadow(-2px -2px 0px #fff) drop-shadow(2px -2px 0px #fff) drop-shadow(-2px 2px 0px #fff) drop-shadow(0 0 5px rgba(255,215,0,0.8));
            padding-bottom: 5px;
        ">${p1}</span>
        <span style="
            display: block;
            font-size: 1.5em;
            background: linear-gradient(to bottom, #ffffff 0%, #ffffff 45%, #aaaaaa 50%, #ffffff 55%, #ffffff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(2px 2px 0px #000080) drop-shadow(-2px -2px 0px #000080) drop-shadow(2px -2px 0px #000080) drop-shadow(-2px 2px 0px #000080);
            margin-top: -10px;
            padding-left: 20px;
        ">${p2}</span>
    </div>`;
}

