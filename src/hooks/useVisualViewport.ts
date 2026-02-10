import { useState, useEffect } from 'react';

interface VisualViewport {
    width: number;
    height: number;
    offsetLeft: number;
    offsetTop: number;
    pageLeft: number;
    pageTop: number;
    scale: number;
}

export function useVisualViewport() {
    const [viewport, setViewport] = useState<VisualViewport | null>(null);

    useEffect(() => {
        // サーバーサイドレンダリングや非対応ブラウザのガード
        if (typeof window === 'undefined' || !window.visualViewport) {
            return;
        }

        const updateViewport = () => {
            const vv = window.visualViewport;
            if (vv) {
                setViewport({
                    width: vv.width,
                    height: vv.height,
                    offsetLeft: vv.offsetLeft,
                    offsetTop: vv.offsetTop,
                    pageLeft: vv.pageLeft,
                    pageTop: vv.pageTop,
                    scale: vv.scale,
                });

                // CSS変数にも反映させて、CSSだけで対応できるケースもカバー
                document.documentElement.style.setProperty(
                    '--visual-viewport-height',
                    `${vv.height}px`
                );
            }
        };

        // 初期化
        updateViewport();

        // イベントリスナーの追加
        // visualViewportはresizeとscrollイベントを発火する
        window.visualViewport.addEventListener('resize', updateViewport);
        window.visualViewport.addEventListener('scroll', updateViewport);

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updateViewport);
                window.visualViewport.removeEventListener('scroll', updateViewport);
            }
        };
    }, []);

    return viewport;
}
