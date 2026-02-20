import { NextApiRequest, NextApiResponse } from 'next'

// @deprecated This can be removed
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' })
    }

    try {
        const { paymentMethodId, planType, planCategory, downpaymentPlanType, amount, currency } = req.body
        const token = req.headers.authorization?.replace('Bearer ', '')

        if (!token) {
            return res.status(401).json({ message: 'No authorization token provided' })
        }

        const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/confirm-payment-intent`

        // Forward to backend API
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                paymentMethodId,
                planType,
                amount,
                planCategory,
                downpaymentPlanType,
                currency: currency || 'usd'
            })
        })

        const data = await response.json()

        if (response.ok && data.success) {
            res.status(200).json({
                clientSecret: data.clientSecret,
                requiresAction: data.requiresAction,
                subscription: data.subscription,
                subscriptionId: data.subscriptionId
            })
        } else {
            console.error('❌ Confirm payment backend error')
            res.status(response.status).json({ message: data.message || 'Failed to confirm payment' })
        }
    } catch (error) {
        console.error('❌ Confirm payment API error')
        res.status(500).json({ message: 'Internal server error' })
    }
}
