import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from './AuthProvider';
import { Wallet, TrendingUp, Shield } from 'lucide-react';

export function LoginPage() {
    const { user, loading, signInWithGoogle, error } = useAuth();

    // 認証済みの場合はダッシュボードへ
    if (user && !loading) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-dark via-surface to-surface-dark flex flex-col">
            {/* ヘッダー部分 */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12">
                {/* ロゴ */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                >
                    <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl flex items-center justify-center shadow-xl shadow-primary-500/30">
                        <Wallet className="w-12 h-12 text-white" />
                    </div>
                </motion.div>

                {/* タイトル */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">GANTACT</h1>
                    <p className="text-gray-400">経営者のために「ポケットの中の作戦室」</p>
                </motion.div>

                {/* 機能紹介 */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="w-full max-w-sm space-y-4 mb-12"
                >
                    <div className="flex items-center gap-4 p-4 bg-surface-light/50 rounded-2xl backdrop-blur">
                        <div className="w-10 h-10 bg-income/20 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-income" />
                        </div>
                        <div>
                            <p className="text-white font-medium">爆速入力</p>
                            <p className="text-gray-400 text-sm">専用キーパッドで簡単記録</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-surface-light/50 rounded-2xl backdrop-blur">
                        <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                            <p className="text-white font-medium">安全なデータ管理</p>
                            <p className="text-gray-400 text-sm">Googleアカウントで安全に同期</p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ログインボタン */}
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="px-6 pb-8 safe-area-bottom"
            >
                <div className="space-y-3 max-w-sm mx-auto">
                    {/* エラー表示 */}
                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl">
                            <p className="text-red-400 text-sm text-center">
                                {error.message}
                            </p>
                        </div>
                    )}

                    {/* Google Sign-In */}
                    <button
                        onClick={signInWithGoogle}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-4 px-6 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-gray-100"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        )}
                        {loading ? 'ログイン中...' : 'Googleでログイン'}
                    </button>

                    <p className="text-center text-gray-500 text-[10px] mt-4 opacity-30">
                        v1.1.0 - Auth & Input Fixes
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

export default LoginPage;
