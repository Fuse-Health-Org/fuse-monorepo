import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"

export interface Product {
    id: string
    name: string
    description?: string | null
    category?: string | null
    categories?: string[]
    imageUrl?: string | null
    isActive?: boolean
    createdAt?: string
    updatedAt?: string
}

export interface ProductFormAssignment {
    id: string
    formTemplateId: string
    productId: string
    createdAt?: string
    product?: Product
}

export function useProducts(baseUrl: string) {
    const { token } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [products, setProducts] = useState<Product[]>([])
    const [assignments, setAssignments] = useState<ProductFormAssignment[]>([])

    const fetchProducts = useCallback(async () => {
        if (!token) return
        setLoading(true)
        setError(null)

        try {
            const productsRes = await fetch(`${baseUrl}/products-management?limit=500&isActive=true`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (!productsRes.ok) {
                const data = await productsRes.json().catch(() => ({}))
                throw new Error(data.message || "Failed to load products")
            }

            const productsData = await productsRes.json()

            // Normalize products payload from various API shapes
            const allProducts = Array.isArray(productsData)
                ? productsData
                : Array.isArray(productsData?.data?.products)
                    ? productsData.data.products
                    : Array.isArray(productsData?.data)
                        ? productsData.data
                        : Array.isArray(productsData?.products)
                            ? productsData.products
                            : []

            setProducts(allProducts.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description || null,
                category: Array.isArray(p.categories) && p.categories.length > 0
                    ? p.categories[0]
                    : p.category || null,
                categories: Array.isArray(p.categories) ? p.categories : [],
                imageUrl: p.imageUrl || null,
                isActive: p.isActive !== false,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            })))
        } catch (err: any) {
            console.error("❌ Error loading products:", err)
            setError(err.message ?? "Failed to load products")
        } finally {
            setLoading(false)
        }
    }, [baseUrl, token])

    const fetchAssignments = useCallback(async () => {
        if (!token) return

        try {
            const assignmentsRes = await fetch(`${baseUrl}/questionnaires/product-assignments`, {
                headers: { Authorization: `Bearer ${token}` },
            })

            if (assignmentsRes.ok) {
                const assignmentsData = await assignmentsRes.json()
                const assignmentsList: any[] = Array.isArray(assignmentsData?.data)
                    ? assignmentsData.data
                    : []
                setAssignments(assignmentsList)
            }
        } catch (err: any) {
            console.error("❌ Error loading assignments:", err)
        }
    }, [baseUrl, token])

    const assignProductsToForm = useCallback(
        async (formTemplateId: string, productIds: string[]) => {
            if (!token) throw new Error("Not authenticated")

            const response = await fetch(`${baseUrl}/questionnaires/${formTemplateId}/assign-products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ productIds }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.message || "Failed to assign products")
            }

            await fetchAssignments()
        },
        [baseUrl, token, fetchAssignments]
    )

    const getAssignedProducts = useCallback(
        (formTemplateId: string): string[] => {
            return assignments
                .filter((a) => a.formTemplateId === formTemplateId)
                .map((a) => a.productId)
        },
        [assignments]
    )

    useEffect(() => {
        fetchProducts()
        fetchAssignments()
    }, [fetchProducts, fetchAssignments])

    return {
        loading,
        error,
        products,
        assignments,
        assignProductsToForm,
        getAssignedProducts,
        refresh: () => {
            fetchProducts()
            fetchAssignments()
        },
    }
}

