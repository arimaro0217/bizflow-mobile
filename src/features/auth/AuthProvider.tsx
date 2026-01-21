// =============================================================================
// AuthProvider - 認証コンテキストプロバイダー
// =============================================================================
// 【設計】
// - useAuth フックの状態をContext経由でアプリ全体に提供
// - ProtectedRouteと連携してログイン状態を管理
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth as useAuthHook, type UseAuthReturn } from '../../hooks/useAuth';

// Context作成
const AuthContext = createContext<UseAuthReturn | null>(null);

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * 認証状態を提供するプロバイダー
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const auth = useAuthHook();

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * 認証状態を取得するフック
 * AuthProvider内で使用する必要があります
 */
export function useAuth(): UseAuthReturn {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth は AuthProvider 内で使用してください');
    }
    return context;
}

export default AuthProvider;
