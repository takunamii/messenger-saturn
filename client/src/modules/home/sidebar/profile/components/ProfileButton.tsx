import * as React from 'react';
import type { UserProfile } from '../api/types';
import { assetUrl } from '../../../../../utils/assetUrl';

interface ProfileButtonProps {
    onOpenModal: () => void;
    profile: UserProfile | null;
    className?: string;
    compact?: boolean;
}

const ProfileButton: React.FC<ProfileButtonProps> = ({
    onOpenModal,
    profile,
    className = '',
    compact = false,
}) => {
    const displayName = profile?.name || 'New User';
    const username = profile?.username ? `@${profile.username}` : '@username';
    const status = profile?.status;

    const avatar = assetUrl(profile?.avatar) ? (
        <img
            src={assetUrl(profile?.avatar)}
            alt={`${displayName}'s avatar`}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-[#5865F2] transition-all"
        />
    ) : (
        <div className="w-10 h-10 rounded-full bg-[#222d3d] flex items-center justify-center ring-2 ring-white/10 group-hover:ring-[#5865F2] transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#8f9aa7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        </div>
    );

    if (compact) {
        return (
            <button
                onClick={onOpenModal}
                className="relative mx-auto rounded-full focus:outline-none transition-transform active:scale-95 group block"
                title={displayName}
                aria-label="Open profile"
            >
                {avatar}
                {status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#17212b] bg-green-500" />
                )}
            </button>
        );
    }

    return (
        <div className={`p-3 ${className}`}>
            <button
                onClick={onOpenModal}
                className="w-full group flex items-center p-2.5 rounded-xl transition-all
                bg-transparent hover:bg-white/5
                focus:outline-none"
                aria-label="Open profile"
            >
                <div className="relative mr-3 shrink-0">
                    {avatar}
                    {status === 'online' && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#17212b] bg-green-500"></div>
                    )}
                </div>

                <div className="text-left overflow-hidden flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate selectable" title={displayName}>
                        {displayName}
                    </p>
                    <p className="text-xs text-[#8f9aa7] truncate selectable" title={username}>
                        {username}
                    </p>
                </div>

                <div className="ml-2 text-[#5d6b7b] group-hover:text-[#8ea1ff] transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            </button>
        </div>
    );
};

export default ProfileButton;
