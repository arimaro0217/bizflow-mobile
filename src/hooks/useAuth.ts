// =============================================================================
// useAuth - 認証状態管理フック
// =============================================================================
// 【機能】
// - Googleポップアップログイン
// - ログイン状態の永続化（Firebase Auth の session persistence）
// - ローディング・エラー状態管理
// - 認証済みユーザー情報の提供
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    signInWithGoogle,
    signInWithGoogleRedirect,
    getGoogleRedirectResult,
    signOut as firebaseSignOut,
    observeAuthState,
    type User,
} from '../lib/firebase';

interface AuthState {
    /** 現在ログイン中のユーザー（未ログインならnull） */
    user: User | null;
    /** 認証状態の読み込み中フラグ */
    loading: boolean;
    /** 認証エラー */
    error: Error | null;
}

interface AuthActions {
    /** Googleでログイン */
    signInWithGoogle: () => Promise<void>;
    /** ログアウト */
    signOut: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

/**
 * 認証状態を管理するカスタムフック
 * 
 * @example
 * ```tsx
 * const { user, loading, signInWithGoogle, signOut } = useAuth();
 * 
 * if (loading) return <Spinner />;
 * if (!user) return <LoginButton onClick={signInWithGoogle} />;
 * return <Dashboard user={user} onLogout={signOut} />;
 * ```
 */
export function useAuth(): UseAuthReturn {
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true, // 初期は読み込み中
        error: null,
    });

    // 認証状態の監視 & リダイレクト結果の確認
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const initAuth = async () => {
            // 1. まずリダイレクト結果を確認（モバイル等はこれでログイン完了する）
            try {
                const redirectUser = await getGoogleRedirectResult();
                if (redirectUser) {
                    console.log('Redirect sign-in successful:', redirectUser.uid);
                    // リダイレクト成功時は、リスナー設定前に一旦ステート更新（ちらつき防止）
                    setState(prev => ({ ...prev, user: redirectUser }));
                }
            } catch (error) {
                console.error('Redirect sign-in error:', error);
                setState(prev => ({
                    ...prev,
                    error: error instanceof Error ? error : new Error('リダイレクトログインに失敗しました')
                }));
            } finally {
                // 2. リダイレクト確認後に常時監視リスナーを設定
                // これにより「リダイレクト処理中なのに未ログインと判定される」のを防ぐ
                unsubscribe = observeAuthState((user) => {
                    console.log('Auth state changed:', user ? user.uid : 'null');
                    setState(prev => ({
                        ...prev,
                        user,
                        loading: false, // ここで初めてローディング完了とする
                        error: null,
                    }));
                });
            }
        };

        initAuth();

        // クリーンアップ
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Googleログイン
    const handleSignIn = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            // モバイル環境（iPhone/Android）かつPWA/Mobileブラウザの場合はリダイレクト
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                await signInWithGoogleRedirect();
                // リダイレクト後はこのページを離れるため、ここでは後続処理は不要
            } else {
                await signInWithGoogle();
                // ユーザー情報は onAuthStateChanged で自動更新される
            }
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error : new Error('ログインに失敗しました'),
            }));
        }
    }, []);

    // ログアウト
    const handleSignOut = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            await firebaseSignOut();
            // ユーザー情報は onAuthStateChanged で自動更新される
        } catch (error) {
            setState((prev) => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error : new Error('ログアウトに失敗しました'),
            }));
        }
    }, []);

    // メモ化して不要な再レンダリングを防ぐ
    return useMemo(
        () => ({
            ...state,
            signInWithGoogle: handleSignIn,
            signOut: handleSignOut,
        }),
        [state, handleSignIn, handleSignOut]
    );
}

export default useAuth;
