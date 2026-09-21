// Р‘Р°Р·Р° API: РІ РїСЂРѕРґРµ Р·Р°РґР°С‘С‚СЃСЏ С‡РµСЂРµР· VITE_API_URL РїСЂРё СЃР±РѕСЂРєРµ РєР»РёРµРЅС‚Р°
export const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

// РђРІР°С‚Р°СЂС‹ РѕС‚РґР°СЋС‚СЃСЏ РєР°Рє /uploads/... (РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РїСѓС‚СЊ РѕС‚ API) вЂ” СЂРµР·РѕР»РІРёРј РґРѕ РїРѕР»РЅРѕРіРѕ URL
export function assetUrl(path?: string | null): string | undefined {
    if (!path) return undefined;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith('/uploads/')) return `${API_BASE}${path}`;
    return path;
}

