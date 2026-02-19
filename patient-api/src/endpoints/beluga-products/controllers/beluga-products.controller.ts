import { Request, Response } from "express";
import { getCurrentUser } from "@/config/jwt";
import BelugaProduct from "@/models/BelugaProduct";

/**
 * List all Beluga products.
 */
export const listBelugaProducts = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const products = await BelugaProduct.findAll({
      order: [["name", "ASC"]],
    });

    return res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error("❌ Error listing Beluga products:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list Beluga products",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get a single Beluga product by ID.
 */
export const getBelugaProduct = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;

    const product = await BelugaProduct.findByPk(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Beluga product not found" });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    console.error("❌ Error fetching Beluga product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Beluga product",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create a new Beluga product.
 */
export const createBelugaProduct = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { name, strength, quantity, refills, daysSupply, medId } = req.body;

    if (!name || !strength) {
      return res.status(400).json({
        success: false,
        message: "name and strength are required",
      });
    }

    const product = await BelugaProduct.create({
      name,
      strength,
      quantity: quantity || "1",
      refills: refills || "0",
      daysSupply: daysSupply || null,
      medId: medId || null,
    });

    console.log(`✅ Beluga product created: ${product.name} (medId: ${product.medId || 'pending'})`);

    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error("❌ Error creating Beluga product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Beluga product",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Update an existing Beluga product.
 */
export const updateBelugaProduct = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;
    const { name, strength, quantity, refills, daysSupply, medId } = req.body;

    const product = await BelugaProduct.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Beluga product not found" });
    }

    await product.update({
      ...(name !== undefined && { name }),
      ...(strength !== undefined && { strength }),
      ...(quantity !== undefined && { quantity }),
      ...(refills !== undefined && { refills }),
      ...(daysSupply !== undefined && { daysSupply }),
      ...(medId !== undefined && { medId: medId || null }),
    });

    console.log(`✅ Beluga product updated: ${product.name} (${product.id})`);

    return res.json({ success: true, data: product });
  } catch (error) {
    console.error("❌ Error updating Beluga product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Beluga product",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete (soft-delete) a Beluga product.
 */
export const deleteBelugaProduct = async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { id } = req.params;

    const product = await BelugaProduct.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Beluga product not found" });
    }

    await product.destroy();

    console.log(`🗑️ Beluga product deleted: ${product.name} (${product.id})`);

    return res.json({ success: true, message: "Beluga product deleted" });
  } catch (error) {
    console.error("❌ Error deleting Beluga product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete Beluga product",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
