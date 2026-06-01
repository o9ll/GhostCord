import { API_BASE } from "./OAuth2";

export async function getOwnPluginConfig(pluginName: string, token: string) {
    const response = await fetch(`${API_BASE}/api/sync/${encodeURIComponent(pluginName)}?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
        throw new Error('Failed to load plugin config');
    }
    return response.json();
}

export async function saveOwnPluginConfig(pluginName: string, token: string, settings: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/api/sync/${encodeURIComponent(pluginName)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, settings })
    });

    if (!response.ok) {
        throw new Error('Failed to save plugin config');
    }

    return response.json();
}

// In-memory cache for public profiles to prevent API spam
const publicProfileCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function getPublicPluginConfig(pluginName: string, userId: string) {
    const cacheKey = `${pluginName}_${userId}`;
    const cached = publicProfileCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    try {
        const response = await fetch(`${API_BASE}/api/sync/${encodeURIComponent(pluginName)}/public?userId=${encodeURIComponent(userId)}`);
        if (!response.ok) {
            publicProfileCache.set(cacheKey, { data: null, timestamp: Date.now() });
            return null;
        }
        
        const data = await response.json();
        publicProfileCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
    } catch (e) {
        console.error(`Failed to load public config for ${pluginName}/${userId}:`, e);
        return null;
    }
}

export function clearPublicProfileCache() {
    publicProfileCache.clear();
}
