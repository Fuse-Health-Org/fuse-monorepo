import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { paymentMethodId, brandSubscriptionPlanId, brandSubscriptionId } = req.body
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ message: 'No authorization token provided' })
    }

    if (!paymentMethodId || !brandSubscriptionPlanId || !brandSubscriptionId) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/brand-subscriptions/activate-schedule`

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        paymentMethodId,
        brandSubscriptionPlanId,
        brandSubscriptionId,
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      res.status(200).json({
        success: true,
        subscriptionId: data.subscriptionId,
        scheduleId: data.scheduleId,
      })
    } else {
      res.status(response.status).json({ message: data.message || 'Failed to activate subscription schedule' })
    }
  } catch (error) {
    console.error('Activate Schedule API error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

