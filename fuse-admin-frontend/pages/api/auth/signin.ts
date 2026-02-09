import type { NextApiRequest, NextApiResponse } from 'next'
import { applyRateLimit, rateLimitPresets } from '../../../lib/rateLimiter'

// Mock user database - in production, this would be a real database
const MOCK_USERS = [
  {
    id: '1',
    email: 'admin@demo.com',
    password: 'demo123', // In production, this would be hashed
    name: 'Demo Admin',
    role: 'admin',
    clinicId: 'demo-clinic-id'
  },
  {
    id: '2',
    email: 'admin@example.com',
    password: 'password123',
    name: 'Admin User',
    role: 'admin',
    clinicId: 'example-clinic-id'
  }
]

// Mock JWT token generation - in production, use a proper JWT library
function generateMockToken(userId: string): string {
  const payload = {
    userId,
    timestamp: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply rate limiting for auth endpoints (5 attempts per 15 minutes)
  try {
    await applyRateLimit(req, res, rateLimitPresets.auth);
  } catch {
    return; // Rate limit response already sent
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  const { email, password } = req.body

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required' 
    })
  }

  // Find user
  const user = MOCK_USERS.find(u => u.email === email && u.password === password)

  if (!user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid email or password' 
    })
  }

  // Generate token
  const token = generateMockToken(user.id)

  // Return user data (without password) and token
  const { password: _, ...userWithoutPassword } = user

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: userWithoutPassword
    }
  })
}