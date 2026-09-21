import * as React from 'react';

interface DeleteConfirmModalProps {
    open: boolean;
    title: string;
    subtitle?: string;
    // может ли пользователь удалить «для всех» (для чатов и сообщений переписки — да)
    allowDeleteForAll?: boolean;
    onClose: () => void;
    onDelete: (mode: 'self' | 'all') => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    open,
    title,
    subtitle,
    allowDeleteForAll = true,
    onClose,
    onDelete,
}) => {
    const [mode, setMode] = React.useState<'self' | 'all'>('self');

    React.useEffect(() => {
        if (open) setMode('self');
    }, [open]);

    if (!open) return null;

    const checkCls = (checked: boolean) =>
        `flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            checked ? 'border-[#5865F2] bg-[#5865F2]/10' : 'border-white/10 hover:bg-white/5'
        }`;
    const boxCls = 'w-4 h-4 mt-0.5 accent-[#5865F2] shrink-0 cursor-pointer';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[70]" onClick={onClose}>
            <div
                className="bg-[#17212b] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/5 p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-white font-semibold text-base">{title}</h3>
                {subtitle && <p className="text-[#8f9aa7] text-sm mt-1 truncate">{subtitle}</p>}

                <div className="mt-4 space-y-2">
                    {allowDeleteForAll && (
                        <div className={checkCls(mode === 'all')} onClick={() => setMode('all')}>
                            <input type="checkbox" checked={mode === 'all'} onChange={() => setMode('all')} className={boxCls} />
                            <div>
                                <p className="text-white text-sm font-medium">Удалить для всех</p>
                                <p className="text-xs text-[#8f9aa7]">Исчезнет и у вас, и у собеседника</p>
                            </div>
                        </div>
                    )}
                    <div className={checkCls(mode === 'self')} onClick={() => setMode('self')}>
                        <input type="checkbox" checked={mode === 'self'} onChange={() => setMode('self')} className={boxCls} />
                        <div>
                            <p className="text-white text-sm font-medium">Удалить только у меня</p>
                            <p className="text-xs text-[#8f9aa7]">У собеседника останется</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-[#222d3d] hover:bg-[#2b3646] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={() => onDelete(mode)}
                        className="flex-1 bg-[#f23f42] hover:bg-[#d32f31] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all"
                    >
                        Удалить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmModal;
