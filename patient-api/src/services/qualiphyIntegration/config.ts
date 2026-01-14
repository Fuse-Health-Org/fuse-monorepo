interface QualiphyConfig {
    baseUrl: string;
    apiKey: string;
}

const baseUrl = process.env.QUALIPHY_BASE_URL || 'https://internal.qualiphy.me/api';

const apiKey = process.env.QUALIPHY_API_KEY || '';

export const qualiphyConfig: QualiphyConfig = {
    baseUrl,
    apiKey,
};

export function resolveQualiphyBaseUrl(path: string): string {
    const cleanBase = qualiphyConfig.baseUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
}
