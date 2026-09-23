// Реакции к сообщениям: набор эмодзи из пакета Twemoji (SVG-файлы в /public/emoji)
export interface MessageReaction {
    emoji: string;
    count: number;
    mine: boolean;
}

export const REACTION_EMOJIS = ['👍', '👎', '❤️', '🔥', '🥳', '😂', '😮', '😭'] as const;

// unicode -> имя svg-файла из пакета twemoji
const EMOJI_CODE: Record<string, string> = {
    '👍': '1f44d',
    '👎': '1f44e',
    '❤️': '2764',
    '🔥': '1f525',
    '🥳': '1f973',
    '😂': '1f602',
    '😮': '1f62e',
    '😭': '1f62d',
};

export const isReactionEmoji = (emoji: string): boolean => !!EMOJI_CODE[emoji];

export const emojiUrl = (emoji: string): string => {
    const code = EMOJI_CODE[emoji];
    return code ? `/emoji/${code}.svg` : '';
};
