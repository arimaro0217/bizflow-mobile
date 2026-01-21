import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-dark flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        // 未認証の場合はログインページへリダイレクト
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
