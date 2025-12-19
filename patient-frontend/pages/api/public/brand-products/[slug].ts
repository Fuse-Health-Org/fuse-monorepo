import type { NextApiRequest, NextApiResponse } from 'next'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getNormalizedHost(req: NextApiRequest): string | null {
    const rawOriginalHost = Array.isArray((req.headers as any)['x-original-host']) ? (req.headers as any)['x-original-host'][0] : ((req.headers as any)['x-original-host'] as string | undefined)
    const rawXForwardedHost = Array.isArray(req.headers['x-forwarded-host']) ? req.headers['x-forwarded-host'][0] : (req.headers['x-forwarded-host'] as string | undefined)
    const rawHostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host
    const candidate = (rawOriginalHost || rawXForwardedHost || rawHostHeader || '').toString()
    if (!candidate) return null
    const first = candidate.split(',')[0].trim().toLowerCase()
    const noPort = first.split(':')[0]
    return noPort.startsWith('www.') ? noPort.slice(4) : noPort
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { slug, variant } = req.query
        const hostname = getNormalizedHost(req)
        const debugHeaders = {
            xOriginalHost: (req.headers as any)['x-original-host'],
            xForwardedHost: req.headers['x-forwarded-host'],
            host: req.headers.host,
        }
        console.log('[brand-products] inputs', { slug, hostname, API_BASE, debugHeaders })

        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({ success: false, message: 'Product slug is required' })
        }

        if (!hostname || typeof hostname !== 'string') {
            return res.status(400).json({ success: false, message: 'Clinic hostname not provided' })
        }

        // First: try to resolve via custom domain (only when not a platform subdomain)
        let clinicSlug: string | null = null
        if (!hostname.endsWith('.fuse.health') && !hostname.endsWith('.fusehealth.com') && !hostname.endsWith('.fusehealthstaging.xyz') && !hostname.includes('.localhost')) {
            try {
                const customDomainResponse = await fetch(`${API_BASE}/clinic/by-custom-domain`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain: hostname })
                })
                if (!customDomainResponse.ok) {
                    const text = await customDomainResponse.text().catch(() => '')
                    console.log('[brand-products] custom-domain lookup failed', { status: customDomainResponse.status, text })
                } else {
                    const customDomainData = await customDomainResponse.json()
                    if (customDomainData.success && customDomainData.slug) {
                        clinicSlug = customDomainData.slug
                        console.log(`✅ Found clinic via custom domain: ${clinicSlug}`)
                    }
                }
            } catch (error) {
                console.error('Error fetching clinic by custom domain:', error)
            }
        }

        // Fallback: parse subdomain formats
        if (!clinicSlug) {
            if (process.env.NODE_ENV === 'production' && hostname.endsWith('.fusehealth.com')) {
                const beforeDomain = hostname.replace('.fusehealth.com', '')
                const subdomainParts = beforeDomain.split('.')
                
                if (subdomainParts.length >= 2) {
                    // Affiliate subdomain: validate relationship
                    const affiliateSlug = subdomainParts[0]
                    const brandSlug = subdomainParts[subdomainParts.length - 1]
                    
                    try {
                        const validateResponse = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliateSlug, brandSlug }),
                        })
                        const validateData = await validateResponse.json()
                        
                        if (validateResponse.ok && validateData.success) {
                            clinicSlug = validateData.data.brandClinic.slug
                            console.log('[brand-products] ✅ Affiliate validated (prod fusehealth.com):', { affiliateSlug, brandSlug: clinicSlug })
                        } else {
                            console.error('[brand-products] ❌ Affiliate validation failed (prod fusehealth.com):', validateData.message)
                            return res.status(403).json({ success: false, message: 'Invalid affiliate access' })
                        }
                    } catch (error) {
                        console.error('[brand-products] ❌ Error validating affiliate (prod fusehealth.com):', error)
                        return res.status(500).json({ success: false, message: 'Failed to validate affiliate' })
                    }
                } else {
                    clinicSlug = beforeDomain
                }
            } else if (process.env.NODE_ENV === 'production' && hostname.endsWith('.fuse.health')) {
                const beforeDomain = hostname.replace('.fuse.health', '')
                const subdomainParts = beforeDomain.split('.')
                
                if (subdomainParts.length >= 2) {
                    // Affiliate subdomain: validate relationship
                    const affiliateSlug = subdomainParts[0]
                    const brandSlug = subdomainParts[subdomainParts.length - 1]
                    
                    try {
                        const validateResponse = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliateSlug, brandSlug }),
                        })
                        const validateData = await validateResponse.json()
                        
                        if (validateResponse.ok && validateData.success) {
                            clinicSlug = validateData.data.brandClinic.slug
                            console.log('[brand-products] ✅ Affiliate validated (prod fuse.health):', { affiliateSlug, brandSlug: clinicSlug })
                        } else {
                            console.error('[brand-products] ❌ Affiliate validation failed (prod fuse.health):', validateData.message)
                            return res.status(403).json({ success: false, message: 'Invalid affiliate access' })
                        }
                    } catch (error) {
                        console.error('[brand-products] ❌ Error validating affiliate (prod fuse.health):', error)
                        return res.status(500).json({ success: false, message: 'Failed to validate affiliate' })
                    }
                } else {
                    clinicSlug = beforeDomain
                }
            } else if (process.env.NODE_ENV === 'production' && hostname.endsWith('.fusehealthstaging.xyz')) {
                const beforeDomain = hostname.replace('.fusehealthstaging.xyz', '')
                const subdomainParts = beforeDomain.split('.')
                
                if (subdomainParts.length >= 2) {
                    // Affiliate subdomain: validate relationship
                    const affiliateSlug = subdomainParts[0]
                    const brandSlug = subdomainParts[subdomainParts.length - 1]
                    
                    try {
                        const validateResponse = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliateSlug, brandSlug }),
                        })
                        const validateData = await validateResponse.json()
                        
                        if (validateResponse.ok && validateData.success) {
                            clinicSlug = validateData.data.brandClinic.slug
                            console.log('[brand-products] ✅ Affiliate validated (staging):', { affiliateSlug, brandSlug: clinicSlug })
                        } else {
                            console.error('[brand-products] ❌ Affiliate validation failed (staging):', validateData.message)
                            return res.status(403).json({ success: false, message: 'Invalid affiliate access' })
                        }
                    } catch (error) {
                        console.error('[brand-products] ❌ Error validating affiliate (staging):', error)
                        return res.status(500).json({ success: false, message: 'Failed to validate affiliate' })
                    }
                } else {
                    clinicSlug = beforeDomain
                }
            } else if (process.env.NODE_ENV !== 'production' && hostname.includes('.localhost')) {
                const beforeLocalhost = hostname.split('.localhost')[0]
                const subdomainParts = beforeLocalhost.split('.')
                
                if (subdomainParts.length >= 2) {
                    // Affiliate subdomain: validate relationship
                    const affiliateSlug = subdomainParts[0]
                    const brandSlug = subdomainParts[subdomainParts.length - 1]
                    
                    console.log('[brand-products] localhost subdomain parsing (affiliate):', { 
                        hostname, 
                        beforeLocalhost, 
                        subdomainParts, 
                        affiliateSlug,
                        brandSlug
                    })
                    
                    try {
                        const validateResponse = await fetch(`${API_BASE}/public/affiliate/validate-access`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ affiliateSlug, brandSlug }),
                        })
                        const validateData = await validateResponse.json()
                        
                        if (validateResponse.ok && validateData.success) {
                            clinicSlug = validateData.data.brandClinic.slug
                            console.log('[brand-products] ✅ Affiliate validated (localhost):', { affiliateSlug, brandSlug: clinicSlug })
                        } else {
                            console.error('[brand-products] ❌ Affiliate validation failed (localhost):', validateData.message)
                            return res.status(403).json({ success: false, message: 'Invalid affiliate access' })
                        }
                    } catch (error) {
                        console.error('[brand-products] ❌ Error validating affiliate (localhost):', error)
                        return res.status(500).json({ success: false, message: 'Failed to validate affiliate' })
                    }
                } else {
                    // Regular clinic
                    clinicSlug = beforeLocalhost
                    console.log('[brand-products] localhost subdomain parsing (regular):', { 
                        hostname, 
                        beforeLocalhost, 
                        clinicSlug
                    })
                }
            }
            console.log('[brand-products] derived clinicSlug from host fallback', { hostname, clinicSlug })
        }

        if (!clinicSlug) {
            return res.status(400).json({ success: false, message: 'Unable to determine clinic from hostname' })
        }

        const variantQuery = typeof variant === 'string' ? `?variant=${encodeURIComponent(variant)}` : ''
        const url = `${API_BASE}/public/brand-products/${encodeURIComponent(clinicSlug)}/${encodeURIComponent(slug)}${variantQuery}`
        console.log('[brand-products] fetching backend', { url })

        const response = await fetch(url)
        const raw = await response.text()
        let data: any
        try { data = JSON.parse(raw) } catch { data = raw }
        if (!response.ok) {
            console.log('[brand-products] backend non-OK', { status: response.status, data })
        }

        res.status(response.status).json(data)
    } catch (error) {
        console.error('Proxy error /api/public/brand-products/[slug]:', error)
        res.status(500).json({ success: false, message: 'Internal proxy error' })
    }
}


