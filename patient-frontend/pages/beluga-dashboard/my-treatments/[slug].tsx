import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { QuestionnaireModal } from '../../../components/QuestionnaireModal'

type Status = 'idle' | 'loading'

interface PublicTreatment {
    id: string
    name: string
    slug: string
    questionnaireId: string | null
}

export default function PublicTreatmentPage() {
    const router = useRouter()
    const { slug } = router.query

    const [status, setStatus] = useState<Status>('loading')
    const [error, setError] = useState<string | null>(null)
    const [treatment, setTreatment] = useState<PublicTreatment | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    useEffect(() => {
        if (typeof slug === 'string') {
            loadTreatment(slug)
        }
    }, [slug])

    const loadTreatment = async (treatmentSlug: string) => {
        setStatus('loading')
        setError(null)

        try {
            const res = await fetch(`/api/public/brand-treatments/${encodeURIComponent(treatmentSlug)}`)
            const data = await res.json().catch(() => null)

            if (!res.ok || !data?.success || !data?.data) {
                setError(data?.message || 'This treatment is not currently available. Please contact the brand for assistance.')
                setStatus('idle')
                return
            }

            setTreatment({
                id: data.data.id,
                name: data.data.name,
                slug: data.data.slug,
                questionnaireId: data.data.questionnaireId,
            })
            setIsModalOpen(true)
        } catch (err) {
            console.error('❌ Public treatment load error:', err)
            setError('We could not load this treatment. Please refresh the page or contact support.')
        } finally {
            setStatus('idle')
        }
    }

    const handleModalClose = () => {
        setIsModalOpen(false)
        // Stay on the current subdomain and go to home page
        window.location.href = window.location.origin + '/'
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>{treatment ? `${treatment.name} - Beluga` : 'Treatment Intake'}</title>
                <meta name="description" content="Complete your clinical intake" />
            </Head>

            {status === 'loading' && !error && (
                <div className="flex items-center justify-center h-screen text-muted-foreground">
                    Loading treatment details...
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

            {treatment && isModalOpen && treatment.questionnaireId && (
                <QuestionnaireModal
                    isOpen={isModalOpen}
                    onClose={handleModalClose}
                    treatmentId={treatment.id}
                    treatmentName={treatment.name}
                />
            )}
        </div>
    )
}
