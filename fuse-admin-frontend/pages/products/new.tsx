import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import {
    ArrowLeft,
    Save,
    X,
    Loader2,
    CheckCircle,
    XCircle,
    Upload,
    ImageIcon,
    Package,
    DollarSign,
    FileText,
    Hash,
    Check
} from 'lucide-react'
import Tutorial from '@/components/ui/tutorial'
import { tutorialSteps } from '@/utils/tutorialSteps'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const PRODUCT_CATEGORIES = [
    { value: 'weight_loss', label: 'Weight Loss' },
    { value: 'hair_growth', label: 'Hair Growth' },
    { value: 'performance', label: 'Performance' },
    { value: 'sexual_health', label: 'Sexual Health' },
    { value: 'skincare', label: 'Skincare' },
    { value: 'wellness', label: 'Wellness' },
    { value: 'other', label: 'Other' },
]

export default function CreateProduct() {
    const [loading, setLoading] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    // Tutorial is now managed from the sidebar using DB
    const [runTutorial, setRunTutorial] = useState(false)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [imageConfirmed, setImageConfirmed] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        description: '',
        pharmacyProductId: '',
        placeholderSig: '',
        category: 'other',
        activeIngredients: [] as string[],
        active: true
    })
    const { user, token, authenticatedFetch } = useAuth()
    const router = useRouter()

    const uploadProductImage = async (productId: string) => {
        if (!imageFile || !token) return

        try {
            console.log('🔍 Uploading product image for product:', productId)

            const formData = new FormData()
            formData.append('image', imageFile)

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/products/${productId}/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Don't set Content-Type for FormData - let browser set it with boundary
                },
                body: formData
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    console.log('✅ Product image uploaded successfully')

                    // Clear the image after successful upload
                    setImageFile(null)
                    setImagePreview(null)
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                } else {
                    console.error('❌ Failed to upload product image:', data.message)
                }
            } else {
                const errorText = await response.text()
                console.error(`❌ Failed to upload product image: ${response.status} ${response.statusText}`)
            }
        } catch (err) {
            console.error('Error uploading product image:', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) return

        setLoading(true)
        setError(null)
        setImageConfirmed(false)

        try {
            console.log('🔍 Creating new product')

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/products`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ...formData, price: 20 })
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    console.log('✅ Product created successfully')
                    const newProductId = data.data.id

                    // Upload image if one was selected
                    if (imageFile) {
                        try {
                            await uploadProductImage(newProductId)
                        } catch (imageUploadError) {
                            console.error('⚠️ Product created but image upload failed:', imageUploadError)
                            // Don't fail the entire process - the product was created successfully
                            // User can upload image later from the edit page
                        }
                    }

                    router.push(`/products/${newProductId}`)
                } else {
                    setError(data.message || 'Failed to create product')
                }
            } else {
                const errorText = await response.text()
                setError(`Failed to create product: ${response.status} ${response.statusText}`)
            }
        } catch (err) {
            console.error('Error creating product:', err)
            setError('Failed to create product')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleStatusChange = (active: boolean) => {
        setFormData(prev => ({
            ...prev,
            active
        }))
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file')
                return
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB')
                return
            }

            setImageFile(file)
            setImageConfirmed(false) // Reset confirmation when new image is selected

            // Create preview
            const reader = new FileReader()
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)

            setError(null)
        }
    }

    const handleImageUpload = async () => {
        // The image upload now happens automatically after product creation
        // This button is for visual feedback - the upload will happen when the product is created
        if (!imageFile) {
            setError('Please select an image first')
            return
        }

        setUploadingImage(true)
        setError(null)

        try {
            // Show feedback that image is ready for upload
            console.log('✅ Image confirmed and ready for upload after product creation')

            // Mark image as confirmed - it will be uploaded after product creation
            setImageConfirmed(true)

            // Keep the image selected - it will be uploaded after product creation
            // Don't clear it here, only clear after successful upload

        } catch (err) {
            console.error('Error handling image:', err)
            setError('Failed to handle image')
        } finally {
            setUploadingImage(false)
        }
    }

    const handleRemoveImage = () => {
        setImageFile(null)
        setImagePreview(null)
        setImageConfirmed(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    return (
        <Layout>
            <Head>
                <title>Create Product - Fuse Admin</title>
                <meta name="description" content="Create a new product for your clinic" />
            </Head>
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                onClick={() => router.push('/products')}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Products
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">Create Product</h1>
                                <p className="text-muted-foreground">Add a new product to your clinic catalog</p>
                            </div>
                        </div>
                        {getStatusBadge(formData.active)}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex">
                                <XCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-red-700">{error}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div id="tutorial-step-5" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Form */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Basic Information */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Package className="h-5 w-5" />
                                            Basic Information
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                                                    Product Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                    placeholder="Enter product name"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                                                    Description
                                                </label>
                                                <textarea
                                                    id="description"
                                                    name="description"
                                                    value={formData.description}
                                                    onChange={handleInputChange}
                                                    rows={3}
                                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                    placeholder="Enter product description"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="price" className="block text-sm font-medium text-foreground mb-2">
                                                        Price *
                                                    </label>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <input
                                                            type="number"
                                                            id="price"
                                                            name="price"
                                                            value={formData.price}
                                                            onChange={handleInputChange}
                                                            step="0.01"
                                                            min="0"
                                                            required
                                                            className="w-full pl-10 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label htmlFor="pharmacyProductId" className="block text-sm font-medium text-foreground mb-2">
                                                        Pharmacy Product ID
                                                    </label>
                                                    <div className="relative">
                                                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <input
                                                            type="text"
                                                            id="pharmacyProductId"
                                                            name="pharmacyProductId"
                                                            value={formData.pharmacyProductId}
                                                            onChange={handleInputChange}
                                                            className="w-full pl-10 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                            placeholder="Enter pharmacy ID"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label htmlFor="placeholderSig" className="block text-sm font-medium text-foreground mb-2">
                                                    Default Placeholder Sig
                                                </label>
                                                <input
                                                    type="text"
                                                    id="placeholderSig"
                                                    name="placeholderSig"
                                                    value={formData.placeholderSig}
                                                    onChange={handleInputChange}
                                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                    placeholder="e.g., 500mg, 2 tablets daily"
                                                />
                                            </div>

                                            <div>
                                                <label htmlFor="category" className="block text-sm font-medium text-foreground mb-2">
                                                    Category *
                                                </label>
                                                <select
                                                    id="category"
                                                    name="category"
                                                    value={formData.category}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                >
                                                    {PRODUCT_CATEGORIES.map((cat) => (
                                                        <option key={cat.value} value={cat.value}>
                                                            {cat.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Status Toggle */}
                                            <div>
                                                <label className="block text-sm font-medium text-foreground mb-2">
                                                    Status
                                                </label>
                                                <div className="flex gap-4">
                                                    <Button
                                                        type="button"
                                                        variant={formData.active ? "default" : "outline"}
                                                        onClick={() => handleStatusChange(true)}
                                                        className="flex-1"
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                        Active
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={!formData.active ? "default" : "outline"}
                                                        onClick={() => handleStatusChange(false)}
                                                        className="flex-1"
                                                    >
                                                        <XCircle className="h-4 w-4 mr-2" />
                                                        Inactive
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Active Ingredients */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Active Ingredients</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {formData.activeIngredients.map((ingredient, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={ingredient}
                                                        onChange={(e) => {
                                                            const newIngredients = [...formData.activeIngredients]
                                                            newIngredients[index] = e.target.value
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                activeIngredients: newIngredients
                                                            }))
                                                        }}
                                                        className="flex-1 px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                        placeholder="e.g., Acetaminophen"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            const newIngredients = formData.activeIngredients.filter((_, i) => i !== index)
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                activeIngredients: newIngredients
                                                            }))
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        activeIngredients: [...prev.activeIngredients, '']
                                                    }))
                                                }}
                                                className="w-full"
                                            >
                                                + Add Ingredient
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                {/* Product Image Upload */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <ImageIcon className="h-5 w-5" />
                                            Product Image
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {/* Image Preview */}
                                            {imagePreview && (
                                                <div className="text-center">
                                                    <img
                                                        src={imagePreview}
                                                        alt="Product image preview"
                                                        className="w-full max-w-xs mx-auto h-32 object-cover rounded-lg border-2 border-primary"
                                                    />
                                                    <p className="text-sm text-primary mt-2">
                                                        {imageConfirmed
                                                            ? "Image confirmed! Will be uploaded after product creation."
                                                            : "Image selected! Click 'Confirm Selection' to proceed."
                                                        }
                                                    </p>
                                                </div>
                                            )}

                                            {/* File Input */}
                                            <div className="space-y-2">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileSelect}
                                                    className="hidden"
                                                    id="image-upload"
                                                />
                                                <label htmlFor="image-upload">
                                                    <Button
                                                        variant="outline"
                                                        className="w-full cursor-pointer"
                                                        asChild
                                                    >
                                                        <span>
                                                            <Upload className="h-4 w-4 mr-2" />
                                                            {imageFile ? 'Change Image' : 'Upload Image'}
                                                        </span>
                                                    </Button>
                                                </label>

                                                {imageFile && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            onClick={handleImageUpload}
                                                            disabled={uploadingImage || imageConfirmed}
                                                            className="flex-1"
                                                        >
                                                            {uploadingImage ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                    Processing...
                                                                </>
                                                            ) : imageConfirmed ? (
                                                                <>
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Confirmed ✓
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload className="h-4 w-4 mr-2" />
                                                                    Confirm Selection
                                                                </>
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            onClick={handleRemoveImage}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-xs text-muted-foreground">
                                                Supported formats: JPEG, PNG, WebP (max 5MB)
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Help Text */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Instructions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm text-muted-foreground">
                                            <p>1. Fill in the basic product information</p>
                                            <p>2. Add active ingredients if applicable</p>
                                            <p>3. Optionally select a product image and click "Confirm Selection"</p>
                                            <p>4. Click "Create Product" to save</p>
                                            <p className="pt-2 border-t">
                                                <strong>Note:</strong> Images are uploaded automatically after the product is created.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-4 mt-8">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push('/products')}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                id="tutorial-step-6"
                                type="submit"
                                disabled={loading || !formData.name.trim()}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Create Product
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    )
}

function getStatusBadge(active: boolean) {
    return active
        ? <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
        : <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" /> Inactive</Badge>
}

