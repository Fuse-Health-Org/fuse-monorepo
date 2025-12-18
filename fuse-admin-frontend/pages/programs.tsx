import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Layout from '@/components/Layout'
import {
    Stethoscope,
    Plus,
    Edit,
    Trash2,
    FileText
} from 'lucide-react'

interface Program {
    id: string
    name: string
    description?: string
    clinicId: string
    medicalTemplateId?: string
    isActive: boolean
    createdAt: string
    updatedAt: string
    medicalTemplate?: {
        id: string
        title: string
        description?: string
        formTemplateType: string
    }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export default function Programs() {
    const [programs, setPrograms] = useState<Program[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { token, user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        fetchPrograms()
    }, [token])

    const fetchPrograms = async () => {
        if (!token) return

        try {
            setLoading(true)
            const response = await fetch(`${API_URL}/programs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (response.ok) {
                const data = await response.json()
                if (data.success) {
                    setPrograms(data.data)
                } else {
                    setError(data.message || 'Failed to load programs')
                }
            } else {
                setError('Failed to load programs')
            }
        } catch (err) {
            console.error('Error fetching programs:', err)
            setError('Failed to load programs')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteProgram = async (programId: string, programName: string) => {
        if (!confirm(`Are you sure you want to delete "${programName}"? This action cannot be undone.`)) {
            return
        }

        try {
            const response = await fetch(`${API_URL}/programs/${programId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })

            const data = await response.json()

            if (response.ok && data.success) {
                setPrograms(prev => prev.filter(p => p.id !== programId))
                setError('✅ Program deleted successfully!')
                setTimeout(() => setError(null), 3000)
            } else {
                setError(data.message || 'Failed to delete program')
            }
        } catch (err) {
            console.error('Error deleting program:', err)
            setError('Failed to delete program')
        }
    }

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-background flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading programs...</p>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <Head>
                <title>Programs - Fuse Admin</title>
            </Head>
            <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: 'Inter, sans-serif' }}>
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-2xl font-semibold mb-1">Programs</h1>
                            <p className="text-sm text-muted-foreground">Manage your clinic programs and their medical templates</p>
                        </div>
                        <Button
                            onClick={() => router.push('/programs/create')}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Create Program
                        </Button>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div
                            className={`mb-6 p-4 border rounded-md ${error.includes('✅')
                                ? 'bg-background border-border text-foreground'
                                : 'bg-destructive/10 border-destructive/30 text-destructive text-sm'
                                }`}
                        >
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Programs List */}
                    {programs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {programs.map((program) => (
                                <div
                                    key={program.id}
                                    className="bg-card rounded-2xl shadow-sm border border-border p-6 hover:shadow-md transition-all cursor-pointer"
                                    onClick={() => router.push(`/programs/${program.id}`)}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                <Stethoscope className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold">{program.name}</h3>
                                                <Badge variant={program.isActive ? "default" : "secondary"} className="text-xs mt-1">
                                                    {program.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {program.description && (
                                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                            {program.description}
                                        </p>
                                    )}

                                    {program.medicalTemplate && (
                                        <div className="mb-4 p-3 bg-muted rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-xs font-medium text-muted-foreground">Medical Template</span>
                                            </div>
                                            <p className="text-sm font-medium">{program.medicalTemplate.title}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-4 border-t border-border">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                router.push(`/programs/${program.id}`)
                                            }}
                                            className="flex-1"
                                        >
                                            <Edit className="h-3 w-3 mr-1" />
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteProgram(program.id, program.name)
                                            }}
                                            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-card rounded-lg border border-border p-16 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                    <Stethoscope className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className='flex flex-col justify-center items-center'>
                                    <h3 className="text-base font-medium mb-1">No programs yet</h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Create your first program to get started
                                    </p>
                                    <Button
                                        onClick={() => router.push('/programs/create')}
                                        className="flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Create Program
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
