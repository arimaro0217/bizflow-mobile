import { useCallback } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * 触覚フィードバック（Haptics）を提供するフック
 * navigator.vibrate を使用します
 * ※ iOS Safariでは現在サポートされていません
 */
export const useHaptic = () => {
    const trigger = useCallback((type: HapticType = 'medium') => {
        // サーバーサイドレンダリングや未対応ブラウザでのエラー防止
        if (typeof navigator === 'undefined' || !navigator.vibrate) return;

        switch (type) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(15);
                break;
            case 'heavy':
                navigator.vibrate(20);
                break;
            case 'success':
                navigator.vibrate([10, 30, 20]);
                break;
            case 'warning':
                navigator.vibrate([30, 50, 10]);
                break;
            case 'error':
                navigator.vibrate([50, 50, 50]);
                break;
        }
    }, []);

    return { trigger };
};
