# Vercel デプロイ & Firebase 設定ガイド

ローカルでの開発は完了しました！🚀
以下の手順で GitHub にプッシュし、Vercel にデプロイしてください。

## 1. GitHub へプッシュ

VS Codeのターミナル（またはコマンドプロンプト）で以下のコマンドを実行し、GitHubにコードをアップロードしてください。

```bash
git push -u origin main
```
> ※ 初回はGitHubの認証が求められる場合があります。画面の指示に従ってログインしてください。

---

## 2. Vercel でプロジェクト作成

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス。
2. **"Add New..."** -> **"Project"** をクリック。
3. GitHub リポジトリ `bizflow-mobile` を **Import**。
4. **Configure Project** 画面で、**Environment Variables** を設定します。

### 環境変数の設定 (重要)
以下の内容をコピペして設定してください（ファイル `.env.production` の中身と同じです）。

| Key | Value |
|-----|-------|
| `VITE_USE_EMULATOR` | `false` |
| `VITE_FIREBASE_API_KEY` | `AIzaSyCKKgvpaZklGFnPnNELEQCmAO92hkNIHk0` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `bizflow-mobile-4e5bc.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `bizflow-mobile-4e5bc` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `bizflow-mobile-4e5bc.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `657107669491` |
| `VITE_FIREBASE_APP_ID` | `1:657107669491:web:7375ccd9d0eadee0fe8286` |

5. **Deploy** ボタンをクリック！🎉

---

## 3. Firebase でドメインを許可

デプロイ後、そのままだとGoogleログインが「承認されていないドメイン」としてブロックされます。

1. [Firebase Console > Authentication > 設定 > 承認済みドメイン](https://console.firebase.google.com/u/0/project/bizflow-mobile-4e5bc/authentication/settings) を開く。
2. **「ドメインを追加」** をクリック。
3. Vercel で発行されたドメイン（例: `bizflow-mobile.vercel.app`）を入力して追加。

---

## 4. Firestoreセキュリティルールのデプロイ（重要）

データベースのセキュリティ設定を適用するために、以下のコマンドを実行してください。
これを行わないと、データの保存や読み込みが許可されず、アプリが正しく動作しません（取引先の登録ができないなど）。

```bash
firebase deploy --only firestore
```

※ もしJavaのエラーなどでコマンドが失敗する場合は、以下の手順で手動設定してください：

1. [Firebase Console > Firestore Database > ルール](https://console.firebase.google.com/u/0/project/bizflow-mobile-4e5bc/firestore/rules) を開く。
2. ローカルの `firestore.rules` ファイルの内容をすべてコピーする。
3. コンソールのエディタに貼り付けて **「公開」** をクリック。

---

## 完了！

これで本番環境でもアプリが動作します。スマホからアクセスして確認してみてください。
