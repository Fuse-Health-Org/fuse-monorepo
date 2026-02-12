import Order from "../../models/Order";
import User from "../../models/User";
import OrderItem from "../../models/OrderItem";
import Product from "../../models/Product";
import TenantProduct from "../../models/TenantProduct";
import Payment from "../../models/Payment";
import ShippingAddress from "../../models/ShippingAddress";

export const getOrder = async (orderId: string) => {
    return Order.findOne({
        where: {
            id: orderId,
        }
    });
}

interface PaginationOptions {
    page: number;
    limit: number;
}

export const listOrdersByClinic = async (
    clinicId: string,
    options: PaginationOptions
): Promise<{ orders: Order[], total: number, totalPages: number }> => {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const { rows: orders, count: total } = await Order.findAndCountAll({
        where: { clinicId },
        attributes: [
            'id', 
            'orderNumber', 
            'status', 
            'totalAmount', 
            'subtotalAmount',
            'discountAmount',
            'taxAmount',
            'shippingAmount',
            'brandAmount',
            'platformFeeAmount',
            'doctorAmount',
            'pharmacyWholesaleAmount',
            'stripeAmount',
            'createdAt', 
            'shippedAt', 
            'deliveredAt'
        ],
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email']
            },
            {
                model: OrderItem,
                as: 'orderItems',
                include: [
                    {
                        model: Product,
                        as: 'product',
                        attributes: ['id', 'name', 'price', 'categories']
                    }
                ]
            },
            {
                model: TenantProduct,
                as: 'tenantProduct',
                attributes: ['id', 'price', 'productId'],
                include: [
                    {
                        model: Product,
                        as: 'product',
                        attributes: ['id', 'name']
                    }
                ]
            },
            {
                model: Payment,
                as: 'payment',
                attributes: ['status', 'paymentMethod']
            },
            {
                model: ShippingAddress,
                as: 'shippingAddress',
                attributes: ['address', 'apartment', 'city', 'state', 'zipCode', 'country']
            }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    // Transform the orders to include pharmacyPrice and brandPrice
    const transformedOrders = orders.map(order => {
        const orderJson = order.toJSON() as any;
        
        // Calculate total pharmacy cost for this order
        let totalPharmacyCost = 0;
        if (orderJson.orderItems && Array.isArray(orderJson.orderItems)) {
            totalPharmacyCost = orderJson.orderItems.reduce((sum: number, item: any) => {
                const pharmacyPrice = Number(item.product?.price) || 0;
                return sum + (pharmacyPrice * item.quantity);
            }, 0);
        }
        
        const orderTotal = Number(orderJson.totalAmount) || 0;
        const totalMarkup = orderTotal - totalPharmacyCost;
        
        // Transform order items to include both prices
        if (orderJson.orderItems && Array.isArray(orderJson.orderItems)) {
            // Calculate each item's proportional markup
            orderJson.orderItems = orderJson.orderItems.map((item: any) => {
                const pharmacyPrice = Number(item.product?.price) || 0;
                const itemPharmacyCost = pharmacyPrice * item.quantity;
                
                // Distribute the total markup proportionally based on pharmacy cost
                const itemProportion = totalPharmacyCost > 0 ? itemPharmacyCost / totalPharmacyCost : 0;
                const itemMarkup = totalMarkup * itemProportion;
                const brandPrice = pharmacyPrice + (itemMarkup / item.quantity);
                
                return {
                    ...item,
                    pharmacyPrice,  // Price from Products table (pharmacy cost)
                    brandPrice      // Calculated brand price with proportional markup
                };
            });
        }
        
        return orderJson;
    });

    return {
        orders: transformedOrders as any,
        total,
        totalPages: Math.ceil(total / limit)
    };
}

export const listOrdersByUser = async (
    userId: string,
    options: PaginationOptions
): Promise<{ orders: Order[], total: number, totalPages: number }> => {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const { rows: orders, count: total } = await Order.findAndCountAll({
        where: { userId },
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email']
            }
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        distinct: true
    });

    return {
        orders,
        total,
        totalPages: Math.ceil(total / limit)
    };
}