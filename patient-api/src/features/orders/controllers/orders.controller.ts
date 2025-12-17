import { Request, Response } from 'express';

// Placeholder controllers - will be implemented with logic from main.ts
export const createPaymentIntent = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

export const confirmPayment = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

export const listOrders = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

export const getOrder = async (req: Request, res: Response) => {
  res.status(501).json({ success: false, message: 'Not implemented yet' });
};

