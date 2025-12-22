import { Express } from "express";
import Clinic from "../models/Clinic";
import Product from "../models/Product";
import TenantProduct from "../models/TenantProduct";
import PharmacyCoverage from "../models/PharmacyCoverage";
import Pharmacy from "../models/Pharmacy";
import Questionnaire from "../models/Questionnaire";
import TenantProductForm from "../models/TenantProductForm";
import User from "../models/User";
import AffiliateProductImage from "../models/AffiliateProductImage";

/**
 * Public endpoints that don't require authentication
 * These are accessible to anyone and are used by the landing pages
 */
export function registerPublicEndpoints(app: Express) {
    // Helper function to fetch products for a clinic
    const fetchProductsForClinic = async (clinicId: string) => {
        const tenantProducts = await TenantProduct.findAll({
            where: { clinicId },
            include: [{
                model: Product,
                as: "product",
                where: { isActive: true },
                required: true,
                attributes: ['id', 'name', 'description', 'imageUrl', 'categories', 'price', 'slug'],
            }],
            limit: 50,
            order: [['createdAt', 'DESC']]
        });

        // Check if this is an affiliate clinic
        const clinic = await Clinic.findByPk(clinicId);
        let affiliateUser: User | null = null;
        
        if (clinic?.affiliateOwnerClinicId) {
            // This is an affiliate clinic, find the affiliate user
            affiliateUser = await User.findOne({
                where: { clinicId: clinic.id }
            });
        }

        // If we have an affiliate user, get their custom images
        let customImages: AffiliateProductImage[] = [];
        if (affiliateUser) {
            customImages = await AffiliateProductImage.findAll({
                where: { affiliateId: affiliateUser.id }
            });
        }

        // Create a map of custom images by productId
        const customImageMap = new Map();
        customImages.forEach((img) => {
            customImageMap.set(img.productId, {
                customImageUrl: img.customImageUrl,
                useCustomImage: img.useCustomImage,
            });
        });

        // For each product, get the first TenantProductForm (the form ID used in URLs)
        const results = await Promise.all(tenantProducts.map(async (tp: any) => {
            // Get the first TenantProductForm for this product and clinic (sorted by createdAt ascending)
            const firstForm = await TenantProductForm.findOne({
                where: { productId: tp.product.id, clinicId },
                order: [['createdAt', 'ASC']],
                attributes: ['id'],
            });

            // Check if affiliate has custom image for this product
            const customImg = customImageMap.get(tp.product.id);
            let imageUrl = tp.product.imageUrl;
            
            // If affiliate has custom image and wants to use it, use that instead
            if (customImg?.useCustomImage && customImg?.customImageUrl) {
                imageUrl = customImg.customImageUrl;
            }

            return {
                id: tp.product.id,
                tenantProductId: tp.id, // TenantProduct ID - used for likes
                name: tp.product.name,
                description: tp.product.description,
                imageUrl: imageUrl,
                categories: tp.product.categories || [],
                price: tp.price || tp.product.price,
                wholesalePrice: tp.product.price,
                slug: tp.product.slug,
                formId: firstForm?.id || null, // TenantProductForm.id - used in URLs
            };
        }));

        return results;
    };

    // Public endpoint to get products for landing page (with clinic slug)
    app.get("/public/products/:clinicSlug", async (req, res) => {
        try {
            const { clinicSlug } = req.params;
            const { affiliateSlug } = req.query; // Check if there's an affiliate slug in query

            const clinic = await Clinic.findOne({
                where: { slug: clinicSlug }
            });

            if (!clinic) {
                return res.status(404).json({
                    success: false,
                    message: "Clinic not found"
                });
            }

            // Get products for this clinic
            const tenantProducts = await TenantProduct.findAll({
                where: { clinicId: clinic.id },
                include: [{
                    model: Product,
                    as: "product",
                    where: { isActive: true },
                    required: true,
                    attributes: ['id', 'name', 'description', 'imageUrl', 'categories', 'price', 'slug'],
                }],
                limit: 50,
                order: [['createdAt', 'DESC']]
            });

            // If there's an affiliate slug, get their custom images
            let customImages: AffiliateProductImage[] = [];
            if (affiliateSlug && typeof affiliateSlug === 'string') {
                // Find affiliate clinic by slug
                const affiliateClinic = await Clinic.findOne({
                    where: { slug: affiliateSlug }
                });

                if (affiliateClinic) {
                    // Find affiliate user
                    const affiliateUser = await User.findOne({
                        where: { clinicId: affiliateClinic.id }
                    });

                    if (affiliateUser) {
                        customImages = await AffiliateProductImage.findAll({
                            where: { affiliateId: affiliateUser.id }
                        });
                    }
                }
            }

            // Create a map of custom images by productId
            const customImageMap = new Map();
            customImages.forEach((img) => {
                customImageMap.set(img.productId, {
                    customImageUrl: img.customImageUrl,
                    useCustomImage: img.useCustomImage,
                });
            });

            // For each product, get the first TenantProductForm (the form ID used in URLs)
            const products = await Promise.all(tenantProducts.map(async (tp: any) => {
                const firstForm = await TenantProductForm.findOne({
                    where: { productId: tp.product.id, clinicId: clinic.id },
                    order: [['createdAt', 'ASC']],
                    attributes: ['id'],
                });

                // Check if affiliate has custom image for this product
                const customImg = customImageMap.get(tp.product.id);
                let imageUrl = tp.product.imageUrl;
                
                // If affiliate has custom image and wants to use it, use that instead
                if (customImg?.useCustomImage && customImg?.customImageUrl) {
                    imageUrl = customImg.customImageUrl;
                }

                return {
                    id: tp.product.id,
                    tenantProductId: tp.id,
                    name: tp.product.name,
                    description: tp.product.description,
                    imageUrl: imageUrl,
                    categories: tp.product.categories || [],
                    price: tp.price || tp.product.price,
                    wholesalePrice: tp.product.price,
                    slug: tp.product.slug,
                    formId: firstForm?.id || null,
                };
            }));

            res.status(200).json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error('Error fetching public products:', error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch products"
            });
        }
    });

    // Public endpoint to get products (without clinic slug - for localhost testing)
    app.get("/public/products", async (req, res) => {
        try {
            // For localhost testing: get any clinic
            const anyClinic = await Clinic.findOne();

            if (!anyClinic) {
                return res.status(404).json({
                    success: false,
                    message: "No clinic found"
                });
            }

            const products = await fetchProductsForClinic(anyClinic.id);

            res.status(200).json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error('Error fetching public products:', error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch products"
            });
        }
    });

    // Public endpoint to get ALL products (for all-products page)
    app.get("/public/all-products", async (req, res) => {
        try {
            const allProducts = await Product.findAll({
                where: { isActive: true },
                attributes: ['id', 'name', 'description', 'imageUrl', 'categories', 'price', 'slug', 'createdAt'],
                limit: 100,
                order: [['createdAt', 'DESC']]
            });

            // For each product, get the first TenantProductForm (if any exists)
            const products = await Promise.all(allProducts.map(async (product: any) => {
                const firstForm = await TenantProductForm.findOne({
                    where: { productId: product.id },
                    order: [['createdAt', 'ASC']],
                    attributes: ['id'],
                });

                return {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    imageUrl: product.imageUrl,
                    categories: product.categories || [],
                    price: product.price,
                    wholesalePrice: product.price,
                    slug: product.slug,
                    formId: firstForm?.id || null, // TenantProductForm.id - used in URLs
                };
            }));

            res.status(200).json({
                success: true,
                data: products
            });
        } catch (error) {
            console.error('Error fetching all products:', error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch all products"
            });
        }
    });

    // Helper function to fetch bundles for a clinic
    // A bundle is a product with more than one PharmacyCoverage
    const fetchBundlesForClinic = async (clinicId: string) => {
        const tenantProducts = await TenantProduct.findAll({
            where: { clinicId },
            include: [{
                model: Product,
                as: "product",
                where: { isActive: true },
                required: true,
                attributes: ['id', 'name', 'description', 'imageUrl', 'categories', 'price', 'slug'],
                include: [
                    {
                        model: PharmacyCoverage,
                        as: "pharmacyCoverages",
                        include: [{
                            model: Pharmacy,
                            as: "pharmacy",
                            attributes: ['id', 'name']
                        }]
                    }
                ]
            }],
            order: [['createdAt', 'DESC']]
        });

        // Filter to only products with more than one PharmacyCoverage (bundles)
        const bundleProducts = tenantProducts.filter(
            (tp: any) => tp.product.pharmacyCoverages && tp.product.pharmacyCoverages.length > 1
        );

        // Check if this is an affiliate clinic
        const clinic = await Clinic.findByPk(clinicId);
        let affiliateUser: User | null = null;
        
        if (clinic?.affiliateOwnerClinicId) {
            // This is an affiliate clinic, find the affiliate user
            affiliateUser = await User.findOne({
                where: { clinicId: clinic.id }
            });
        }

        // If we have an affiliate user, get their custom images
        let customImages: AffiliateProductImage[] = [];
        if (affiliateUser) {
            customImages = await AffiliateProductImage.findAll({
                where: { affiliateId: affiliateUser.id }
            });
        }

        // Create a map of custom images by productId
        const customImageMap = new Map();
        customImages.forEach((img) => {
            customImageMap.set(img.productId, {
                customImageUrl: img.customImageUrl,
                useCustomImage: img.useCustomImage,
            });
        });

        // For each bundle, get the first TenantProductForm (the form ID used in URLs)
        const bundles = await Promise.all(bundleProducts.map(async (tp: any) => {
            const firstForm = await TenantProductForm.findOne({
                where: { productId: tp.product.id, clinicId },
                order: [['createdAt', 'ASC']],
                attributes: ['id'],
            });

            // Check if affiliate has custom image for this product
            const customImg = customImageMap.get(tp.product.id);
            let imageUrl = tp.product.imageUrl;
            
            // If affiliate has custom image and wants to use it, use that instead
            if (customImg?.useCustomImage && customImg?.customImageUrl) {
                imageUrl = customImg.customImageUrl;
            }

            return {
                id: tp.product.id,
                name: tp.product.name,
                description: tp.product.description,
                imageUrl: imageUrl,
                categories: tp.product.categories || [],
                price: tp.price || tp.product.price,
                wholesalePrice: tp.product.price,
                slug: tp.product.slug,
                formId: firstForm?.id || null, // TenantProductForm.id - used in URLs
                // Include the items in the bundle (PharmacyCoverages)
                includedItems: tp.product.pharmacyCoverages.map((pc: any) => ({
                    id: pc.id,
                    customName: pc.customName,
                    customSig: pc.customSig,
                    pharmacyName: pc.pharmacy?.name || 'Unknown Pharmacy'
                }))
            };
        }));

        return bundles;
    };

    // Public endpoint to get bundles for a clinic (with clinic slug)
    app.get("/public/bundles/:clinicSlug", async (req, res) => {
        try {
            const { clinicSlug } = req.params;

            const clinic = await Clinic.findOne({
                where: { slug: clinicSlug }
            });

            if (!clinic) {
                return res.status(404).json({
                    success: false,
                    message: "Clinic not found"
                });
            }

            const bundles = await fetchBundlesForClinic(clinic.id);

            res.status(200).json({
                success: true,
                data: bundles
            });
        } catch (error) {
            console.error('Error fetching public bundles:', error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch bundles"
            });
        }
    });

    // Public endpoint to get bundles (without clinic slug - for localhost testing)
    app.get("/public/bundles", async (req, res) => {
        try {
            // For localhost testing: get any clinic
            const anyClinic = await Clinic.findOne();

            if (!anyClinic) {
                return res.status(404).json({
                    success: false,
                    message: "No clinic found"
                });
            }

            const bundles = await fetchBundlesForClinic(anyClinic.id);

            res.status(200).json({
                success: true,
                data: bundles
            });
        } catch (error) {
            console.error('Error fetching public bundles:', error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch bundles"
            });
        }
    });

    // DEBUG: Find a questionnaire by ID
    app.get("/public/debug/questionnaire/:id", async (req, res) => {
        try {
            const { id } = req.params;

            const questionnaire = await Questionnaire.findByPk(id);

            if (!questionnaire) {
                return res.status(404).json({
                    success: false,
                    message: `Questionnaire with id "${id}" not found`
                });
            }

            res.status(200).json({
                success: true,
                questionnaire: {
                    id: questionnaire.id,
                    title: questionnaire.title,
                    formTemplateType: questionnaire.formTemplateType,
                    productId: questionnaire.productId,
                    createdAt: questionnaire.createdAt,
                }
            });
        } catch (error) {
            console.error('Error in debug endpoint:', error);
            res.status(500).json({
                success: false,
                message: "Debug endpoint failed",
                error: String(error)
            });
        }
    });

    // DEBUG: Get TenantProductForms for a specific product by slug
    app.get("/public/debug/product-forms/:slug", async (req, res) => {
        try {
            const { slug } = req.params;

            // Find the product by slug
            const product = await Product.findOne({
                where: { slug },
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product with slug "${slug}" not found`
                });
            }

            // Get all TenantProductForms for this product (these are the forms used in URLs!)
            const tenantProductForms = await TenantProductForm.findAll({
                where: { productId: product.id },
                order: [['createdAt', 'ASC']],
            });

            const firstForm = tenantProductForms[0];

            res.status(200).json({
                success: true,
                productId: product.id,
                productName: product.name,
                productSlug: product.slug,
                tenantProductForms: tenantProductForms.map((tpf: any) => ({
                    id: tpf.id,
                    clinicId: tpf.clinicId,
                    productId: tpf.productId,
                    currentFormVariant: tpf.currentFormVariant,
                    globalFormStructureId: tpf.globalFormStructureId,
                    createdAt: tpf.createdAt,
                })),
                selectedFormId: firstForm?.id || null,
                expectedUrl: firstForm
                    ? `http://limitless.localhost:3000/my-products/${firstForm.id}/${slug}`
                    : null
            });
        } catch (error) {
            console.error('Error in debug endpoint:', error);
            res.status(500).json({
                success: false,
                message: "Debug endpoint failed",
                error: String(error)
            });
        }
    });
}

