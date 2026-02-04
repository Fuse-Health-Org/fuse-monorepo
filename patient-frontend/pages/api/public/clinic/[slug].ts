import type { NextApiRequest, NextApiResponse } from 'next'
import { applyRateLimit, rateLimitPresets } from '../../../../lib/rateLimiter'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Apply rate limiting for public endpoints
    try {
        await applyRateLimit(req, res, rateLimitPresets.public);
    } catch {
        return; // Rate limit response already sent
    }

    try {
        const { slug } = req.query

        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({ success: false, message: 'Clinic slug is required' })
        }

        const url = `${API_BASE}/clinic/by-slug/${encodeURIComponent(slug)}`

        const response = await fetch(url)
        const data = await response.json()

        res.status(response.status).json(data)
    } catch (error) {
        console.error('Proxy error /api/public/clinic/[slug]:', error)
        res.status(500).json({ success: false, message: 'Internal proxy error' })
    }
}

