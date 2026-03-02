import React from 'react';
import { Calendar, Building2, Info } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface FormInputProps {
    label: string;
    error?: string;
    children: React.ReactNode;
}

export function FormField({ label, error, children }: FormInputProps) {
    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-400">
                {label}
            </label>
            {children}
            {error && (
                <p className="text-sm text-expense flex items-center gap-1 mt-1">
                    <Info className="w-4 h-4" />
                    {error}
                </p>
            )}
        </div>
    );
}

interface FormAmountInputProps {
    value: string;
    type: 'income' | 'expense';
    onClick: () => void;
    label?: string;
    error?: string;
}

export function FormAmountInput({ value, type, onClick, label = "金額", error }: FormAmountInputProps) {
    return (
        <FormField label={label} error={error}>
            <button
                type="button"
                onClick={onClick}
                className="w-full p-4 bg-surface rounded-xl text-right hover:bg-surface-light transition-colors border border-transparent focus:border-primary-500/50 outline-none"
            >
                <span className={cn(
                    'text-3xl font-semibold tabular-nums',
                    value !== '0' && value !== ''
                        ? type === 'income' ? 'text-income' : 'text-expense'
                        : 'text-gray-500'
                )}>
                    {formatCurrency(value)}
                </span>
            </button>
        </FormField>
    );
}

interface FormDatePickerProps {
    date: Date;
    onClick: () => void;
    label?: string;
    error?: string;
}

export function FormDatePicker({ date, onClick, label = "日付", error }: FormDatePickerProps) {
    return (
        <FormField label={label} error={error}>
            <button
                type="button"
                onClick={onClick}
                className="w-full flex items-center gap-3 p-4 bg-surface rounded-xl text-left hover:bg-surface-light transition-colors"
            >
                <Calendar className="w-5 h-5 text-gray-400" />
                <span className="text-white">
                    {format(date, 'yyyy年M月d日 (E)', { locale: ja })}
                </span>
            </button>
        </FormField>
    );
}

interface FormSelectButtonProps {
    value?: string;
    placeholder: string;
    displayValue?: string;
    onClick: () => void;
    label: string;
    icon?: React.ReactNode;
    error?: string;
}

export function FormSelectButton({ value, placeholder, displayValue, onClick, label, icon, error }: FormSelectButtonProps) {
    return (
        <FormField label={label} error={error}>
            <button
                type="button"
                onClick={onClick}
                className="w-full flex items-center gap-3 p-4 bg-surface rounded-xl text-left hover:bg-surface-light transition-colors"
            >
                {icon || <Building2 className="w-5 h-5 text-gray-400" />}
                <span className={cn(
                    "flex-1",
                    value ? 'text-white' : 'text-gray-500'
                )}>
                    {displayValue || value || placeholder}
                </span>
            </button>
        </FormField>
    );
}

interface FormTextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export function FormTextInput({ label, error, className, ...props }: FormTextInputProps) {
    return (
        <FormField label={label} error={error}>
            <input
                {...props}
                className={cn(
                    "w-full p-4 bg-surface rounded-xl text-white outline-none border border-transparent focus:border-primary-500/30 transition-all",
                    error && "border-expense/50",
                    className
                )}
            />
        </FormField>
    );
}

interface FormTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    error?: string;
}

export function FormTextArea({ label, error, className, ...props }: FormTextAreaProps) {
    return (
        <FormField label={label} error={error}>
            <textarea
                {...props}
                className={cn(
                    "w-full p-4 bg-surface rounded-xl text-white outline-none border border-transparent focus:border-primary-500/30 transition-all min-h-[100px] resize-none",
                    error && "border-expense/50",
                    className
                )}
            />
        </FormField>
    );
}
