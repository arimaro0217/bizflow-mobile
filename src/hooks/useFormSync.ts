import { useEffect } from 'react';
import type { UseFormReturn, FieldValues, Path, PathValue } from 'react-hook-form';
import type { Client } from '../types';

interface UseFormSyncProps<T extends FieldValues> {
    form: UseFormReturn<T>;
    open: boolean;
    selectedClient: Client | null;
    clientIdField: Path<T>;
    onReset: () => void;
}

/**
 * フォームの初期化とクライアント同期を統合管理するフック
 */
export function useFormSync<T extends FieldValues>({
    form,
    open,
    selectedClient,
    clientIdField,
    onReset
}: UseFormSyncProps<T>) {
    const { setValue } = form;

    // 開いたときにリセット
    useEffect(() => {
        if (open) {
            onReset();
        }
    }, [open, onReset]);

    // 取引先が選択されたらフォームに反映
    useEffect(() => {
        if (selectedClient) {
            setValue(clientIdField, selectedClient.id as PathValue<T, Path<T>>, {
                shouldValidate: true,
                shouldDirty: true
            });
        }
    }, [selectedClient, setValue, clientIdField]);
}
