// =============================================================================
// Firebase 初期化 - 環境分離対応版
// =============================================================================
// 【設計意図】
// - 開発時: Firebase Emulator Suite に接続（本番データ汚染を防止）
// - 本番時: 実際のFirebaseプロジェクトに接続
// - 環境変数 VITE_USE_EMULATOR で明示的に切替可能
// =============================================================================

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    connectAuthEmulator,
    onAuthStateChanged,
    type Auth,
    type User,
} from 'firebase/auth';
import {
    getFirestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    connectFirestoreEmulator,
    type Firestore,
} from 'firebase/firestore';

// -----------------------------------------------------------------------------
// 環境設定
// -----------------------------------------------------------------------------

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// エミュレータ使用判定
// - 明示的に VITE_USE_EMULATOR=true が設定されている場合
// - または開発モード (import.meta.env.DEV) かつ本番設定がない場合
const useEmulator =
    import.meta.env.VITE_USE_EMULATOR === 'true' ||
    (import.meta.env.DEV && !firebaseConfig.apiKey);

// -----------------------------------------------------------------------------
// Firebase 初期化
// -----------------------------------------------------------------------------

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// 重複初期化を防ぐ
if (getApps().length === 0) {
    // エミュレータ使用時はダミー設定でも初期化可能
    if (useEmulator) {
        app = initializeApp({
            apiKey: 'demo-api-key',
            authDomain: 'demo-project.firebaseapp.com',
            projectId: 'demo-project',
        });
        // エミュレータ環境では通常のgetFirestoreを使用（永続化設定は任意だが、シンプルさ優先）
        db = getFirestore(app);
    } else {
        if (!firebaseConfig.apiKey) {
            throw new Error(
                '❌ Firebase設定が見つかりません。.env.local または Vercel環境変数を確認してください。'
            );
        }
        app = initializeApp(firebaseConfig);

        // 本番環境（および通常開発環境）ではオフライン永続化を有効化
        // これにより電波が悪い場所でもアプリが動作する
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager()
            })
        });
    }
} else {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
}

// authの初期化はgetAuthで再度取得してもシングルトンなので安全だが、
// ここでは初回初期化時に設定し、再利用時はgetAuth(app)で取得するように統一も可能
// しかし既存コードのフローに合わせてここで代入
auth = getAuth(app);

// -----------------------------------------------------------------------------
// エミュレータ接続
// -----------------------------------------------------------------------------

if (useEmulator) {
    // 接続済みフラグで重複接続を防ぐ
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emulatorConnected = (window as any).__FIREBASE_EMULATOR_CONNECTED__;

    if (!emulatorConnected) {
        try {
            connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
            connectFirestoreEmulator(db, '127.0.0.1', 8080);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__FIREBASE_EMULATOR_CONNECTED__ = true;

            // 開発者向け警告表示
            console.log(
                '%c⚠️ Firebase Emulator 環境で動作中',
                'background: #ff9800; color: #000; font-size: 14px; padding: 8px 16px; border-radius: 4px;'
            );
            console.log('   Auth Emulator: http://127.0.0.1:9099');
            console.log('   Firestore Emulator: http://127.0.0.1:8080');
        } catch (error) {
            console.warn('エミュレータ接続エラー:', error);
        }
    }
} else {
    console.log(
        '%c🚀 Firebase 本番環境に接続中',
        'background: #4caf50; color: #fff; font-size: 12px; padding: 4px 8px; border-radius: 4px;'
    );
}

// -----------------------------------------------------------------------------
// 認証ヘルパー関数
// -----------------------------------------------------------------------------

const googleProvider = new GoogleAuthProvider();

/**
 * Googleポップアップでサインイン
 */
export async function signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
}

/**
 * サインアウト
 */
export async function signOut(): Promise<void> {
    await firebaseSignOut(auth);
}

/**
 * 認証状態の監視
 */
export function observeAuthState(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export { app, auth, db, useEmulator };
export type { User };
