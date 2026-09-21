import * as React from 'react';

interface UserSearchProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isLoading?: boolean;
}

const UserSearch: React.FC<UserSearchProps> = ({
                                                   searchQuery,
                                                   setSearchQuery,
                                                   isLoading = false
                                               }) => {
    return (
        <div className="px-3 pb-3 pt-1 shrink-0">
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-9 py-2 bg-[#0e1621] text-white text-sm rounded-full
                     focus:outline-none focus:ring-2 focus:ring-[#5865F2]/60
                     border border-white/5 focus:border-transparent placeholder-[#5d6b7b] transition-all"
                    placeholder="Поиск людей и чатов"
                    disabled={isLoading}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5d6b7b]">
                    {isLoading ? (
                        <div className="w-4.5 h-4.5 w-[18px] h-[18px] border-2 border-[#5d6b7b] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    )}
                </div>
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5d6b7b] hover:text-white transition-colors"
                        aria-label="Очистить поиск"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default UserSearch;