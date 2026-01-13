import Product, { PharmacyProvider } from "../models/Product";
import FormSectionTemplate from "../models/FormSectionTemplate";
import { Op } from "sequelize";
import {
  getProductWithQuestionnaires,
  listProductsByClinic,
} from "./db/product";
import { getUser } from "./db/user";
import type { ProductCreateInput, ProductUpdateInput } from "@fuse/validators";
import User from "../models/User";
import Clinic from "../models/Clinic";

/**

Helper function to serialize product data, converting DECIMAL fields from strings to numbers
*/
type SerializedProduct = ReturnType<Product["toJSON"]> & {
  categories: string[];
  category: string | null;
  pharmacyWholesaleCost?: number;
  suggestedRetailPrice?: number;
  price: number;
  brandName?: string;
};

function serializeProduct(product: Product): SerializedProduct {
  const plain = product.toJSON();
  const categories = Array.isArray((plain as any).categories)
    ? ((plain as any).categories as string[]).filter(Boolean)
    : [];

  // Extract brand name from the clinic if available
  const brandData = (plain as any).brand;
  const brandName = brandData?.clinic?.name || null;

  return {
    ...plain,
    categories,
    category: categories[0] ?? null,
    pharmacyWholesaleCost: plain.pharmacyWholesaleCost
      ? parseFloat(plain.pharmacyWholesaleCost as any)
      : undefined,
    suggestedRetailPrice: plain.suggestedRetailPrice
      ? parseFloat(plain.suggestedRetailPrice as any)
      : undefined,
    price: plain.price ? parseFloat(plain.price as any) : plain.price,
    brandName,
  };
}

class ProductService {
  async listProducts(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      category?: string | string[];
      isActive?: boolean;
      pharmacyProvider?: string;
    } = {}
  ) {
    const {
      page = 1,
      limit = 50,
      category,
      isActive,
      pharmacyProvider,
    } = options;
    const offset = (page - 1) * limit;

    // Get user to check if they're a brand user
    const user = await getUser(userId);

    const where: any = {};

    // If user is a brand, only show their own custom products and standard products (null brandId)
    if (user?.hasRoleSync("brand")) {
      where[Op.or] = [
        { brandId: userId }, // Their own custom products
        { brandId: null }, // Standard platform products
      ];
    }

    if (category) {
      const categoriesFilter = Array.isArray(category)
        ? category
        : String(category)
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);
      if (categoriesFilter.length > 0) {
        where.categories = {
          [Op.contains]: categoriesFilter,
        };
      }
    }

    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    }

    if (pharmacyProvider) {
      const providersFilter = String(pharmacyProvider)
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (providersFilter.length > 0) {
        where.pharmacyProvider = {
          [Op.in]: providersFilter,
        };
      }
    }

    const { rows: products, count: total } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
      include: [
        {
          model: User,
          as: "brand",
          required: false,
          attributes: ["id", "firstName", "lastName", "clinicId"],
          include: [
            {
              model: Clinic,
              as: "clinic",
              required: false,
              attributes: ["id", "name"],
            },
          ],
        },
      ],
    });

    return {
      success: true,
      message: `Retrieved ${products.length} products`,
      data: {
        products: products.map(serializeProduct),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  async getProduct(productId: string, userId: string) {
    const product = await getProductWithQuestionnaires(productId);

    if (!product) {
      return {
        success: false,
        message: "Product not found",
      };
    }

    return {
      success: true,
      data: serializeProduct(product),
    };
  }

  async createProduct(input: ProductCreateInput, userId: string) {
    try {
      // Get user and validate they have permission
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User with the provided ID does not exist",
        };
      }

      // Allow admins, doctors, and brand users to update product fields (e.g., isActive)
      if (!user.hasAnyRoleSync(["admin", "doctor", "brand"])) {
        const roles = user.userRoles?.getActiveRoles() || [user.role]; // Fallback for deprecated role
        return {
          success: false,
          message: "Access denied",
          error: `Only admin, doctor, or brand users can update products. Your roles: ${roles.join(", ")}`,
        };
      }

      // Create the product (validation is handled by Zod schema at endpoint layer)
      const {
        category: legacyCategory,
        categories: incomingCategories,
        ...restInput
      } = input as any;

      const categories = Array.isArray(incomingCategories)
        ? incomingCategories.filter(Boolean)
        : legacyCategory
          ? [legacyCategory].filter(Boolean)
          : [];

      // Only set brandId if explicitly provided in the input
      // Don't automatically assign based on user role - let the caller decide
      const product = await Product.create({
        ...restInput,
        categories,
        isActive: input.isActive ?? true,
        brandId: (restInput as any).brandId || null,
      });

      // If there are requiredDoctorQuestions, create a FormSectionTemplate
      if (
        input.requiredDoctorQuestions &&
        input.requiredDoctorQuestions.length > 0
      ) {
        await FormSectionTemplate.create({
          name: `${input.name} - Doctor Questions`,
          description: `Mandatory medical questions for ${input.name}`,
          sectionType: "doctor",
          category: categories[0] ?? null,
          treatmentId: null, // Will be linked when product is associated with treatment
          schema: {
            questions: input.requiredDoctorQuestions,
          },
          version: 1,
          isActive: true,
        } as any);
      }

      return {
        success: true,
        message: "Product created successfully",
        data: serializeProduct(product),
      };
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error creating product:", error);
      } else {
        console.error("❌ Error creating product");
      }

      // Handle Sequelize unique constraint violations
      if (error.name === "SequelizeUniqueConstraintError") {
        const field = error.errors?.[0]?.path || "field";
        const value = error.errors?.[0]?.value || "";
        return {
          success: false,
          message: `A product with this ${field} already exists: ${value}`,
        };
      }

      // Handle Sequelize validation errors
      if (error.name === "SequelizeValidationError") {
        const errors =
          error.errors?.map((e: any) => e.message).join("; ") ||
          "Validation failed";
        return {
          success: false,
          message: errors,
        };
      }

      return {
        success: false,
        message: "Failed to create product",
      };
    }
  }

  async updateProduct(input: ProductUpdateInput, userId: string) {
    try {
      // Get user and validate they have permission
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User with the provided ID does not exist",
        };
      }

      // Allow admins, doctors, and brand users to update product fields
      if (!user.hasAnyRoleSync(["admin", "doctor", "brand"])) {
        const roles = user.userRoles?.getActiveRoles() || [user.role]; // Fallback for deprecated role
        return {
          success: false,
          message: "Access denied",
          error: `Only admin, doctor, or brand users can update products. Your roles: ${roles.join(", ")}`,
        };
      }

      const product = await Product.findByPk(input.id);

      if (!product) {
        return {
          success: false,
          message: "Product not found",
        };
      }

      // Update the product
      const {
        category: legacyCategory,
        categories: incomingCategories,
        ...restInput
      } = input as any;

      const categories = Array.isArray(incomingCategories)
        ? incomingCategories.filter(Boolean)
        : legacyCategory
          ? [legacyCategory].filter(Boolean)
          : undefined;

      const updatePayload: any = {
        ...restInput,
      };

      if (categories !== undefined) {
        updatePayload.categories = categories;
      }

      await product.update(updatePayload);

      // If requiredDoctorQuestions were updated, update or create FormSectionTemplate
      if (input.requiredDoctorQuestions) {
        const primaryCategory = Array.isArray(product.categories)
          ? product.categories[0]
          : categories && categories.length > 0
            ? categories[0]
            : null;
        const existingTemplate = await FormSectionTemplate.findOne({
          where: {
            sectionType: "doctor",
            category: primaryCategory,
          },
          order: [["version", "DESC"]],
        });

        if (existingTemplate) {
          // Create a new version
          await FormSectionTemplate.create({
            name: existingTemplate.name,
            description: existingTemplate.description,
            sectionType: "doctor",
            category: primaryCategory,
            treatmentId: null,
            schema: {
              questions: input.requiredDoctorQuestions,
            },
            version: existingTemplate.version + 1,
            isActive: true,
          } as any);
        } else {
          // Create first version
          await FormSectionTemplate.create({
            name: `${product.name} - Doctor Questions`,
            description: `Mandatory medical questions for ${product.name}`,
            sectionType: "doctor",
            category: primaryCategory,
            treatmentId: null,
            schema: {
              questions: input.requiredDoctorQuestions,
            },
            version: 1,
            isActive: true,
          } as any);
        }
      }

      return {
        success: true,
        message: "Product updated successfully",
        data: serializeProduct(product),
      };
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error updating product:", error);
      } else {
        console.error("❌ Error updating product");
      }

      // Handle Sequelize unique constraint violations
      if (error.name === "SequelizeUniqueConstraintError") {
        const field = error.errors?.[0]?.path || "field";
        const value = error.errors?.[0]?.value || "";
        return {
          success: false,
          message: `A product with this ${field} already exists: ${value}`,
        };
      }

      // Handle Sequelize validation errors
      if (error.name === "SequelizeValidationError") {
        const errors =
          error.errors?.map((e: any) => e.message).join("; ") ||
          "Validation failed";
        return {
          success: false,
          message: errors,
        };
      }

      return {
        success: false,
        message: "Failed to update product",
      };
    }
  }

  async deleteProduct(productId: string, userId: string, options: { isTenantAdmin?: boolean } = {}) {
    try {
      const product = await Product.findByPk(productId);

      if (!product) {
        return {
          success: false,
          message: "Product not found",
        };
      }

      // Get user to verify permissions
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // If request comes from tenant-admin portal and user has admin/superAdmin role, allow full access
      const isTenantAdminWithPrivileges = options.isTenantAdmin && user.hasAnyRoleSync(["admin", "superAdmin"]);
      
      if (!isTenantAdminWithPrivileges) {
        // Apply normal brand restrictions
        if (user.hasRoleSync("brand")) {
          // Brand users can delete:
          // 1. Their own custom products (product.brandId === userId)
          // 2. Auto-imported products (product.isAutoImported === true OR name starts with [Auto-Imported])
          const isAutoImported = product.isAutoImported || product.name?.startsWith('[Auto-Imported]');
          const canDelete = product.brandId === userId || isAutoImported;
          
          if (!canDelete) {
            return {
              success: false,
              message: "You can only delete products that you created or auto-imported products",
            };
          }
        } else if (!user.hasAnyRoleSync(["admin", "superAdmin"])) {
          return {
            success: false,
            message:
              "Only brand users can delete their own products, or admins can delete any product",
          };
        }
      }

      // Hard delete the product since it's a custom brand product
      await product.destroy();

      return {
        success: true,
        message: "Product deleted successfully",
      };
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error deleting product:", error);
      } else {
        console.error("❌ Error deleting product");
      }
      return {
        success: false,
        message: "Failed to delete product",
      };
    }
  }

  async listCategories(userId: string) {
    const [results] = await Product.sequelize!.query(
      'SELECT DISTINCT unnest("categories") AS category FROM "Product" WHERE "categories" IS NOT NULL'
    );

    const categories = Array.isArray(results)
      ? (results as Array<{ category: string | null }>)
          .map((row) => row.category)
          .filter((category): category is string => Boolean(category))
          .sort((a, b) => a.localeCompare(b))
      : [];

    return {
      success: true,
      data: categories,
    };
  }

  async listPharmacyVendors(userId: string) {
    // Return available pharmacy vendors from config
    const vendors = [
      {
        id: PharmacyProvider.ABSOLUTERX,
        name: "AbsoluteRx",
        baseUrl: "https://portal.absoluterx.com",
        description: "Primary fulfillment partner for compounded medications",
      },
      {
        id: PharmacyProvider.PILLPACK,
        name: "Pharmacy A",
        baseUrl: "https://api.pharmacya.com",
        description: "Alternative pharmacy vendor",
      },
      {
        id: PharmacyProvider.TRUEPILL,
        name: "Pharmacy B",
        baseUrl: "https://api.pharmacyb.com",
        description: "Specialty pharmacy for specific medications",
      },
    ];

    return {
      success: true,
      data: vendors,
    };
  }
  /**
   * Gets products by clinic ID
   */
  async getProductsByClinic(clinicId: string, userId: string) {
    try {
      // Get user and validate permissions
      const user = await getUser(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
          error: "User with the provided ID does not exist",
        };
      }

      // Only allow doctors and brand users
      if (!user.hasAnyRoleSync(["doctor", "brand"])) {
        const roles = user.userRoles?.getActiveRoles() || [user.role]; // Fallback for deprecated role
        return {
          success: false,
          message: "Access denied",
          error: `Only doctors and brand users can access products. Your roles: ${roles.join(", ")}`,
        };
      }

      // Verify user has access to this clinic
      if (user.clinicId !== clinicId) {
        return {
          success: false,
          message: "Access denied",
          error: "You can only access products for your own clinic",
        };
      }

      const userRoles = user.userRoles?.getActiveRoles() || [user.role]; // Fallback for deprecated role
      if (process.env.NODE_ENV === "development") {
        console.log(
          `🛍️ Fetching products for clinic: ${clinicId}, user roles: ${userRoles.join(", ")}, user clinicId: ${user.clinicId}`
        );
      }

      const result = await listProductsByClinic(clinicId);

      return {
        success: true,
        message: `Successfully retrieved ${result.length} products`,
        items: result,
      };
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Error fetching products by clinic:", error);
      } else {
        console.error("❌ Error fetching products by clinic");
      }
      return {
        success: false,
        message: "Failed to fetch products",
        error: "Unknown error",
      };
    }
  }
}

export default ProductService;
