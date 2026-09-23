import * as React from 'react';
import { getMessages, sendMessage, getPartnerStatus, sendAttachment, getChatMedia, forwardMessage, deleteMessage, getChats, getPinnedMessages, pinMessage, unpinMessage, markChatRead, reactMessage } from '../sidebar/usersearch/api/api';
import type { ChatMessage, PublicUserStatus, ChatAttachment } from '../sidebar/usersearch/api/api';
import type { Chat as ChatListItem } from '../sidebar/Sidebar';
import Avatar from '../../../components/Avatar';
import VoicePlayer from '../../../components/VoicePlayer';
import DeleteConfirmModal from '../../../components/DeleteConfirmModal';
import { formatLastSeen } from '../../../utils/formatLastSeen';
import { assetUrl } from '../../../utils/assetUrl';
import { socket, useSocketEvents, useSocketStatus } from '../../../utils/socket';
import { useLongPress } from '../../../utils/longPress';
import { REACTION_EMOJIS, emojiUrl } from '../../../utils/reactions';
import type { MessageReaction } from '../../../utils/reactions';

interface Message {
    id: string;
    text: string;
    sender: 'me' | 'them';
    timestamp: Date;
    status?: 'sent' | 'delivered' | 'read';
    type?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'deleted';
    replyTo?: { id: string; text: string; senderId: string; type: string } | null;
    forwardedFrom?: { id: string; displayName: string } | null;
    pinned?: boolean;
    reactions?: MessageReaction[];
}

interface ChatAreaProps {
    selectedChatId: string | null;
    chatName?: string;
    onSendMessage?: (message: string) => void;
    onBack?: () => void;
    onSelectChat?: (id: string, name?: string) => void;
}

const ChatHeader: React.FC<{
    chatName: string;
    onBack?: () => void;
    status?: { text: string; online: boolean } | null;
    partnerTyping?: null | 'typing' | 'recording';
    onOpenPartnerProfile?: () => void;
    onToggleInfo: () => void;
    partnerAvatar?: string | null;
    infoOpen?: boolean;
}> = ({ chatName, onBack, status, partnerTyping, onOpenPartnerProfile, onToggleInfo, partnerAvatar, infoOpen }) => {
    const isOnline = status?.online || !!partnerTyping;
    return (
        <div className="flex items-center justify-between px-2 sm:px-4 h-[60px] bg-[#17212b] border-b border-black/30 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="md:hidden text-[#8f9aa7] hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
                        aria-label="Назад к списку чатов"
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>
                )}
                <button
                    onClick={onOpenPartnerProfile}
                    className="relative shrink-0 rounded-full focus:outline-none transition-transform active:scale-95 cursor-pointer"
                    title="Открыть профиль"
                    aria-label="Открыть профиль собеседника"
                >
                    <Avatar name={chatName} src={partnerAvatar || undefined} size={38} className="ring-2 ring-transparent hover:ring-[#5865F2] transition-all" />
                    {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#17212b]" title="онлайн" />
                    )}
                </button>
                <div className="min-w-0">
                    <h2 className="text-white font-medium truncate selectable">{chatName}</h2>
                    {partnerTyping ? (
                        partnerTyping === 'recording' ? (
                            <p className="text-xs text-[#8ea1ff] truncate flex items-center gap-1.5" title="записывает голосовое сообщение">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                                    <path d="M12 16c2.206 0 4-1.794 4-4V6c0-2.217-1.785-4.021-3.979-4.021a.933.933 0 0 0-.209.025A4.006 4.006 0 0 0 8 6v6c0 2.206 1.794 4 4 4z" />
                                    <path d="M11 19.931V22h2v-2.069c3.939-.495 7-3.858 7-7.931h-2c0 3.309-2.691 6-6 6s-6-2.691-6-6H4c0 4.072 3.061 7.436 7 7.931z" />
                                </svg>
                                записывает голосовое сообщение
                            </p>
                        ) : (
                            <p className="text-xs text-[#8ea1ff] truncate flex items-center gap-1.5" title="печатает">
                                <span className="flex gap-0.5 items-end h-2 shrink-0" aria-hidden>
                                    <span className="w-0.5 h-1 rounded-full bg-[#8ea1ff] animate-bounce [animation-delay:0ms]" />
                                    <span className="w-0.5 h-1.5 rounded-full bg-[#8ea1ff] animate-bounce [animation-delay:150ms]" />
                                    <span className="w-0.5 h-1 rounded-full bg-[#8ea1ff] animate-bounce [animation-delay:300ms]" />
                                </span>
                                печатает…
                            </p>
                        )
                    ) : status?.online ? (
                        <p className="text-xs text-[#8ea1ff] truncate">онлайн</p>
                    ) : status ? (
                        <p className="text-xs text-[#8f9aa7] truncate">{status.text}</p>
                    ) : (
                        <p className="text-xs text-[#8f9aa7]">…</p>
                    )}
                </div>
            </div>
            {!infoOpen && (
                <button
                    onClick={onToggleInfo}
                    className="text-[#8f9aa7] hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
                    aria-label="Информация о чате"
                    title="Информация о чате"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                    </svg>
                </button>
            )}
        </div>
    );
};

const MessageMeta: React.FC<{ isMe: boolean; timestamp: Date; status?: 'sent' | 'delivered' | 'read'; pinned?: boolean }> = ({ isMe, timestamp, status, pinned }) => (
    <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
        {pinned && (
            <span title="Закреплено" className="text-white/70 flex shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="m12 22 1-2v-3h5a1 1 0 0 0 1-1v-1.586c0-.526-.214-1.042-.586-1.414L17 11.586V8a1 1 0 0 0 1-1V4c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2v3a1 1 0 0 0 1 1v3.586L5.586 13A2.01 2.01 0 0 0 5 14.414V16a1 1 0 0 0 1 1h5v3l1 2z" />
                </svg>
            </span>
        )}
        <span className={`text-[10px] ${isMe ? 'text-white/60' : 'text-[#8f9aa7]'}`}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isMe && status === 'read' && (
            <span title="Прочитано" className="text-white/80 flex">
                <svg width="14" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 5.5 4 8.5 9 1.5" />
                    <path d="M6 5.5 9 8.5 14 1.5" />
                </svg>
            </span>
        )}
        {isMe && status === 'sent' && (
            <span title="Отправлено" className="text-white/50 flex">
                <svg width="14" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 5.5 4 8.5 9 1.5" />
                </svg>
            </span>
        )}
    </div>
);

const AttachmentBody: React.FC<{ type: 'image' | 'video' | 'audio' | 'file'; url: string; isMe?: boolean; onOpenImage?: (url: string) => void }> = ({ type, url, isMe, onOpenImage }) => {
    const src = assetUrl(url);
    if (!src) return null;

    if (type === 'image') {
        return (
            <button
                onClick={() => onOpenImage?.(src)}
                className="block cursor-zoom-in"
                title="Открыть изображение"
            >
                <img src={src} alt="Вложение" className="max-w-[260px] sm:max-w-[320px] rounded-xl mb-1" />
            </button>
        );
    }
    if (type === 'video') {
        return <video src={src} controls className="max-w-[260px] sm:max-w-[320px] rounded-xl mb-1" />;
    }
    if (type === 'audio') {
        return (
            <div className="mb-1">
                <VoicePlayer src={src} isMe={!!isMe} />
            </div>
        );
    }
    return (
        <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 mb-1 text-xs text-white/80 hover:text-white underline underline-offset-2"
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>
            Открыть файл
        </a>
    );
};

const humanizeType = (type: string): string => {
    switch (type) {
        case 'image': return 'Изображение';
        case 'video': return 'Видеофайл';
        case 'audio': return 'Голосовое сообщение';
        case 'file': return 'Файл';
        default: return 'Сообщение';
    }
};

const ReactionBar: React.FC<{ message: Message; onToggleReaction: (m: Message, emoji: string) => void }> = ({ message, onToggleReaction }) => {
    if (!message.reactions || message.reactions.length === 0) return null;
    return (
        <div className={`flex flex-wrap gap-1 mt-1 ${message.sender === 'me' ? 'justify-end md:justify-start' : 'justify-start'}`}>
            {message.reactions.map((r) => (
                <button
                    key={r.emoji}
                    onClick={() => onToggleReaction(message, r.emoji)}
                    className={`flex items-center gap-1 h-[24px] px-1.5 rounded-full border text-[11px] font-medium transition-all active:scale-95 ${
                        r.mine
                            ? 'bg-[#5865F2]/25 border-[#5865F2] text-white'
                            : 'bg-[#1c2530] border-white/10 text-[#8f9aa7] hover:border-white/25 hover:text-white'
                    }`}
                    title={r.mine ? 'Убрать реакцию' : 'Поставить реакцию'}
                >
                    <img src={emojiUrl(r.emoji)} alt={r.emoji} className="w-[14px] h-[14px]" draggable={false} />
                    {r.count > 1 && <span className="tabular-nums">{r.count}</span>}
                </button>
            ))}
        </div>
    );
};

// выравнивание строки сообщения: на узких экранах — по сторонам, на широких — всё слева
// (isMe → justify-end на мобильных, justify-start на md+; задаётся в MessageBubble)

const MessageBubble: React.FC<{
    message: Message;
    showAvatar: boolean;
    chatName: string;
    partnerAvatar?: string | null;
    onContextMenu: (e: React.MouseEvent, message: Message) => void;
    onLongPress: (pos: { x: number; y: number }, message: Message) => void;
    onOpenForwardedAuthor?: (userId: string, name: string) => void;
    onOpenImage?: (url: string) => void;
    onToggleReaction: (m: Message, emoji: string) => void;
    /** в групповых чатах показываем аватар автора слева; в личных — не показываем (и не резервируем место) */
    isGroup?: boolean;
}> = ({ message, showAvatar, chatName, partnerAvatar, onContextMenu, onLongPress, onOpenForwardedAuthor, onOpenImage, onToggleReaction, isGroup = false }) => {
    const isMe = message.sender === 'me';
    const type = message.type || 'text';
    // на мобильных долгое нажатие открывает то же меню, что и ПКМ
    const longPress = useLongPress((pos) => onLongPress(pos, message));

    if (type === 'deleted') {
        return (
            <div
                {...longPress}
                onContextMenu={(e) => onContextMenu(e, message)}
                className={`flex mb-1 ${isMe ? 'justify-end md:justify-start' : 'justify-start'}`}
            >
                <p className="italic text-xs text-[#8f9aa7] px-3 py-1.5">Сообщение удалено</p>
            </div>
        );
    }

    const replyAuthor = message.replyTo
        ? (message.replyTo.senderId === 'me' ? 'Вы' : chatName)
        : null;

    const bubble = type === 'image' ? (
        <div className={`bg-transparent rounded-2xl rounded-bl-md overflow-hidden ${message.pinned ? 'ring-1 ring-[#e8a33d]/60' : ''}`}>
            {message.forwardedFrom && (
                <button
                    onClick={() => onOpenForwardedAuthor?.(message.forwardedFrom!.id, message.forwardedFrom!.displayName)}
                    className="text-[11px] text-[#8ea1ff] hover:text-white mb-1 block"
                    title={`Открыть чат с ${message.forwardedFrom.displayName}`}
                >
                    ↪ Переслано от {message.forwardedFrom.displayName}
                </button>
            )}
            {message.replyTo && (
                <div className="border-l-2 border-[#8ea1ff] pl-2 mb-1 max-w-[260px] sm:max-w-[320px]">
                    <p className="text-[11px] font-medium text-[#8ea1ff]">{replyAuthor}</p>
                    <p className="text-xs text-white/60 truncate selectable">
                        {message.replyTo.type === 'text' ? message.replyTo.text : humanizeType(message.replyTo.type)}
                    </p>
                </div>
            )}
            <AttachmentBody type="image" url={message.text} onOpenImage={onOpenImage} />
            <div className="flex justify-end pr-1 pb-0.5"><MessageMeta isMe={isMe} timestamp={message.timestamp} status={message.status} pinned={message.pinned} /></div>
        </div>
    ) : (
        <div
            className={`px-3.5 py-2 ${
                isMe
                    ? 'bg-[#2b5278] text-white rounded-2xl rounded-br-md'
                    : 'bg-[#1c2530] text-white rounded-2xl rounded-bl-md'
            } ${message.pinned ? 'ring-1 ring-[#e8a33d]/60' : ''}`}
        >
            {message.forwardedFrom && (
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenForwardedAuthor?.(message.forwardedFrom!.id, message.forwardedFrom!.displayName); }}
                    className="text-[11px] text-[#8ea1ff] hover:text-white mb-1 block"
                    title={`Открыть чат с ${message.forwardedFrom.displayName}`}
                >
                    ↪ Переслано от {message.forwardedFrom.displayName}
                </button>
            )}
            {message.replyTo && (
                <div className="block w-full text-left border-l-2 border-[#8ea1ff] pl-2 mb-1">
                    <p className="text-[11px] font-medium text-[#8ea1ff]">{replyAuthor}</p>
                    <p className="text-xs text-white/60 truncate selectable">
                        {message.replyTo.type === 'text' ? message.replyTo.text : humanizeType(message.replyTo.type)}
                    </p>
                </div>
            )}
            {type === 'video' ? (
                <AttachmentBody type="video" url={message.text} isMe={isMe} />
            ) : type === 'audio' ? (
                <AttachmentBody type="audio" url={message.text} isMe={isMe} />
            ) : type === 'file' ? (
                <AttachmentBody type="file" url={message.text} isMe={isMe} />
            ) : (
                <div className="text-sm leading-snug break-words whitespace-pre-wrap selectable">{message.text}</div>
            )}
            <MessageMeta isMe={isMe} timestamp={message.timestamp} status={message.status} pinned={message.pinned} />
        </div>
    );

    return (
        <div
            {...longPress}
            onContextMenu={(e) => onContextMenu(e, message)}
            style={{ WebkitTouchCallout: 'none' }}
            className={`flex items-end gap-2 mb-1 ${isMe ? 'justify-end md:justify-start' : 'justify-start'}`}
        >
            {isGroup && !isMe && (
                <div className="w-8 shrink-0">
                    {showAvatar && <Avatar name={chatName} src={partnerAvatar || undefined} size={28} />}
                </div>
            )}
            <div className="flex flex-col min-w-0 max-w-[78%] sm:max-w-[70%]">
                {bubble}
                <ReactionBar message={message} onToggleReaction={onToggleReaction} />
            </div>
        </div>
    );
};

const formatRecTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const MicIcon: React.FC<{ size?: number }> = ({ size = 19 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 16c2.206 0 4-1.794 4-4V6c0-2.217-1.785-4.021-3.979-4.021a.933.933 0 0 0-.209.025A4.006 4.006 0 0 0 8 6v6c0 2.206 1.794 4 4 4z" />
        <path d="M11 19.931V22h2v-2.069c3.939-.495 7-3.858 7-7.931h-2c0 3.309-2.691 6-6 6s-6-2.691-6-6H4c0 4.072 3.061 7.436 7 7.931z" />
    </svg>
);

const SendIcon: React.FC<{ size?: number }> = ({ size = 19 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="m21.426 11.095-17-8A.999.999 0 0 0 3.03 4.242L4.969 12 3.03 19.758a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81zM5.481 18.197l.839-3.357L12 12 6.32 9.16l-.839-3.357L18.651 12l-13.17 6.197z" />
    </svg>
);

const MessageInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onAttachFile: (file: File) => void;
    isSendingAttachment?: boolean;
    replyTo?: Message | null;
    onCancelReply?: () => void;
    onRecordingChange?: (recording: boolean) => void;
}> = ({ value, onChange, onSend, onAttachFile, isSendingAttachment, replyTo, onCancelReply, onRecordingChange }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // запись голосового сообщения
    const [recording, setRecording] = React.useState(false);
    const [recSeconds, setRecSeconds] = React.useState(0);
    const [micDenied, setMicDenied] = React.useState(false);
    const recorderRef = React.useRef<MediaRecorder | null>(null);
    const chunksRef = React.useRef<Blob[]>([]);
    const timerRef = React.useRef<number | null>(null);
    const cancelRecRef = React.useRef(false);

    const cleanupRecording = () => {
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
        recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        chunksRef.current = [];
        setRecording(false);
        setRecSeconds(0);
        onRecordingChange?.(false);
    };

    // остановка записи при размонтировании (без зависимостей эффекта)
    const unmountCleanupRef = React.useRef<() => void>(() => {});
    unmountCleanupRef.current = cleanupRecording;
    React.useEffect(() => () => unmountCleanupRef.current(), []);

    const startRecording = async () => {
        if (recording || isSendingAttachment) return;
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setMicDenied(true);
            window.setTimeout(() => setMicDenied(false), 2500);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
            const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            chunksRef.current = [];
            cancelRecRef.current = false;
            rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            rec.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
                const cancelled = cancelRecRef.current;
                cleanupRecording();
                if (!cancelled && blob.size > 0) {
                    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
                    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
                    onAttachFile(file);
                }
            };
            rec.start();
            recorderRef.current = rec;
            setRecording(true);
            setRecSeconds(0);
            onRecordingChange?.(true);
            timerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
        } catch (err) {
            console.error('Микрофон недоступен:', err);
            setMicDenied(true);
            window.setTimeout(() => setMicDenied(false), 2500);
        }
    };

    const stopRecording = (cancel = false) => {
        if (!recorderRef.current) return;
        cancelRecRef.current = cancel;
        if (recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
        } else {
            cleanupRecording();
        }
    };

    const hasText = !!value.trim();

    if (recording) {
        return (
            <div className="shrink-0 bg-[#17212b] border-t border-black/30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {replyTo && (
                    <div className="mx-3 sm:mx-4 mt-2 flex items-center gap-2 bg-[#0e1621] border border-white/5 border-l-2 border-l-[#8ea1ff] rounded-lg px-3 py-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-[#8ea1ff] shrink-0">
                            <polyline points="9 14 4 9 9 4" />
                            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-[#8ea1ff]">
                                {replyTo.sender === 'them' ? 'Ответ собеседнику' : 'Ответ себе'}
                            </p>
                            <p className="text-xs text-white/60 truncate">
                                {replyTo.type === 'text' || !replyTo.type ? replyTo.text : humanizeType(replyTo.type)}
                            </p>
                        </div>
                        <button onClick={onCancelReply} className="text-[#8f9aa7] hover:text-white p-1 rounded-full hover:bg-white/10" aria-label="Отменить ответ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}
                <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
                    <button
                        onClick={() => stopRecording(true)}
                        className="text-[#8f9aa7] hover:text-white p-2.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                        aria-label="Отменить запись"
                        title="Отменить запись"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-2 bg-[#0e1621] border border-white/5 rounded-2xl py-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#f23f42] animate-pulse shrink-0" />
                        <span className="text-white text-sm tabular-nums">{formatRecTime(recSeconds)}</span>
                        <span className="text-[#5d6b7b] text-xs hidden sm:inline">Запись голосового…</span>
                    </div>
                    <button
                        onClick={() => stopRecording(false)}
                        disabled={recSeconds < 1}
                        className="bg-[#5865F2] hover:bg-[#4752c4] disabled:bg-[#222d3d] disabled:text-[#5d6b7b] text-white p-2.5 rounded-full transition-all active:scale-95 disabled:cursor-default shrink-0"
                        aria-label="Отправить голосовое"
                        title="Отправить голосовое"
                    >
                        <SendIcon size={18} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="shrink-0 bg-[#17212b] border-t border-black/30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {replyTo && (
                <div className="mx-3 sm:mx-4 mt-2 flex items-center gap-2 bg-[#0e1621] border border-white/5 border-l-2 border-l-[#8ea1ff] rounded-lg px-3 py-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-[#8ea1ff] shrink-0">
                        <polyline points="9 14 4 9 9 4" />
                        <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-[#8ea1ff]">
                            {replyTo.sender === 'them' ? 'Ответ собеседнику' : 'Ответ себе'}
                        </p>
                        <p className="text-xs text-white/60 truncate">
                            {replyTo.type === 'text' || !replyTo.type ? replyTo.text : humanizeType(replyTo.type)}
                        </p>
                    </div>
                    <button onClick={onCancelReply} className="text-[#8f9aa7] hover:text-white p-1 rounded-full hover:bg-white/10" aria-label="Отменить ответ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            )}
            {micDenied && (
                <p className="mx-3 sm:mx-4 mt-2 text-xs text-[#f23f42]">Нет доступа к микрофону — разрешите его в браузере</p>
            )}
            <div className="flex items-center gap-2 px-3 sm:px-4 py-3">
                <div className="flex-1 flex items-center bg-[#0e1621] border border-white/5 rounded-2xl px-3 sm:px-4">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="flex-1 py-3 bg-transparent text-white text-[16px] sm:text-sm focus:outline-none placeholder-[#5d6b7b] min-w-0"
                        placeholder={replyTo ? 'Ответить…' : 'Написать сообщение…'}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
                    />
                    <button
                        onClick={startRecording}
                        className="text-[#5d6b7b] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                        aria-label="Записать голосовое"
                        title="Записать голосовое сообщение"
                    >
                        <MicIcon />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#5d6b7b] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                        aria-label="Прикрепить"
                        title="Прикрепить фото, видео или файл"
                    >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onAttachFile(file);
                            e.target.value = '';
                        }}
                    />
                </div>
                <button
                    onClick={onSend}
                    disabled={!hasText || isSendingAttachment}
                    className="bg-[#5865F2] hover:bg-[#4752c4] disabled:bg-[#222d3d] disabled:text-[#5d6b7b] text-white h-11 w-11 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-default shrink-0"
                    aria-label="Отправить"
                >
                    {isSendingAttachment ? (
                        <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        </svg>
                    ) : (
                        <SendIcon size={22} />
                    )}
                </button>
            </div>
        </div>
    );
};

const MessageContextMenu: React.FC<{
    message: Message;
    x: number;
    y: number;
    onClose: () => void;
    onReply: (m: Message) => void;
    onForward: (m: Message) => void;
    onDeletePrompt: (m: Message) => void;
    onTogglePin: (m: Message) => void;
    onReact: (m: Message, emoji: string) => void;
}> = ({ message, x, y, onClose, onReply, onForward, onDeletePrompt, onTogglePin, onReact }) => {
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ left: x, top: y, visible: false });
    // на тач-устройствах после long-press приходит синтетический клик — не закрываем меню по нему
    const openedAtRef = React.useRef(Date.now());

    React.useEffect(() => {
        openedAtRef.current = Date.now();
        // позиционируем с учётом границ экрана (после первого рендера, когда известен размер)
        const el = menuRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        let left = x, top = y;
        if (left + r.width > window.innerWidth - 8) left = window.innerWidth - r.width - 8;
        if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        setPos({ left, top, visible: true });
    }, [x, y]);

    React.useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            // игнорируем клик, «догнавший» меню сразу после открытия (touch)
            if (Date.now() - openedAtRef.current < 500) return;
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        // повторный ПКМ на сообщении обновит позицию (ChatArea сам перезапишет состояние),
        // здесь закрываем только кликами вне меню
        window.addEventListener('mousedown', onDocMouseDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDocMouseDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const itemCls = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white hover:bg-[#5865F2]/80 transition-colors text-left';
    const isLocal = message.id.startsWith('local-');

    return (
        <div
            ref={menuRef}
            className="fixed z-[60] min-w-[220px] bg-[#1c2530] border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 overflow-hidden"
            style={{ left: pos.left, top: pos.top, opacity: pos.visible ? 1 : 0, pointerEvents: pos.visible ? 'auto' : 'none' }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div className="flex gap-0.5 px-1.5 pb-1.5 border-b border-white/10 mb-1">
                {REACTION_EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        onClick={() => { if (!isLocal) onReact(message, emoji); onClose(); }}
                        disabled={isLocal}
                        className="flex-1 min-w-0 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors active:scale-90 disabled:opacity-40"
                        title={`Реакция ${emoji}`}
                    >
                        <img src={emojiUrl(emoji)} alt={emoji} className="w-[22px] h-[22px] pointer-events-none" draggable={false} />
                    </button>
                ))}
            </div>
            <button className={itemCls} onClick={() => { onReply(message); onClose(); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                </svg>
                Ответить
            </button>
            <button className={itemCls} onClick={() => { onForward(message); onClose(); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="15 14 20 9 15 4" />
                    <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                </svg>
                Переслать
            </button>
            <button
                className={itemCls}
                onClick={() => { onTogglePin(message); onClose(); }}
                disabled={message.id.startsWith('local-')}
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className={message.pinned ? 'text-[#e8a33d]' : ''}>
                    <path d="m12 22 1-2v-3h5a1 1 0 0 0 1-1v-1.586c0-.526-.214-1.042-.586-1.414L17 11.586V8a1 1 0 0 0 1-1V4c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2v3a1 1 0 0 0 1 1v3.586L5.586 13A2.01 2.01 0 0 0 5 14.414V16a1 1 0 0 0 1 1h5v3l1 2zM8 4h8v2H8V4zM7 14.414l1.707-1.707A.996.996 0 0 0 9 12V8h6v4c0 .266.105.52.293.707L17 14.414V15H7v-.586z" />
                </svg>
                {message.pinned ? 'Открепить' : 'Закрепить'}
            </button>
            {message.type === 'text' && (
                <button
                    className={itemCls}
                    onClick={() => { navigator.clipboard?.writeText(message.text).catch(() => {}); onClose(); }}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Копировать текст
                </button>
            )}
            <div className="h-px bg-white/10 my-1.5" />
            <button className={`${itemCls} hover:bg-red-500/80`} onClick={() => { onDeletePrompt(message); onClose(); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Удалить
            </button>
        </div>
    );
};

const ForwardDialog: React.FC<{
    message: Message | null;
    onClose: () => void;
    onDone: () => void;
}> = ({ message, onClose, onDone }) => {
    const [chats, setChats] = React.useState<ChatListItem[]>([]);
    const [query, setQuery] = React.useState('');
    const [forwarding, setForwarding] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (message) {
            getChats().then(setChats);
        }
    }, [message]);

    if (!message) return null;

    const filtered = chats.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

    const handleForward = async (chatId: string) => {
        setForwarding(chatId);
        try {
            await forwardMessage(chatId, message.id);
            onDone();
        } catch (e) {
            console.error(e);
        } finally {
            setForwarding(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={onClose}>
            <div
                className="bg-[#17212b] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/5 max-h-[80dvh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 pt-5 pb-3">
                    <h3 className="text-white font-semibold">Переслать сообщение</h3>
                    <p className="text-xs text-[#8f9aa7] mt-0.5 truncate">
                        {message.type === 'text' ? message.text : humanizeType(message.type || 'text')}
                    </p>
                </div>
                <div className="px-4 pb-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск чата…"
                        className="w-full px-3.5 py-2 bg-[#0e1621] text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5865F2] border border-white/5 placeholder-[#5d6b7b]"
                    />
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
                    {filtered.length === 0 ? (
                        <p className="text-[#5d6b7b] text-sm px-3 py-4">Нет доступных чатов</p>
                    ) : (
                        filtered.map(c => (
                            <button
                                key={c.id}
                                onClick={() => handleForward(c.id)}
                                disabled={forwarding !== null}
                                className="w-full flex items-center gap-3 p-2.5 mb-1 rounded-xl hover:bg-white/5 disabled:opacity-50 transition-colors text-left"
                            >
                                <Avatar name={c.name} src={c.avatar} size={40} />
                                <span className="flex-1 text-white text-sm font-medium truncate text-left">{c.name}</span>
                                {forwarding === c.id && <span className="w-4 h-4 border-2 border-[#8ea1ff] border-t-transparent rounded-full animate-spin" />}
                            </button>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-white/5">
                    <button onClick={onClose} className="w-full bg-[#222d3d] hover:bg-[#2b3646] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    );
};

const PinnedBar: React.FC<{
    pinned: Message | null;
    onJump: (id: string) => void;
    onUnpin: (m: Message) => void;
}> = ({ pinned, onJump, onUnpin }) => {
    if (!pinned) return null;
    return (
        <div className="shrink-0 flex items-center gap-2.5 px-3 sm:px-4 py-2 bg-[#17212b] border-b border-black/30 cursor-pointer hover:bg-[#1b2733] transition-colors"
            onClick={() => onJump(pinned.id)}
            title="Перейти к закреплённому сообщению"
        >
            <span className="w-0.5 h-8 bg-[#e8a33d] rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#e8a33d] flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="m12 22 1-2v-3h5a1 1 0 0 0 1-1v-1.586c0-.526-.214-1.042-.586-1.414L17 11.586V8a1 1 0 0 0 1-1V4c0-1.103-.897-2-2-2H8c-1.103 0-2 .897-2 2v3a1 1 0 0 0 1 1v3.586L5.586 13A2.01 2.01 0 0 0 5 14.414V16a1 1 0 0 0 1 1h5v3l1 2zM8 4h8v2H8V4zM7 14.414l1.707-1.707A.996.996 0 0 0 9 12V8h6v4c0 .266.105.52.293.707L17 14.414V15H7v-.586z" />
                    </svg>
                    Закреплённое сообщение
                </p>
                <p className="text-xs text-[#8f9aa7] truncate">
                    {pinned.type === 'text' || !pinned.type ? pinned.text : humanizeType(pinned.type)}
                </p>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onUnpin(pinned); }}
                className="text-[#8f9aa7] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                aria-label="Открепить сообщение"
                title="Открепить"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
};

const ImageLightbox: React.FC<{ url: string | null; onClose: () => void }> = ({ url, onClose }) => {
    React.useEffect(() => {
        if (!url) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [url, onClose]);

    if (!url) return null;

    return (
        <div
            className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            onClick={onClose}
        >
            <img src={url} alt="Просмотр" className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Закрыть просмотр"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
};

const UsernameCopy: React.FC<{ username: string }> = ({ username }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard?.writeText(`@${username}`).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleCopy}
            className="relative text-[#8ea1ff] hover:text-white text-sm mt-0.5 transition-colors cursor-pointer"
            title="Нажмите, чтобы скопировать"
        >
            @{username}
            {copied && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#0e1621] border border-white/10 text-white text-[10px] px-2 py-1 rounded-md shadow-lg">
                    Скопировано ✓
                </span>
            )}
        </button>
    );
};

const ChatInfoPanel: React.FC<{
    onClose: () => void;
    chatName: string;
    partner: PublicUserStatus | null;
    selectedChatId: string | null;
    onOpenImage?: (url: string) => void;
    mediaVersion?: number;
    embedded?: boolean;
}> = ({ onClose, chatName, partner, selectedChatId, onOpenImage, mediaVersion, embedded }) => {
    const [media, setMedia] = React.useState<ChatAttachment[] | null>(null);

    React.useEffect(() => {
        if (selectedChatId) {
            getCachedMedia(selectedChatId, mediaVersion).then(setMedia);
        }
    }, [selectedChatId, mediaVersion]);

    const images = media?.filter((m) => m.type === 'image') ?? [];
    const videos = media?.filter((m) => m.type === 'video') ?? [];
    const audios = media?.filter((m) => m.type === 'audio') ?? [];
    const files = media?.filter((m) => m.type === 'file') ?? [];

    const inner = (
        <div className={`w-full ${embedded ? '' : 'md:w-[320px]'} h-full shrink-0 bg-[#17212b] flex flex-col`}>
                {!embedded && (
                    <div className="h-[60px] px-4 flex items-center justify-between border-b border-black/30 shrink-0">
                        <h3 className="text-white font-semibold">Информация о чате</h3>
                        <button onClick={onClose} className="text-[#8f9aa7] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors" aria-label="Закрыть панель" title="Свернуть панель">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto overscroll-contain p-4">
                    <div className="flex flex-col items-center mb-5">
                        <div className="relative mb-2.5">
                            <Avatar name={chatName} src={partner?.avatar || undefined} size={72} />
                            {partner?.online && (
                                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#17212b]" title="онлайн" />
                            )}
                        </div>
                        <h4 className="text-white font-medium selectable">{chatName}</h4>
                        {partner && !partner.online && (
                            <p className="text-xs text-[#8f9aa7]">{formatLastSeen(partner.lastSeenAt)}</p>
                        )}
                        {partner?.username && <UsernameCopy username={partner.username} />}
                    </div>

                    <h4 className="text-[10px] font-semibold text-[#8f9aa7] uppercase tracking-wider mb-2">Вложения</h4>
                    {media === null ? (
                        <p className="text-[#5d6b7b] text-sm">Загрузка…</p>
                    ) : media.length === 0 ? (
                        <p className="text-[#5d6b7b] text-sm">Вложений пока нет</p>
                    ) : (
                        <div className="space-y-4">
                            {images.length > 0 && (
                                <div className="grid grid-cols-3 gap-1.5">
                                    {images.map((img) => (
                                        <button
                                            key={img._id}
                                            onClick={() => onOpenImage?.(assetUrl(img.url) || '')}
                                            className="aspect-square rounded-lg overflow-hidden bg-[#0e1621] block cursor-zoom-in"
                                            title="Открыть изображение"
                                        >
                                            <img src={assetUrl(img.url)} alt="Вложение" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {videos.map((v) => (
                                <video key={v._id} src={assetUrl(v.url)} controls className="w-full rounded-xl" />
                            ))}
                            {audios.map((a) => (
                                <div key={a._id} className="bg-[#0e1621] rounded-xl p-2.5 border border-white/5">
                                    <p className="text-xs text-white/70 mb-1.5 flex items-center gap-1.5">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
                                        </svg>
                                        Голосовое сообщение
                                    </p>
                                    <VoicePlayer src={assetUrl(a.url) || ''} isMe={a.mine} compact />
                                </div>
                            ))}
                            {files.map((f) => (
                                <a
                                    key={f._id}
                                    href={assetUrl(f.url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 bg-[#0e1621] rounded-xl p-2.5 border border-white/5 text-white text-sm hover:bg-[#1a2330] transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    Открыть файл
                                </a>
                             ))}
                          </div>
                       )}
                   </div>
               </div>
    );

    return inner;
};

const EmptyChat: React.FC = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-[#8f9aa7] p-4">
        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-5">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#5d6b7b" strokeWidth="1.3" strokeLinecap="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
        </div>
        <h2 className="text-white text-lg font-medium mb-1.5">Нет выбранного чата</h2>
        <p className="text-sm text-center">Выберите чат слева или начните новую переписку</p>
    </div>
);

// Строка профиля в стиле Telegram: иконка слева, значение и подпись
const ProfileInfoRow: React.FC<{
    icon: React.ReactNode;
    value: React.ReactNode;
    label: string;
    onClick?: () => void;
}> = ({ icon, value, label, onClick }) => {
    const Wrapper: React.ElementType = onClick ? 'button' : 'div';
    return (
        <Wrapper
            {...(onClick ? { onClick, type: 'button' as const } : {})}
            className={`w-full flex items-start gap-4 px-4 py-2.5 text-left transition-colors ${
                onClick ? 'hover:bg-white/5 cursor-pointer' : ''
            }`}
        >
            <span className="text-[#8f9aa7] mt-0.5 shrink-0">{icon}</span>
            <span className="min-w-0">
                <span className="block text-sm text-white break-words selectable">{value}</span>
                <span className="block text-xs text-[#8f9aa7] mt-0.5">{label}</span>
            </span>
        </Wrapper>
    );
};

const PartnerProfileModal: React.FC<{
    open: boolean;
    onClose: () => void;
    partner: PublicUserStatus | null;
    chatId: string | null;
    onOpenImage?: (url: string) => void;
    mediaVersion?: number;
}> = ({ open, onClose, partner, chatId, onOpenImage, mediaVersion }) => {
    const [media, setMedia] = React.useState<ChatAttachment[] | null>(null);

    React.useEffect(() => {
        if (open && chatId) {
            setMedia(null);
            getCachedMedia(chatId, mediaVersion ?? 'profile').then(setMedia);
        }
    }, [open, chatId, mediaVersion]);

    if (!open || !partner) return null;

    const images = media?.filter((m) => m.type === 'image') ?? [];
    const videos = media?.filter((m) => m.type === 'video') ?? [];
    const audios = media?.filter((m) => m.type === 'audio') ?? [];
    const files = media?.filter((m) => m.type === 'file') ?? [];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50" onClick={onClose}>
            <div
                className="bg-[#17212b] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-white/5 max-h-[92dvh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="overflow-y-auto overscroll-contain flex-1">
                    {/* Шапка: крупный аватар, имя, статус */}
                    <div className="flex flex-col items-center pt-7 pb-5 px-6">
                        <div className="relative mb-3">
                            <Avatar name={partner.displayName} src={partner.avatar || undefined} size={110} />
                            {partner.online && (
                                <span className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full bg-green-500 border-[3px] border-[#17212b]" title="онлайн" />
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white text-center selectable">{partner.displayName}</h3>
                        {!partner.online && (
                            <p className="text-sm mt-1 text-[#8f9aa7]">{formatLastSeen(partner.lastSeenAt)}</p>
                        )}
                    </div>

                    {/* Информация: строки в стиле Telegram */}
                    <div className="mx-2 sm:mx-3 mb-3">
                        {partner.bio && (
                            <ProfileInfoRow
                                icon={
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                }
                                value={partner.bio}
                                label="О себе"
                            />
                        )}
                        {partner.username && (
                            <ProfileInfoRow
                                icon={
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                }
                                value={<UsernameCopy username={partner.username} />}
                                label="Имя пользователя"
                            />
                        )}
                    </div>

                    {/* Вложения */}
                    <div className="px-4 pb-6">
                        <h4 className="text-[10px] font-semibold text-[#8f9aa7] mb-2 uppercase tracking-wider">Вложения в чате</h4>
                        {media === null ? (
                            <p className="text-[#5d6b7b] text-sm">Загрузка…</p>
                        ) : media.length === 0 ? (
                            <p className="text-[#5d6b7b] text-sm">Вложений пока нет</p>
                        ) : (
                            <div className="space-y-3">
                                {images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {images.map((img) => (
                                            <button
                                                key={img._id}
                                                onClick={() => onOpenImage?.(assetUrl(img.url) || '')}
                                                className="aspect-square rounded-lg overflow-hidden bg-[#0e1621] block cursor-zoom-in"
                                                title="Открыть изображение"
                                            >
                                                <img src={assetUrl(img.url)} alt="Вложение" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {videos.map((v) => (
                                    <video key={v._id} src={assetUrl(v.url)} controls className="w-full rounded-xl" />
                                ))}
                                {audios.map((a) => (
                                    <div key={a._id} className="bg-[#0e1621] rounded-xl p-2.5 border border-white/5">
                                        <p className="text-xs text-white/70 mb-1.5 flex items-center gap-1.5">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" />
                                            </svg>
                                            Голосовое сообщение
                                        </p>
                                        <VoicePlayer src={assetUrl(a.url) || ''} isMe={a.mine} compact />
                                    </div>
                                ))}
                                {files.map((f) => (
                                    <a
                                        key={f._id}
                                        href={assetUrl(f.url)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 bg-[#0e1621] rounded-xl p-2.5 border border-white/5 text-white text-sm hover:bg-[#1a2330] transition-colors"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        Открыть файл
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-[#222d3d] hover:bg-[#2b3646] text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all"
                    >
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

const messagesCache = new Map<string, Message[]>();

// Долговременный кэш переписок в localStorage: старые сообщения не запрашиваются
// повторно при каждом открытии чата (запрашивается только свежая страница, старая
// история досохраняется и объединяется).
const MSG_LS_PREFIX = 'saturn-msgs-';
const MSG_LS_LIMIT = 120;

const readMsgCache = (chatId: string): { messages: Message[]; hasMore: boolean } | null => {
    try {
        const raw = localStorage.getItem(MSG_LS_PREFIX + chatId);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>; hasMore: boolean };
        if (!Array.isArray(parsed.messages)) return null;
        return {
            messages: parsed.messages.map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
            hasMore: !!parsed.hasMore,
        };
    } catch {
        return null;
    }
};

const writeMsgCache = (chatId: string, messages: Message[], hasMore: boolean) => {
    try {
        // сохраняем самые свежие, но не теряем более старые, которые уже в кэше
        const trimmed = messages
            .filter((m) => !m.id.startsWith('local-'))
            .slice(-MSG_LS_LIMIT)
            .map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
        localStorage.setItem(MSG_LS_PREFIX + chatId, JSON.stringify({ messages: trimmed, hasMore }));
    } catch { /* переполнение localStorage игнорируем */ }
};

const clearMsgCache = (chatId: string) => {
    messagesCache.delete(chatId);
    try { localStorage.removeItem(MSG_LS_PREFIX + chatId); } catch { /* ignore */ }
};

// Кэш галереи вложений: панель «Информация» не перезапрашивает список картинок заново
const mediaCache = new Map<string, { data: ChatAttachment[]; at: number }>();
const MEDIA_TTL = 60_000;
const getCachedMedia = async (chatId: string, version: unknown): Promise<ChatAttachment[]> => {
    const key = `${chatId}:${String(version)}`;
    const hit = mediaCache.get(key);
    if (hit && Date.now() - hit.at < MEDIA_TTL) return hit.data;
    const data = await getChatMedia(chatId);
    mediaCache.set(key, { data, at: Date.now() });
    return data;
};

const ChatArea: React.FC<ChatAreaProps> = ({ selectedChatId, chatName = 'Chat', onSendMessage, onBack, onSelectChat }) => {
    const [message, setMessage] = React.useState('');
    const [messages, setMessages] = React.useState<Message[]>([]);
    const [partnerStatus, setPartnerStatus] = React.useState<PublicUserStatus | null>(null);
    const [isPartnerProfileOpen, setIsPartnerProfileOpen] = React.useState(false);
    const [isSendingAttachment, setIsSendingAttachment] = React.useState(false);
    const [replyTo, setReplyTo] = React.useState<Message | null>(null);
    const [contextMenu, setContextMenu] = React.useState<{ message: Message; x: number; y: number } | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<Message | null>(null);
    const [forwardMessage, setForwardMessage] = React.useState<Message | null>(null);
    const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
    const [isMobile, setIsMobile] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
    // по умолчанию панель информации закрыта (и на мобильных, и на десктопе)
    const [infoOpen, setInfoOpen] = React.useState(false);
    const [pinnedMessages, setPinnedMessages] = React.useState<Message[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [loadingOlder, setLoadingOlder] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const [atBottom, setAtBottom] = React.useState(true);
    const [partnerTyping, setPartnerTyping] = React.useState<null | 'typing' | 'recording'>(null);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const needScrollBottomRef = React.useRef(true); // скролл вниз при открытии чата
    const messagesRef = React.useRef<Message[]>([]);
    messagesRef.current = messages;
    const hasMoreRef = React.useRef(false);
    hasMoreRef.current = hasMore;
    // зеркало atBottom + флаг «доскроллить при рендере нового сообщения»
    const atBottomRef = React.useRef(true);
    atBottomRef.current = atBottom;
    const incomingScrollRef = React.useRef(false);
    const loadingOlderRef = React.useRef(false);
    // якорь скролла при подгрузке старых сообщений (сохраняем позицию)
    const scrollAnchorRef = React.useRef<{ prevHeight: number; prevTop: number } | null>(null);
    const selectedChatRef = React.useRef<string | null>(null);
    selectedChatRef.current = selectedChatId;

    // применяем изменения к сообщениям текущего чата (состояние + кэш между переключениями)
    const applyMessages = React.useCallback((fn: (prev: Message[]) => Message[]) => {
        const chatId = selectedChatRef.current;
        if (!chatId) return;
        const next = fn(messagesRef.current);
        messagesRef.current = next;
        messagesCache.set(chatId, next);
        writeMsgCache(chatId, next, hasMoreRef.current);
        setMessages(next);
    }, []);

    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const toggleInfo = () => {
        setInfoOpen(prev => !prev);
    };

    // id закреплённых сообщений нужны в mapMessage при загрузке обычных сообщений
    const pinnedIdsRef = React.useRef<Set<string>>(new Set());

    const mapMessage = (m: ChatMessage): Message => ({
        id: m.id,
        text: m.text,
        sender: m.mine ? 'me' as const : 'them' as const,
        timestamp: new Date(m.createdAt),
        status: m.mine ? (m.readAt ? 'read' as const : 'sent' as const) : undefined,
        type: m.type,
        replyTo: m.replyTo,
        forwardedFrom: m.forwardedFrom,
        pinned: pinnedIdsRef.current.has(m.id),
        reactions: m.reactions ?? [],
    });

    const fetchPinned = React.useCallback(async () => {
        if (!selectedChatId) {
            setPinnedMessages([]);
            return;
        }
        const fetched = await getPinnedMessages(selectedChatId);
        pinnedIdsRef.current = new Set(fetched.map((m) => m.id));
        setPinnedMessages(fetched.map((m) => ({ ...mapMessage(m), pinned: true })));
        // синхронизируем индикаторы закрепа у уже загруженных сообщений
        applyMessages((prev) => prev.map((m) => ({ ...m, pinned: pinnedIdsRef.current.has(m.id) })));
    }, [selectedChatId, applyMessages]);

    React.useEffect(() => {
        pinnedIdsRef.current = new Set();
        setPinnedMessages([]);
        fetchPinned();
    }, [selectedChatId, fetchPinned]);

    React.useEffect(() => {
        if (!selectedChatId) {
            setPartnerStatus(null);
            return;
        }
        let cancelled = false;
        const loadStatus = async () => {
            const data = await getPartnerStatus(selectedChatId);
            if (!cancelled && data) setPartnerStatus(data);
        };
        loadStatus();
        const timer = setInterval(loadStatus, 30000); // статус обновляется каждые 30 с
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [selectedChatId]);

    const upsertServerMessage = React.useCallback((m: ChatMessage) => {
        const mapped = mapMessage(m);
        applyMessages((prev) => {
            // дедуп: убираем локальную копию и уже существующее сообщение
            const filtered = prev.filter((p) => {
                if (p.id === mapped.id) return false;
                if (
                    p.id.startsWith('local-') &&
                    p.sender === mapped.sender &&
                    p.text === mapped.text &&
                    Math.abs(p.timestamp.getTime() - mapped.timestamp.getTime()) < 15000
                ) return false;
                return true;
            });
            return [...filtered, mapped].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        });
    }, [applyMessages]);

    const fetchMessages = React.useCallback(async (showLoader = false) => {
        const chatId = selectedChatId;
        if (!chatId) {
            setMessages([]);
            return;
        }
        if (showLoader) setLoading(true);
        try {
            const { messages: fetched, hasMore: more } = await getMessages(chatId);
            if (selectedChatRef.current !== chatId) return; // чат уже переключили
            const local = messagesRef.current.filter(p => p.id.startsWith('local-'));
            const server = fetched.map(m => mapMessage(m));
            // локальные отправленные, которых ещё нет на сервере (сверяем текст и время)
            const stillLocal = local.filter(l =>
                !server.some(s =>
                    s.sender === 'me' && s.text === l.text &&
                    Math.abs(s.timestamp.getTime() - l.timestamp.getTime()) < 15000
                )
            );
            // merge: свежая страница с сервера + старые сообщения из кэша (id-дедуп).
            // Так старая история не перезапрашивается и не пропадает при открытии чата.
            const serverIds = new Set(server.map(s => s.id));
            const oldestFetched = server.length ? server[0].timestamp.getTime() : Number.MAX_SAFE_INTEGER;
            const cachedOlder = messagesRef.current.filter(
                (m) => !m.id.startsWith('local-') && !serverIds.has(m.id) && m.timestamp.getTime() < oldestFetched
            );
            const merged = [...cachedOlder, ...server, ...stillLocal].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            messagesCache.set(chatId, merged);
            messagesRef.current = merged;
            writeMsgCache(chatId, merged, more);
            hasMoreRef.current = more;
            setHasMore(more);
            setMessages(merged);
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [selectedChatId]);

    // подгрузка старой истории при скролле вверх (курсорная пагинация)
    const loadOlder = React.useCallback(async () => {
        const chatId = selectedChatRef.current;
        if (!chatId || loadingOlderRef.current || !hasMoreRef.current) return;
        const oldest = messagesRef.current.find((m) => !m.id.startsWith('local-'));
        if (!oldest) return;
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        try {
            const { messages: older, hasMore: more } = await getMessages(chatId, oldest.timestamp.toISOString());
            if (selectedChatRef.current !== chatId) return;
            hasMoreRef.current = more;
            setHasMore(more);
            if (older.length) {
                applyMessages((prev) => {
                    const existing = new Set(prev.map((m) => m.id));
                    const toAdd = older.map(mapMessage).filter((m) => !existing.has(m.id));
                    return [...toAdd, ...prev].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
                });
            }
        } catch (error) {
            console.error('Failed to load older messages:', error);
        } finally {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
        }
    }, [applyMessages]);

    React.useEffect(() => {
        // мгновенный показ из кэша: сначала память (между переключениями чатов),
        // затем localStorage (старая история после перезагрузки страницы)
        let cached = selectedChatId ? messagesCache.get(selectedChatId) : undefined;
        let cachedHasMore = false;
        if (!cached && selectedChatId) {
            const fromLs = readMsgCache(selectedChatId);
            if (fromLs && fromLs.messages.length) {
                cached = fromLs.messages;
                cachedHasMore = fromLs.hasMore;
                messagesCache.set(selectedChatId, fromLs.messages);
            }
        }
        setMessages(cached ? cached : []);
        messagesRef.current = cached ? cached : [];
        setPartnerTyping(null);
        needScrollBottomRef.current = true;
        setAtBottom(true);
        if (!cached) setLoading(true);
        // если есть кэш — hasMore уже известен; всё равно сверяемся с сервером (свежая страница)
        hasMoreRef.current = cachedHasMore;
        setHasMore(cachedHasMore);
        fetchMessages(!cached);
    }, [selectedChatId, fetchMessages]);

    // восстанавливаем позицию скролла после подгрузки истории
    React.useEffect(() => {
        if (scrollAnchorRef.current && scrollRef.current) {
            const el = scrollRef.current;
            const { prevHeight, prevTop } = scrollAnchorRef.current;
            scrollAnchorRef.current = null;
            el.scrollTop = el.scrollHeight - prevHeight + prevTop;
        }
    }, [messages]);

    // скролл вниз ТОЛЬКО при открытии чата и при отправке своего сообщения
    React.useEffect(() => {
        if (needScrollBottomRef.current && messages.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            needScrollBottomRef.current = false;
            setAtBottom(true);
        }
        // новое сообщение по WS: доскролл только если пользователь был внизу
        if (incomingScrollRef.current) {
            incomingScrollRef.current = false;
            if (atBottomRef.current) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        // доскроллили вверх — подгружаем старую историю (якорь сохранит позицию)
        if (el.scrollTop < 120 && hasMoreRef.current && !loadingOlderRef.current) {
            scrollAnchorRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop };
            loadOlder();
        }
    };

    // страховка: если WS недоступен — подхватываем сообщения лёгким поллингом
    const wsConnected = useSocketStatus();
    React.useEffect(() => {
        if (wsConnected || !selectedChatId) return;
        const timer = setInterval(fetchMessages, 5000);
        return () => clearInterval(timer);
    }, [wsConnected, selectedChatId, fetchMessages]);

    // realtime: события WebSocket вместо поллинга
    useSocketEvents((event) => {
        if (event.type === 'message:new') {
            const m = event.message;
            const inThisChat = m.senderId === selectedChatId || m.recipientId === selectedChatId;
            if (selectedChatId && inThisChat) {
                upsertServerMessage({
                    id: m._id,
                    text: m.payload?.payload ?? '',
                    mine: m.senderId !== selectedChatId,
                    readAt: m.readAt ?? null,
                    type: (m.type as ChatMessage['type']) ?? 'text',
                    replyTo: m.replyTo ?? null,
                    forwardedFrom: m.forwardedFrom ?? null,
                    reactions: [],
                    createdAt: m.createdAt
                });
                // автопрокрутка вниз только если пользователь и так у последнего сообщения
                incomingScrollRef.current = atBottomRef.current;
                if (m.recipientId !== selectedChatId) {
                    // входящее от собеседника: чат открыт, вкладка активна → сразу отмечаем прочитанным
                    if (document.visibilityState === 'visible') markChatRead(selectedChatId);
                }
            }
            return;
        }
        if (event.type === 'messages:read' && event.chatId === selectedChatId) {
            // собеседник прочитал — мгновенно ставим статусы «прочитано»
            applyMessages((prev) => prev.map((m) => (m.sender === 'me' && m.status !== 'read' ? { ...m, status: 'read' as const } : m)));
            return;
        }
        if (event.type === 'message:deleted' && event.mode === 'all') {
            if (event.chatId === selectedChatId) {
                applyMessages((prev) => prev.filter((m) => m.id !== event.messageId));
                setPinnedMessages((prev) => prev.filter((m) => m.id !== event.messageId));
                pinnedIdsRef.current.delete(event.messageId);
            }
            return;
        }
        if (event.type === 'message:pinned' && event.chatId === selectedChatId) {
            pinnedIdsRef.current[event.pinned ? 'add' : 'delete'](event.messageId);
            applyMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, pinned: event.pinned } : m)));
            fetchPinned();
            return;
        }
        if (event.type === 'message:reaction' && event.chatId === selectedChatId) {
            // реакции обновляются мгновенно у обоих участников
            applyMessages((prev) => prev.map((m) => (m.id === event.messageId ? { ...m, reactions: event.reactions } : m)));
            return;
        }
        if (event.type === 'chat:deleted' && event.chatId === selectedChatId && event.mode === 'all') {
            applyMessages(() => []);
            clearMsgCache(event.chatId);
            setPinnedMessages([]);
            return;
        }
        if (event.type === 'typing' && selectedChatId) {
            if (event.from === selectedChatId) setPartnerTyping(event.typing ? (event.kind ?? 'typing') : null);
            return;
        }
        if (event.type === 'presence') {
            // мгновенно обновляем статус собеседника в шапке
            if (event.userId === selectedChatId) {
                setPartnerStatus((prev) => (prev ? { ...prev, online: event.online, lastSeenAt: event.at } : prev));
            }
        }
    });

    // typing: шлём не чаще раза в 2с, а также «стоп» при очистке поля
    const lastTypingSentRef = React.useRef(0);
    const typingStopTimerRef = React.useRef<number | null>(null);
    const sendTyping = (typing: boolean, kind?: 'typing' | 'recording') => {
        if (!selectedChatId) return;
        socket.send({ type: 'typing', to: selectedChatId, typing, kind });
    };
    const handleMessageInput = (value: string) => {
        setMessage(value);
        if (!selectedChatId) return;
        const nowTs = Date.now();
        if (value.trim() && nowTs - lastTypingSentRef.current > 2000) {
            lastTypingSentRef.current = nowTs;
            sendTyping(true, 'typing');
        }
        if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
        if (!value.trim()) {
            sendTyping(false, 'typing');
        } else {
            typingStopTimerRef.current = window.setTimeout(() => {
                sendTyping(false, 'typing');
            }, 4000);
        }
    };

    // запись голосового: собеседник видит «записывает голосовое сообщение»
    const handleRecordingChange = (recording: boolean) => {
        sendTyping(recording, 'recording');
    };

    const handleSend = async () => {
        if (message.trim() && selectedChatId) {
            const text = message.trim();
            setMessage('');
            socket.send({ type: 'typing', to: selectedChatId, typing: false });
            const replyToId = replyTo && !replyTo.id.startsWith('local-') ? replyTo.id : null;
            const localId = `local-${Date.now()}`;
            // оптимистично показываем сообщение сразу
            const newMessage: Message = {
                id: localId,
                text,
                sender: 'me',
                timestamp: new Date(),
                status: 'sent',
                replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.sender === 'me' ? 'me' : 'them', type: replyTo.type || 'text' } : null,
            };
            applyMessages(prev => [...prev, newMessage]);
            setReplyTo(null);
            requestAnimationFrame(() => scrollToBottom('smooth'));
            setAtBottom(true);
            try {
                await sendMessage(selectedChatId, text, replyToId);
                onSendMessage?.(text);
            } catch (error) {
                console.error('Error sending message:', error);
                // отправка не удалась — убираем оптимистичное сообщение и возвращаем текст
                applyMessages(prev => prev.filter(m => m.id !== localId));
                setMessage(text);
            }
        }
    };

    const handleDeleteMessage = async (msg: Message, mode: 'self' | 'all') => {
        if (!selectedChatId || msg.id.startsWith('local-')) return;
        try {
            await deleteMessage(selectedChatId, msg.id, mode);
            if (mode === 'self') {
                applyMessages(prev => prev.filter(m => m.id !== msg.id));
            }
            // для 'all' сообщение удалится у обоих по WS-событию
            // закреп мог ссылаться на удалённое сообщение — обновляем плашку
            await fetchPinned();
            onSendMessage?.('deleted');
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    const handleOpenForwardedAuthor = (userId: string, name: string) => {
        if (userId === selectedChatId) return;
        onSelectChat?.(userId, name);
    };

    const handleAttachFile = async (file: File) => {
        if (!selectedChatId || isSendingAttachment) return;
        setIsSendingAttachment(true);
        try {
            await sendAttachment(selectedChatId, file);
            await fetchMessages(); // подтягиваем вложение с серверным URL
            onSendMessage?.('attachment');
        } catch (error) {
            console.error('Error sending attachment:', error);
        } finally {
            setIsSendingAttachment(false);
        }
    };

    // закрепление/открепление сообщения
    const handleTogglePin = async (msg: Message) => {
        if (!selectedChatId || msg.id.startsWith('local-')) return;
        try {
            if (msg.pinned) {
                await unpinMessage(selectedChatId, msg.id);
                pinnedIdsRef.current.delete(msg.id);
            } else {
                await pinMessage(selectedChatId, msg.id);
                pinnedIdsRef.current.add(msg.id);
            }
            applyMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, pinned: !msg.pinned } : m)));
            await fetchPinned();
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleUnpinFromBar = async (msg: Message) => {
        if (!selectedChatId) return;
        try {
            await unpinMessage(selectedChatId, msg.id);
            pinnedIdsRef.current.delete(msg.id);
            applyMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, pinned: false } : m)));
            await fetchPinned();
        } catch (error) {
            console.error('Error unpinning message:', error);
        }
    };

    // реакция на сообщение: оптимистичный toggle, затем подтверждение от сервера/WS
    const handleToggleReaction = React.useCallback((msg: Message, emoji: string) => {
        if (!selectedChatId || msg.id.startsWith('local-')) return;
        const chatId = selectedChatId;
        const apply = (reactions: MessageReaction[]) => {
            applyMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, reactions } : m)));
        };
        const prevList = msg.reactions ?? [];
        const mineExisting = prevList.find((r) => r.emoji === emoji && r.mine);
        let optimistic: MessageReaction[];
        if (mineExisting) {
            optimistic = prevList
                .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
                .filter((r) => r.count > 0);
        } else {
            const same = prevList.find((r) => r.emoji === emoji);
            optimistic = same
                ? prevList.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
                : [...prevList, { emoji, count: 1, mine: true }];
        }
        apply(optimistic);
        reactMessage(chatId, msg.id, emoji).then(apply).catch(() => apply(prevList));
    }, [selectedChatId, applyMessages]);

    // долгое нажатие на сообщении (мобильные) — то же меню, что и по ПКМ
    const handleMessageLongPress = React.useCallback((pos: { x: number; y: number }, m: Message) => {
        setContextMenu({ message: m, x: pos.x, y: pos.y });
    }, []);

    // переход к закреплённому сообщению с короткой подсветкой
    const highlightIdRef = React.useRef<string | null>(null);
    const handleJumpToPinned = (id: string) => {
        const el = document.getElementById(`msg-${id}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightIdRef.current = id;
        el.classList.add('msg-highlight');
        window.setTimeout(() => {
            el.classList.remove('msg-highlight');
            highlightIdRef.current = null;
        }, 1600);
    };

    if (!selectedChatId) {
        return (
            <div className="flex-1 h-dvh flex items-center justify-center bg-[#0e1621] relative overflow-hidden">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(88,101,242,0.10), transparent)',
                    }}
                />
                <EmptyChat />
            </div>
        );
    }

    return (
        <div className="flex-1 h-dvh flex bg-[#0e1621] relative overflow-hidden">
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(88,101,242,0.07), transparent)',
                }}
            />
            {/* Основная колонка чата */}
            <div className="flex flex-col flex-1 min-w-0 relative">
            <ChatHeader
                chatName={chatName}
                onBack={onBack}
                status={partnerStatus ? {
                    online: partnerStatus.online,
                    text: partnerStatus.online ? 'онлайн' : formatLastSeen(partnerStatus.lastSeenAt)
                } : null}
                partnerTyping={partnerTyping}
                onOpenPartnerProfile={() => setIsPartnerProfileOpen(true)}
                onToggleInfo={toggleInfo}
                partnerAvatar={partnerStatus?.avatar || null}
                infoOpen={infoOpen}
            />
            {/* Плашка закреплённого сообщения */}
            <PinnedBar
                pinned={pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null}
                onJump={handleJumpToPinned}
                onUnpin={handleUnpinFromBar}
            />
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 relative overscroll-contain"
            >
                {loading && messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <span className="w-7 h-7 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-[#8f9aa7]">
                            <p className="text-sm">Это начало вашей переписки с <span className="text-white">{chatName}</span></p>
                            <p className="text-xs mt-1 text-[#5d6b7b]">Отправьте первое сообщение!</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {loadingOlder && (
                            <div className="flex justify-center py-2">
                                <span className="w-5 h-5 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                        <div className="w-full">
                            {messages.map((msg, i) => {
                                const prev = messages[i - 1];
                                const showAvatar = !prev || prev.sender !== msg.sender;
                                return (
                                    <div key={msg.id} id={`msg-${msg.id}`} className="scroll-mt-20">
                                        <MessageBubble
                                            message={msg}
                                            showAvatar={showAvatar}
                                            chatName={chatName}
                                            partnerAvatar={partnerStatus?.avatar || null}
                                            onContextMenu={(e, m) => { e.preventDefault(); setContextMenu({ message: m, x: e.clientX, y: e.clientY }); }}
                                            onLongPress={handleMessageLongPress}
                                            onOpenForwardedAuthor={handleOpenForwardedAuthor}
                                            onOpenImage={setLightboxUrl}
                                            onToggleReaction={handleToggleReaction}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>
            {/* Кнопка «вниз» — видна, когда чат прокручен вверх */}
            <button
                onClick={() => scrollToBottom('smooth')}
                className={`absolute right-4 bottom-[86px] z-10 w-10 h-10 rounded-full bg-[#222d3d]/90 border border-white/10 text-white flex items-center justify-center shadow-lg transition-all hover:bg-[#2b3646] ${
                    atBottom ? 'opacity-0 pointer-events-none translate-y-2' : 'opacity-100'
                }`}
                aria-label="Прокрутить вниз"
                title="Прокрутить вниз"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                </svg>
            </button>
                <MessageInput
                    value={message}
                    onChange={handleMessageInput}
                    onSend={handleSend}
                    onAttachFile={handleAttachFile}
                    isSendingAttachment={isSendingAttachment}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    onRecordingChange={handleRecordingChange}
                />
            </div>

            {/* Панель информации о чате: на десктопе — часть layout (сжимает чат), на мобильных — снизу вверх «шторкой» */}
            {isMobile ? (
                <>
                    <div
                        className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 transition-opacity duration-200 ${
                            infoOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                        onClick={toggleInfo}
                    />
                    <div
                        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl overflow-hidden bg-[#17212b] border-t border-white/10 shadow-2xl shadow-black/60 transition-transform duration-200 ease-out ${
                            infoOpen ? 'translate-y-0' : 'translate-y-full'
                        }`}
                        style={{ maxHeight: '82dvh' }}
                    >
                        <div className="flex justify-center pt-2 pb-1 shrink-0" onClick={toggleInfo}>
                            <span className="w-10 h-1 rounded-full bg-white/20" />
                        </div>
                        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(82dvh - 20px)' }}>
                            <ChatInfoPanel
                                onClose={toggleInfo}
                                chatName={chatName}
                                partner={partnerStatus}
                                selectedChatId={selectedChatId}
                                onOpenImage={setLightboxUrl}
                                mediaVersion={messages.length}
                                embedded
                            />
                        </div>
                    </div>
                </>
            ) : (
                <aside
                    className="hidden md:flex h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
                    style={{ width: infoOpen ? 320 : 0 }}
                    aria-hidden={!infoOpen}
                >
                    <div className="w-[320px] h-full shrink-0 bg-[#17212b] border-l border-black/40 flex flex-col">
                        <ChatInfoPanel
                            onClose={toggleInfo}
                            chatName={chatName}
                            partner={partnerStatus}
                            selectedChatId={selectedChatId}
                            onOpenImage={setLightboxUrl}
                            mediaVersion={messages.length}
                        />
                    </div>
                </aside>
            )}

            <PartnerProfileModal
                open={isPartnerProfileOpen}
                onClose={() => setIsPartnerProfileOpen(false)}
                partner={partnerStatus}
                chatId={selectedChatId}
                onOpenImage={setLightboxUrl}
                mediaVersion={messages.length}
            />

            {contextMenu && (
                <MessageContextMenu
                    message={contextMenu.message}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onReply={(m) => setReplyTo(m)}
                    onForward={(m) => setForwardMessage(m)}
                    onDeletePrompt={(m) => setDeleteTarget(m)}
                    onTogglePin={handleTogglePin}
                    onReact={handleToggleReaction}
                />
            )}

            {/* Удаление сообщения: как и удаление чата — с выбором «для всех / только у меня» */}
            <DeleteConfirmModal
                open={!!deleteTarget}
                title="Удалить сообщение?"
                subtitle={
                    deleteTarget
                        ? deleteTarget.type === 'text' || !deleteTarget.type
                            ? deleteTarget.text
                            : humanizeType(deleteTarget.type)
                        : undefined
                }
                onClose={() => setDeleteTarget(null)}
                onDelete={(mode) => {
                    if (deleteTarget) handleDeleteMessage(deleteTarget, mode);
                    setDeleteTarget(null);
                }}
            />

            <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

            <ForwardDialog
                message={forwardMessage}
                onClose={() => setForwardMessage(null)}
                onDone={() => { setForwardMessage(null); onSendMessage?.('forwarded'); }}
            />
        </div>
    );
};

export default ChatArea;
