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

    // 認証状態の監視
    useEffect(() => {
        // 常時監視リスナーを設定
        // onAuthStateChanged は、初期化完了後（永続化データの読み込み後）に発火するため、
        // ここで loading: false にすれば適切なタイミングで完了できる。
        const unsubscribe = observeAuthState((user) => {
            console.log('Auth state changed:', user ? user.uid : 'null');
            setState(prev => ({
                ...prev,
                user,
                loading: false,
                error: null,
            }));
        });

        // クリーンアップ
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Googleログイン
    const handleSignIn = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            // モバイル環境でもリダイレクト（signInWithRedirect）ではなくポップアップを使用する
            // iOS Safari等でのリダイレクトループやセッション切れを防ぐため
            await signInWithGoogle();
        } catch (error) {
            console.error('Sign-in error:', error);
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
