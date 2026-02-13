import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { QuestionnaireModal } from '../../../../components/QuestionnaireModal'

type Status = 'idle' | 'loading'

interface PublicProduct {
    id: string
    name: string
    slug: string
    questionnaireId: string | null
    category?: string | null
    categories?: string[]
    currentFormVariant?: string | null
    price?: number | null
    stripeProductId?: string | null
    stripePriceId?: string | null
    tenantProductId?: string | null
    tenantProductFormId?: string | null
    globalFormStructureId?: string | null
    globalFormStructure?: any | null
}

interface ProgramProductWithPricing {
    id: string
    name: string
    slug: string
    imageUrl?: string
    basePrice: number
    displayPrice: number
    categories?: string[]
    tenantProduct?: {
        id: string
        price: number
        isActive: boolean
    }
}

interface NonMedicalService {
    enabled: boolean
    price: number
}

interface ProgramNonMedicalServices {
    patientPortal: NonMedicalService
    bmiCalculator: NonMedicalService
    proteinIntakeCalculator: NonMedicalService
    calorieDeficitCalculator: NonMedicalService
    easyShopping: NonMedicalService
}

interface ProgramData {
    id: string
    name: string
    description?: string
    clinicId: string
    medicalTemplateId: string
    medicalTemplate?: {
        id: string
        title: string
        description?: string
    }
    isActive: boolean
    // All products with pricing
    products: ProgramProductWithPricing[]
    // Non-medical services
    nonMedicalServices: ProgramNonMedicalServices
    nonMedicalServicesFee: number
    productOfferType?: 'single_choice' | 'multiple_choice'
    hasPerProductPricing?: boolean
}

export default function PublicProductPage() {
    console.log('PublicProductPage Edu')
    const router = useRouter()
    const { extra, slug } = router.query

    const [status, setStatus] = useState<Status>('loading')
    const [error, setError] = useState<string | null>(null)
    const [product, setProduct] = useState<PublicProduct | null>(null)
    const [program, setProgram] = useState<ProgramData | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    useEffect(() => {
        if (typeof slug === 'string' && typeof extra === 'string') {
            // Check if this is a program flow (slug === 'program')
            if (slug === 'program') {
                console.log('[PublicProduct] Program flow detected, programId:', extra)
                loadProgram(extra)
            } else {
                console.log('[PublicProduct] route params', { extra, slug })
                loadProduct(slug, extra)
            }
        }
    }, [slug, extra])

    // Load program data
    const loadProgram = async (programId: string) => {
        setStatus('loading')
        setError(null)

        try {
            const apiUrl = `/api/public/programs/${encodeURIComponent(programId)}`
            console.log('[PublicProduct] fetching program', { apiUrl })
            const res = await fetch(apiUrl)
            const data = await res.json()
            console.log('[PublicProduct] program response', { status: res.status, data })

            if (!res.ok || !data?.success || !data?.data) {
                setError(data?.message || 'This program is not currently available.')
                setStatus('idle')
                return
            }

            const programData = data.data
            if (!programData.medicalTemplateId) {
                setError('This program does not have a medical template configured.')
                setStatus('idle')
                return
            }

            console.log('[PublicProduct] Program loaded:', programData.name)
            console.log('[PublicProduct] Products:', programData.products?.length)

            setProgram({
                id: programData.id,
                name: programData.name,
                description: programData.description,
                clinicId: programData.clinicId,
                medicalTemplateId: programData.medicalTemplateId,
                medicalTemplate: programData.medicalTemplate,
                isActive: programData.isActive,
                products: programData.products || [],
                nonMedicalServices: programData.nonMedicalServices,
                nonMedicalServicesFee: programData.nonMedicalServicesFee || 0,
                productOfferType: programData.productOfferType,
                hasPerProductPricing: programData.hasPerProductPricing || false,
            })
            setIsModalOpen(true)
        } catch (err) {
            console.error('❌ Program load error:', err)
            setError('We could not load this program. Please refresh the page or contact support.')
        } finally {
            setStatus('idle')
        }
    }

    // Load product data (regular product flow)
    const loadProduct = async (productSlug: string, expectedVariant: string | null) => {
        setStatus('loading')
        setError(null)

        try {
            const variantQuery = expectedVariant ? `?variant=${encodeURIComponent(expectedVariant)}` : ''
            const apiUrl = `/api/public/brand-products/${encodeURIComponent(productSlug)}${variantQuery}`
            console.log('[PublicProduct] fetching', { apiUrl })
            const res = await fetch(apiUrl)
            const raw = await res.text()
            let data: any
            try { data = JSON.parse(raw) } catch { data = raw }
            console.log('[PublicProduct] api response', { status: res.status, data })
            console.log('[PublicProduct] api response', data)

            if (!res.ok || !data?.success || !data?.data) {
                setError(data?.message || 'This product is not currently available. Please contact the brand for assistance.')
                setStatus('idle')
                return
            }

            // Optional: API may include currentFormVariant
            const currentFormVariant: string | null = data.data.currentFormVariant ?? null
            const tenantProductFormId: string | null = data.data.tenantProductFormId ?? null

            // If a specific variant/form is requested, ensure it matches the enabled one
            if (expectedVariant) {
                if (tenantProductFormId) {
                    if (tenantProductFormId !== expectedVariant) {
                        console.warn('[PublicProduct] form id mismatch', { expectedVariant, tenantProductFormId })
                        setError('Form variant not enabled')
                        setStatus('idle')
                        return
                    }
                } else if (currentFormVariant) {
                    if (currentFormVariant !== expectedVariant) {
                        console.warn('[PublicProduct] variant mismatch', { expectedVariant, currentFormVariant })
                        setError('Form variant not enabled')
                        setStatus('idle')
                        return
                    }
                } else {
                    console.warn('[PublicProduct] expected variant but none provided by API', { expectedVariant })
                    setError('Form variant not enabled')
                    setStatus('idle')
                    return
                }
            }

            const productData = {
                id: data.data.id,
                name: data.data.name,
                slug: data.data.slug,
                questionnaireId: data.data.questionnaireId,
                category: data.data.category || null,
                currentFormVariant,
                price: data.data.price ?? null,
                stripeProductId: data.data.stripeProductId ?? null,
                stripePriceId: data.data.stripePriceId ?? null,
                tenantProductId: data.data.tenantProductId ?? null,
                tenantProductFormId,
                globalFormStructureId: data.data.globalFormStructureId,
                globalFormStructure: data.data.globalFormStructure,
            }
            console.log('🎯 Product data received with Global Form Structure:', productData.globalFormStructure?.name)
            setProduct(productData)
            setIsModalOpen(true)
        } catch (err) {
            console.error('❌ Public product load error:', err)
            setError('We could not load this product form. Please refresh the page or contact support.')
        } finally {
            setStatus('idle')
        }
    }

    const handleModalClose = () => {
        setIsModalOpen(false)
        // Save current state to sessionStorage for potential resume
        if (program) {
            sessionStorage.setItem('lastViewedProgram', JSON.stringify({
                id: program.id,
                name: program.name,
                timestamp: Date.now()
            }))
        } else if (product) {
            sessionStorage.setItem('lastViewedProduct', JSON.stringify({
                id: product.id,
                name: product.name,
                slug: product.slug,
                timestamp: Date.now()
            }))
        }
        // Navigate back to home/landing page using router
        router.push('/')
    }

    // Determine page title
    const pageTitle = program
        ? `${program.name} - Fuse`
        : product
            ? `${product.name} - Fuse`
            : 'Product Intake'

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>{pageTitle}</title>
                <meta name="description" content="Complete your clinical intake" />
            </Head>

            {status === 'loading' && !error && (
                <div className="flex items-center justify-center h-screen text-muted-foreground">
                    {slug === 'program' ? 'Loading program details...' : 'Loading product details...'}
                </div>
            )}

            {error && (
                <div className="flex items-center justify-center h-screen px-6">
                    <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-700">
                        <p className="font-semibold mb-2">We hit a snag</p>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {/* Program flow - uses medicalTemplateId as questionnaireId */}
            {program && isModalOpen && program.medicalTemplateId && (
                <QuestionnaireModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    questionnaireId={program.medicalTemplateId}
                    productName={program.name}
                    // Pass full program data for checkout
                    programData={program}
                />
            )}

            {/* Regular product flow */}
            {product && isModalOpen && product.questionnaireId && (
                <QuestionnaireModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    questionnaireId={product.questionnaireId}
                    productName={product.name}
                    productCategory={product.category || undefined}
                    productFormVariant={typeof extra === 'string' ? extra : undefined}
                    globalFormStructure={product.globalFormStructure || undefined}
                    // Pass pricing data for fallback plan rendering
                    productPrice={typeof product.price === 'number' ? product.price : undefined}
                    productStripeProductId={product.stripeProductId || undefined}
                    productStripePriceId={product.stripePriceId || undefined}
                    tenantProductId={product.tenantProductId || undefined}
                    tenantProductFormId={product.tenantProductFormId || (typeof extra === 'string' ? extra : undefined)}
                />
            )}

            {/* Product loaded but no questionnaire attached */}
            {product && !product.questionnaireId && status === 'idle' && !error && (
                <div className="flex items-center justify-center h-screen px-6">
                    <div className="max-w-md w-full bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-amber-900 mb-2">Questionnaire Not Available</h3>
                        <p className="text-sm text-amber-700 mb-4">
                            This product doesn&apos;t have a questionnaire attached to it yet.
                        </p>
                        <p className="text-xs text-amber-600">
                            Please contact a Fuse administrator to set up the intake form for this product.
                        </p>
                        <button
                            onClick={handleModalClose}
                            className="mt-6 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}


