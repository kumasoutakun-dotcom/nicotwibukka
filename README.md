# nicotwi物化

ニコニコ動画風の流れるコメント表示と、SNS風の投稿タイムラインを組み合わせたWebアプリです。投稿・引用・いいね・ランキング・投稿再現に加え、リアルタイム投票にも対応しています。

## 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [利用技術](#利用技術)
- [リポジトリ構成](#リポジトリ構成)
- [動作の仕組み](#動作の仕組み)
- [Firebaseの設定](#firebaseの設定)
- [Realtime Databaseのデータ構造](#realtime-databaseのデータ構造)
- [Security Rules](#security-rules)
- [開発・更新方法](#開発更新方法)
- [運用・保守](#運用保守)
- [既知の制約](#既知の制約)

## 概要

- **アプリ名:** nicotwi物化
- **現在のアプリバージョン:** ver1.7.8（`index.html` / `firebase.js`）
- **開発リポジトリ:** [kumasoutakun-dotcom/nicotwibukka](https://github.com/kumasoutakun-dotcom/nicotwibukka)
- **作業ブランチ:** `codex-connector-test`
- **公開サイト:** GitHub Pages。公開元ブランチ・URLはリポジトリの Settings → Pages で確認してください。

このリポジトリのブランチと、従来の公開用リポジトリ・Firebaseプロジェクトの管理者は同一とは限りません。公開先や所有者を変更する場合は、GitHub PagesとFirebaseコンソールの実設定を確認してから作業してください。

## 主な機能

### コメント表示
- 通常の流れるコメントと、画面中央に固定するコメント
- コメントの文字サイズ・色の変更
- 虹色、五千兆表示、ドットフォント表示
- 表示設定（投稿ログ、読み上げ、虹色アニメーション）
- コメントのリアルタイム同期

### 投稿タイムライン
- 「新着」「話題」「投票」のタブ
- 投稿へのいいねと、いいね数に基づく話題表示
- 本文中の `#投稿番号` による引用
- 投稿者ランキング（直近100件）
- 投稿履歴のTXT / JSON書き出し
- Firebase上の投稿データを使った再現、およびTXTファイルからの再生

### 投票
- 2〜6個の選択肢を持つ投票の作成
- 単一選択・複数選択
- 投票時間中の再投票（自分の票の変更）
- 途中経過・選択肢ごとの票数の表示設定
- 進行中の投票と過去の結果を表示する投票タブ
- nicoArea上での投票表示と、終了時の結果発表表示
- 通常投稿から投票を引用

## 利用技術

| 分類 | 技術 |
|---|---|
| フロントエンド | HTML / CSS / JavaScript（フレームワークなし） |
| データベース | Firebase Realtime Database |
| 認証 | Firebase Authentication（匿名認証） |
| 表示ライブラリ | DOMPurify |
| フォント | k8x12S、GenZenGothicKaiC、Akshar |
| 公開 | GitHub Pages |

ビルドツールやパッケージマネージャーは使用していません。HTML・CSS・JavaScriptをブラウザで直接読み込む構成です。

## リポジトリ構成

主要ファイルはリポジトリ直下にあります。

| ファイル | 役割 |
|---|---|
| `index.html` | 画面構造、フォーム、タブ、各パネル、外部ライブラリとJSの読み込み |
| `style.css` | レイアウト、配色、カード、レスポンシブ表示、アニメーション |
| `fonts.css` | k8x12S・GenZenGothicKaiCなどのフォント定義 |
| `utils.js` | 投稿制限、サニタイズ補助、日付・引用・文字列処理などの共通関数 |
| `layout.js` | 画面サイズや縦横比に応じたレイアウト調整 |
| `ranking.js` | 直近100件を対象とする投稿者ランキング |
| `settings.js` | 投稿フォーム、表示設定、ローカル設定の管理 |
| `timeline.js` | 投稿カード、引用カード、タイムライン、履歴書き出し |
| `comments.js` | 流れるコメント・中央固定コメント・読み上げ・投稿再現 |
| `firebase.js` | Firebase初期化、匿名認証、投稿・いいね・引用・接続状況・バージョン管理 |
| `polls.js` | 投票の作成・投票・結果表示・投票タブ・nicoArea上の投票表示 |

### JavaScriptの読み込み順

`index.html` では、次の順番で読み込みます。

```text
utils.js
  → layout.js
  → ranking.js
  → settings.js
  → timeline.js
  → comments.js
  → firebase.js
  → polls.js
```

各ファイルはグローバルスコープの関数・変数を共有しています。依存関係を確認せずに順番を変更しないでください。特に `polls.js` は `firebase.js` が初期化するFirebase関連の変数・認証完了処理を利用するため、後ろに置きます。

## 動作の仕組み

1. `index.html` がFirebase SDK、DOMPurify、CSS、各JavaScriptを読み込みます。
2. `firebase.js` がFirebaseを初期化し、匿名認証を完了させます。
3. Realtime Databaseから投稿・投票などを取得し、変更をリアルタイムに画面へ反映します。
4. 投稿・投票などのデータはFirebaseに保存され、利用者間で共有されます。

匿名認証は利用者にアカウント登録を求めずFirebase UIDを発行する仕組みです。本人確認や強固な不正防止を提供するものではありません。

## Firebaseの設定

### 使用プロジェクト

現在のフロントエンド設定（`firebase.js`）は、次のFirebaseプロジェクトを参照しています。

- **Firebase Project ID:** `nicotwibukka`
- **Realtime Database:** `nicotwibukka-default-rtdb.asia-southeast1.firebasedatabase.app`

FirebaseのAPIキー等はWebアプリから利用する公開設定値です。データ保護はAPIキーの秘匿ではなく、Authentication・Realtime Database Security Rules・必要に応じたApp Check等で行います。

### 必要なFirebase機能

- **Authentication:** Anonymous（匿名）ログインを有効にする
- **Realtime Database:** データベースを作成し、下記のSecurity Rulesを設定する

匿名認証が無効、またはデータベースのルールとアプリの書き込み仕様が一致しない場合、投稿・投票などが失敗します。

## Realtime Databaseのデータ構造

| パス | 用途 |
|---|---|
| `/config/totalTweetCount` | 投稿番号の採番に使う累計投稿数 |
| `/config/current_version_key` | 利用中アプリのバージョン確認 |
| `/tweets/{tweetId}` | 投稿本文・投稿者・表示設定・反応数など |
| `/quoteIndex/{tweetNumber}` | 投稿番号から投稿キーを引く引用用インデックス |
| `/likedTweets/{entry}` | 話題タブで参照するいいね付き投稿のデータ |
| `/presence/{uid}/{connectionId}` | 匿名UIDごとの接続状態 |
| `/polls/{pollId}` | 投票タイトル・選択肢・作成者・期間・表示設定 |
| `/pollVotes/{pollId}/{uid}` | 匿名UIDごとの投票内容 |
| `/usageStats` | 旧利用状況監視用。現行コードでは利用していない |

投稿データには、名前・本文・色・表示形式・サイズ・タイムスタンプ・投稿番号のほか、いいね数、いいねしたユーザー、引用情報、アプリバージョンなどが含まれます。

投票データにはタイトル、作成者名・UID、選択肢、開始・終了時刻、投票時間、単一／複数選択、途中経過・票数表示の設定が含まれます。

## Security Rules

以下は、現在Firebaseコンソールに設定されているものとして共有されたRealtime Database Rulesです。FirebaseコンソールのRealtime Database → ルールに設定されている内容が実際の適用値です。README内の記載とコンソールの内容が異なる場合は、コンソールを正として確認してください。

```json
{
  "rules": {
    ".write": false,
    "config": {
      ".read": true,
      "totalTweetCount": {
        ".write": "newData.isNumber() && newData.val() >= 0 && ((!data.exists() && newData.val() === 1) || (data.isNumber() && newData.val() === data.val() + 1))"
      },
      "current_version_key": {
        ".read": true,
        ".write": "auth != null",
        ".validate": "newData.isString()"
      }
    },
    "tweets": {
      ".read": true,
      ".indexOn": ["tweetNumber"],
      "$tweet_id": {
        ".write": "!data.exists() && newData.hasChildren(['name', 'text', 'color', 'type', 'size', 'timestamp', 'tweetNumber'])",
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 15"
        },
        "text": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 14000"
        },
        "color": {
          ".validate": "newData.isString() && (newData.val().matches(/^#[0-9a-fA-F]{6}$/) || newData.val() === 'rainbow' || newData.val() === '5000trillion' || newData.val() === 'dot')"
        },
        "type": {
          ".validate": "newData.isString() && (newData.val() === 'normal' || newData.val() === 'center_fixed')"
        },
        "size": {
          ".validate": "newData.isString() && (newData.val() === 'small' || newData.val() === 'medium' || newData.val() === 'large')"
        },
        "timestamp": {
          ".validate": "newData.isNumber()"
        },
        "tweetNumber": {
          ".validate": "newData.isNumber()"
        },
        "reactions": {
          ".write": "newData.isNumber() && newData.val() >= 0",
          ".validate": "newData.isNumber() && newData.val() >= 0"
        },
        "reactedUsers": {
          ".write": "newData.hasChildren() || !newData.exists()",
          ".validate": "newData.hasChildren() || !newData.exists()",
          "$user_id": {
            ".validate": "newData.val() === true"
          }
        },
        "parent": {
          ".validate": "newData.isString() || !newData.exists()"
        },
        "quote": {
          ".validate": "newData.isNumber() || !newData.exists()"
        },
        "appVersion": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "presence": {
      ".read": true,
      "$user_id": {
        ".write": "auth != null && auth.uid === $user_id",
        "$connection_id": {
          ".write": "auth != null && auth.uid === $user_id",
          ".validate": "newData.isBoolean()"
        }
      }
    },
    "quoteIndex": {
      ".read": true,
      "$tweet_number": {
        ".write": "!data.exists() && newData.isString()",
        ".validate": "newData.isString()"
      }
    },
    "likedTweets": {
      ".read": true,
      "$entry": {
        ".write": true
      }
    },
    "usageStats": {
      ".read": false,
      ".write": false
    },
    "polls": {
      ".read": true,
      "$poll_id": {
        ".write": "auth != null && ((!data.exists() && newData.exists() && newData.child('creatorUid').val() === auth.uid && newData.child('createdAt').val() <= now && newData.child('createdAt').val() >= now - 60000) || (data.exists() && newData.exists() && data.child('creatorUid').val() === auth.uid && newData.child('title').val() === data.child('title').val() && newData.child('creatorName').val() === data.child('creatorName').val() && newData.child('durationSeconds').val() === data.child('durationSeconds').val() && newData.child('createdAt').val() === data.child('createdAt').val() && newData.child('endsAt').val() === data.child('endsAt').val() && newData.child('creatorUid').val() === data.child('creatorUid').val() && newData.child('allowMultiple').val() === data.child('allowMultiple').val() && newData.child('showResults').val() === data.child('showResults').val() && newData.child('showVoters').val() === data.child('showVoters').val() && newData.child('choices').val() === data.child('choices').val()))",
        ".validate": "newData.hasChildren(['title', 'creatorName', 'choices', 'durationSeconds', 'createdAt', 'endsAt', 'creatorUid', 'allowMultiple', 'showResults', 'showVoters'])",
        "title": {
          ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 80"
        },
        "tweetNumber": {
          ".validate": "newData.isNumber() && newData.val() > 0"
        },
        "creatorName": {
          ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 15"
        },
        "choices": {
          ".validate": "newData.hasChildren(['0', '1'])",
          "0": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "1": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "2": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "3": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "4": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "5": {
            ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
          },
          "$other": {
            ".validate": false
          }
        },
        "durationSeconds": {
          ".validate": "newData.isNumber() && (newData.val() === 10 || newData.val() === 15 || newData.val() === 30 || newData.val() === 60 || newData.val() === 120 || newData.val() === 180 || newData.val() === 240 || newData.val() === 300)"
        },
        "createdAt": {
          ".validate": "newData.isNumber() && newData.val() <= now"
        },
        "endsAt": {
          ".validate": "newData.isNumber() && newData.val() >= newData.parent().child('createdAt').val() && newData.val() <= newData.parent().child('createdAt').val() + newData.parent().child('durationSeconds').val() * 1000"
        },
        "creatorUid": {
          ".validate": "newData.isString() && newData.val() === auth.uid"
        },
        "allowMultiple": {
          ".validate": "newData.isBoolean()"
        },
        "showResults": {
          ".validate": "newData.isBoolean()"
        },
        "showVoters": {
          ".validate": "newData.isBoolean()"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "pollVotes": {
      ".read": true,
      "$poll_id": {
        "$uid": {
          ".write": "auth != null && auth.uid === $uid && root.child('polls').child($poll_id).exists() && root.child('polls').child($poll_id).child('endsAt').val() > now",
          ".validate": "(root.child('polls').child($poll_id).child('allowMultiple').val() === false && newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()) || (root.child('polls').child($poll_id).child('allowMultiple').val() === true && newData.hasChildren())",
          "0": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "1": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "2": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "3": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "4": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "5": {
            ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === 1 || newData.val() === 2 || newData.val() === 3 || newData.val() === 4 || newData.val() === 5) && root.child('polls').child($poll_id).child('choices').child(newData.val() + '').exists()"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    }
  }
}
```

### ルールの要点と注意

- ルートの `.write: false` により、明示的に許可された各パス以外への書き込みは拒否されます。
- 投稿本体は新規作成のみ許可され、投稿者名15文字以内、本文14,000文字以内などの検証があります。未定義フィールドは `$other` により拒否されます。
- `reactions` と `reactedUsers`、`likedTweets` は、ルール上は一般利用者からの書き込みを広く許可しています。いいね数や話題タブ用データの改ざんを完全には防げません。
- `tweets`、`polls`、`pollVotes` などの読み取りは公開設定です。投稿内容・投票データは認証なしの一般利用者から閲覧できる前提で扱ってください。
- 投票の作成・更新は匿名認証を要求し、作成者UIDと作成時刻を検証します。投票の基本設定は作成後に変更できない条件になっています。
- 投票は終了時刻前のみ本人UIDから書き込めます。単一選択と複数選択の両方を検証します。
- `usageStats` は読み書きとも拒否されており、現行アプリでは使用していません。
- Rulesはサーバー側の検証です。JavaScript側の入力制限だけをセキュリティ対策として扱わないでください。

**注意:** 共有されたルールには、いいね関連の書き込み制限や投票複数選択配列の要素数・重複数に関する制限など、改善を検討できる箇所があります。挙動を変える前に、現行アプリの書き込み形式を確認し、テスト用データベースで検証してください。

## 開発・更新方法

### ローカルで確認する

1. リポジトリをクローン、またはGitHub Codespacesで開きます。
2. `index.html` をブラウザで開きます。Firebase接続を含む動作確認にはインターネット接続が必要です。
3. Firebaseの認証・ルール・接続先が正しいことを確認します。

### ブランチの更新

この作業ブランチをCodespaces等に取り込む場合:

```bash
git switch codex-connector-test
git pull origin codex-connector-test
```

変更後は差分を確認し、意図したファイルだけをコミット・プッシュしてください。GitHub Pagesの公開元がこのブランチかどうかは、Settings → Pagesで別途確認します。

### バージョン更新

`firebase.js` の `THIS_HTML_VERSION_KEY` と、`index.html` のタイトルに記載したバージョン表記は、リリース時に整合させてください。Firebaseの `config/current_version_key` も、運用中のバージョンチェック仕様に合わせて更新する必要があります。

## 運用・保守

### Firebaseデータのバックアップ

定期的にFirebaseコンソール → Realtime Database → データから、ルート階層のJSONをエクスポートして保管してください。代替わりや大きな変更の前にもバックアップを推奨します。

JSONをインポートするとデータベース全体が置き換わるため、復元前に現在のデータもエクスポートしてください。一部だけ復元したい場合は、必要なノードだけを慎重に戻します。

### 投稿の削除

アプリ内に投稿削除機能はありません。FirebaseコンソールのRealtime Databaseから該当する `tweets/{tweetId}` を削除します。必要に応じて、対応する `likedTweets` と `quoteIndex` も確認してください。削除後も累計投稿番号は自動で詰め直されません。

### 権限管理

GitHubリポジトリとFirebaseプロジェクトの管理者を複数人で維持してください。個人アカウントに必要な権限を付与し、実際にそのアカウントで管理画面へアクセスできることを確認します。パスワードや秘密情報をREADME・ソースコードに記載しないでください。

### 不具合の切り分け

- 投稿できない: Authenticationの匿名認証、Realtime Database Rules、ブラウザの開発者コンソールを確認
- 投票を作成・投票できない: `polls` / `pollVotes` のルールと匿名UID、投票終了時刻、データ形式を確認
- 画面に変更が反映されない: GitHubのコミット、Pagesのデプロイ状況、ブラウザキャッシュを順に確認
- 新しい投稿フィールドを追加した: `tweets/$tweet_id/$other` の検証ルールも含め、Security Rulesを更新

## 既知の制約

- Firebaseの公開読み取りノードは、誰でもデータを取得できる前提です。
- 匿名認証はUIDを区別するためのもので、実在の利用者の本人確認ではありません。
- いいね関連の一部パスはSecurity Rules上の書き込み制限が弱く、不正な値の登録を完全には防止できません。
- 進行中投票数などの一部制御はクライアント側に依存します。複数端末からの同時操作に対する厳密な排他制御は保証されません。
- Firebaseの無料枠・利用量はFirebaseコンソールで確認してください。現行コードに利用量の自動停止機能はありません。
- READMEの説明と実装が食い違う場合は、対象ブランチのソースコードとFirebaseコンソールの実設定を確認し、このREADMEも更新してください。
