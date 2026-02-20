import SequenceRun from '../../models/SequenceRun'
import Sequence from '../../models/Sequence'
import MessageTemplate from '../../models/MessageTemplate'
import User from '../../models/User'
import sgMail from '@sendgrid/mail'
import { createSafePHIContext } from '../../utils/hipaa-masking'

type StepPayload = {
  id?: string
  type?: string
  templateId?: string
  timeSeconds?: number
  useCustomText?: boolean
  customText?: string
  customSubject?: string
  customMergeFields?: string[]
  [key: string]: unknown
}

type RunPayload = {
  userDetails?: {
    firstName?: string
    lastName?: string
    email?: string
    phoneNumber?: string
    [key: string]: unknown
  }
  shippingInfo?: Record<string, unknown>
  selectedProducts?: Record<string, unknown>
  patientFirstName?: string
  patientName?: string
  [key: string]: unknown
} | null

const MERGE_FIELD_REGEX = /\{\{([^}]+)\}\}/g

const toSnakeCase = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/\s+/g, '_').toLowerCase()

const buildTemplateContext = (
  run: SequenceRun, 
  sequence: Sequence, 
  mergeFields: string[]
): Record<string, string> => {
  const payload = (run.payload ?? {}) as Record<string, any>
  // Support both payload.userDetails (checkout trigger) and direct payload (manual trigger)
  const userDetails = payload?.userDetails ?? payload ?? {}

  const context: Record<string, string> = {}

  // Process each merge field from the template
  // Format: "name|firstName" where name is the variable and firstName is the DB field
  for (const field of mergeFields) {
    if (!field || typeof field !== 'string') continue
    
    const parts = field.split('|')
    const fieldName = parts[0]?.trim() // What user types: {{name}}
    const dbField = parts[1]?.trim()   // Database field: firstName
    
    if (!fieldName || !dbField) continue

    // Get value from userDetails or payload
    let value = ''
    
    // Try to get from userDetails first
    if (userDetails && dbField in userDetails) {
      value = String(userDetails[dbField] ?? '')
    }
    // Try payload directly (for fields not in userDetails)
    else if (payload && dbField in payload) {
      value = String(payload[dbField] ?? '')
    }
    // Try camelCase/snake_case variations
    else if (userDetails) {
      const snakeCaseField = toSnakeCase(dbField)
      if (snakeCaseField in userDetails) {
        value = String((userDetails as any)[snakeCaseField] ?? '')
      }
    }
    
    context[fieldName] = value
  }

  // Add some default fields that are always available
  context.sequence_name = sequence.name || ''
  context.trigger_event = run.triggerEvent || ''
  
  if (payload?.orderNumber) {
    context.order_number = String(payload.orderNumber)
  }
  
  if (payload?.totalAmount !== undefined) {
    context.total_amount = String(payload.totalAmount)
  }

  // 🔒 HIPAA COMPLIANCE: Add masked PHI fields
  // Create safe context with masked versions of sensitive data
  const safePHI = createSafePHIContext({
    firstName: userDetails?.firstName || userDetails?.patientFirstName || null,
    lastName: userDetails?.lastName || userDetails?.patientLastName || null,
    email: userDetails?.email || userDetails?.userEmail || payload?.userEmail || null,
    phoneNumber: userDetails?.phoneNumber || userDetails?.phone || payload?.phoneNumber || null,
    dob: userDetails?.dob || userDetails?.dateOfBirth || null,
    city: userDetails?.city || null,
    state: userDetails?.state || null,
    address: userDetails?.address || null,
    zipCode: userDetails?.zipCode || userDetails?.zip || null
  })

  // Add HIPAA-safe merge tags (these are always available)
  context.email_masked = safePHI.email_masked
  context.phone_masked = safePHI.phone_masked
  context.phone_last4 = safePHI.phone_last4
  context.dob_masked = safePHI.dob_masked
  context.dob_year = safePHI.dob_year
  context.age = safePHI.age !== null ? String(safePHI.age) : ''
  context.name_masked = safePHI.name_masked
  context.address_masked = safePHI.address_masked || ''
  context.zip_masked = safePHI.zip_masked || ''
  
  // Keep original unsafe fields for backward compatibility (but these should be phased out)
  // Templates should migrate to using the _masked versions
  if (safePHI.firstName) context.firstName = safePHI.firstName
  if (safePHI.lastName) context.lastName = safePHI.lastName

  console.log('🔒 Template context built with HIPAA-safe fields:', {
    hasMaskedEmail: !!context.email_masked,
    hasMaskedPhone: !!context.phone_masked,
    hasAge: !!context.age
  })

  return context
}

const replaceTemplateVariables = (text: string, context: Record<string, string>) => {
  if (!text) return text

  return text.replace(MERGE_FIELD_REGEX, (_, token) => {
    const normalized = toSnakeCase(String(token).trim())
    return context[normalized] ?? context[String(token).trim()] ?? `{{${token}}}`
  })
}

// Escape HTML to prevent injection
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Parse template body for SMS (text only, no images)
const parseTemplateBodyForSMS = (body: string): string => {
  if (!body) return ''

  try {
    // Try to parse as JSON (array of blocks from the template editor)
    const parsed = JSON.parse(body)
    
    if (Array.isArray(parsed)) {
      // Extract only text content from blocks (images are ignored for SMS)
      return parsed
        .filter((block: any) => block && block.type === 'text' && block.content)
        .map((block: any) => block.content)
        .join('\n\n') // Join multiple text blocks with double line break
    }
  } catch {
    // Not JSON, treat as plain text
  }

  // Return as-is if it's plain text
  return body
}

// Parse template body for EMAIL (converts to HTML with images)
const parseTemplateBodyForEmail = (body: string): string => {
  if (!body) return ''

  try {
    // Try to parse as JSON (array of blocks from the template editor)
    const parsed = JSON.parse(body)
    
    if (Array.isArray(parsed)) {
      // Convert blocks to HTML
      const htmlParts = parsed.map((block: any) => {
        if (!block || !block.content) return ''
        
        if (block.type === 'text') {
          // Escape HTML and convert text block to HTML paragraphs
          const safeContent = escapeHtml(block.content).replace(/\n/g, '<br>')
          return `<p style="margin: 16px 0; font-size: 16px; line-height: 1.5; color: #333333;">${safeContent}</p>`
        } else if (block.type === 'image') {
          // Escape URL for security and convert image block to HTML img tag
          const safeUrl = escapeHtml(block.content)
          return `<div style="margin: 24px 0; text-align: center;">
            <img src="${safeUrl}" alt="Image" style="max-width: 100%; height: auto; border-radius: 8px; display: inline-block;" />
          </div>`
        }
        
        return ''
      })
      
      // Wrap in a container with basic styling
      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          ${htmlParts.join('')}
        </div>
      `
    }
  } catch {
    // Not JSON, treat as plain text and wrap in basic HTML
    const safeBody = escapeHtml(body).replace(/\n/g, '<br>')
    return `<div style="font-family: sans-serif; padding: 20px;"><p>${safeBody}</p></div>`
  }

  // Return wrapped in basic HTML if it's plain text
  const safeBody = escapeHtml(body).replace(/\n/g, '<br>')
  return `<div style="font-family: sans-serif; padding: 20px;"><p>${safeBody}</p></div>`
}

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_VERIFIED_SENDER || 'no-reply@fuse.health'
const TWILIO_API_KEY = process.env.TWILIO_API_KEY

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
} else {
  console.warn('⚠️ SENDGRID_API_KEY not configured. Email sending is disabled.')
}

class SmsProvider {
  async send(to: string, body: string) {
    if (!TWILIO_API_KEY) {
      console.warn('⚠️ TWILIO_API_KEY not configured. SMS sending is disabled.')
      return
    }

    const parts = TWILIO_API_KEY.split(':')
    if (parts.length < 3) {
      console.warn('⚠️ TWILIO_API_KEY format invalid. Expected "accountSid:authToken:fromNumber"')
      return
    }

    const [accountSid, authToken, fromNumber] = parts

    if (!accountSid || !authToken || !fromNumber) {
      console.warn('⚠️ TWILIO_API_KEY missing account SID, auth token, or from number')
      return
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const params = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('❌ Twilio SMS send failed:', text)
      throw new Error(`Twilio SMS failed with status ${response.status}`)
    }

    console.log('📱 SMS sent via Twilio')
  }
}

class EmailProvider {
  async send(to: string, subject: string, body: string, trackingRunId?: string) {
    if (!SENDGRID_API_KEY) {
      console.warn('⚠️ Skipping email send because SENDGRID_API_KEY is missing.')
      return
    }

    // Add tracking pixel if runId is provided
    let htmlBody = body
    if (trackingRunId) {
      const webhookBaseUrl = process.env.SENDGRID_WEBHOOK || process.env.API_URL || 'http://localhost:3001'
      const trackingPixel = `<img src="${webhookBaseUrl}/track/email/${trackingRunId}/open" width="1" height="1" alt="" style="display:none;" />`
      htmlBody = body + trackingPixel
    }

    const msg: any = {
      to,
      from: SENDGRID_FROM_EMAIL,
      subject,
      text: body.replace(/<\/?[^>]+(>|$)/g, ''),
      html: htmlBody,
      trackingSettings: {
        clickTracking: {
          enable: true,
          enableText: true
        },
        openTracking: {
          enable: true
        }
      }
    }

    // Add custom args with runId for webhook tracking
    if (trackingRunId) {
      msg.customArgs = {
        runId: trackingRunId,
        run_id: trackingRunId
      }
    }

    await sgMail.send(msg)
    console.log('📧 Email sent via SendGrid with tracking:', { runId: trackingRunId })
  }
}

export default class SequenceMessageDispatcher {
  private smsProvider = new SmsProvider()
  private emailProvider = new EmailProvider()

  async dispatchStep(run: SequenceRun, sequence: Sequence, rawStep: StepPayload) {
    const stepType = (rawStep.type || '').toString().toLowerCase()

    if (stepType !== 'sms' && stepType !== 'email') {
      console.warn(`⚠️ Unsupported step type "${stepType}" for run ${run.id}`)
      return
    }

    // Check if using custom text or template
    const useCustomText = !!rawStep.customText
    const templateId = rawStep.templateId

    if (!useCustomText && (!templateId || typeof templateId !== 'string')) {
      console.warn(`⚠️ Missing both templateId and customText for step ${rawStep.id ?? 'unknown'} in run ${run.id}`)
      return
    }

    // Get template data (either from DB or custom)
    let template: { body: string; subject?: string; mergeFields?: string[] } | null = null
    
    if (useCustomText) {
      // Use custom text provided in the step
      template = {
        body: rawStep.customText || '',
        subject: rawStep.customSubject,
        mergeFields: rawStep.customMergeFields || []
      }
      console.log(`📝 Using custom text for step in run ${run.id}`)
    } else {
      // Use existing template from database
      const dbTemplate = await MessageTemplate.findByPk(templateId!)
      if (!dbTemplate) {
        console.warn(`⚠️ Template ${templateId} not found for run ${run.id}`)
        return
      }
      template = {
        body: dbTemplate.body,
        subject: dbTemplate.subject,
        mergeFields: Array.isArray(dbTemplate.mergeFields) ? dbTemplate.mergeFields : []
      }
    }

    // Extract user details from payload (declared once and reused)
    // Support both payload.userDetails (checkout trigger) and direct payload (manual trigger)
    const payload = (run.payload ?? {}) as Record<string, any>
    const userDetails = payload?.userDetails ?? payload ?? {}
    const email = (userDetails?.email || userDetails?.userEmail || payload?.userEmail || '') as string
    const phone = (userDetails?.phoneNumber || payload?.phoneNumber || '') as string
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 Extracted contact info for run ${run.id}:`, {
        hasEmail: !!email,
        hasPhone: !!phone,
        hasUserDetails: !!payload?.userDetails,
        payloadKeys: payload ? Object.keys(payload) : []
      })
    }
    
    // Check opt-out status before sending
    if (email) {
      const user = await User.findOne({ where: { email } })
      
      if (user) {
        // Check if user has opted out from the specific channel
        if (stepType === 'email' && user.emailOptedOut) {
          console.log(`⛔ Skipping email send - user opted out (run ${run.id})`)
          return
        }

        if (stepType === 'sms' && user.smsOptedOut) {
          console.log(`⛔ Skipping SMS send - user opted out (run ${run.id})`)
          return
        }
      }
    }

    // Build context using template's merge fields
    const mergeFields = template.mergeFields || []
    const context = buildTemplateContext(run, sequence, mergeFields)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Template context built for run ${run.id}:`, {
        mergeFields: template.mergeFields,
        availableFields: Object.keys(context),
        useCustomText
      })
    }

    if (stepType === 'sms') {
      // Parse template body for SMS (text only, no images)
      const parsedBody = parseTemplateBodyForSMS(template.body)
      const renderedBody = replaceTemplateVariables(parsedBody, context)
      
      // Add compliance footer for SMS
      const smsWithFooter = `${renderedBody}\n\nReply STOP to unsubscribe`

      if (!phone || typeof phone !== 'string') {
        console.warn(`⚠️ No phone number available for SMS run ${run.id}`)
        return
      }

      await this.smsProvider.send(phone as string, smsWithFooter)
      
      // Increment SMS counter
      run.smsSent = (run.smsSent || 0) + 1
      await run.save()
      
      console.log(`📊 SMS sent tracked for run ${run.id}: ${run.smsSent} total`)
      return
    }

    // Parse template body for EMAIL (converts to HTML with images)
    const parsedBody = parseTemplateBodyForEmail(template.body)
    const renderedBody = replaceTemplateVariables(parsedBody, context)

    if (!email || typeof email !== 'string') {
      console.warn(`⚠️ No email available for email run ${run.id}`)
      return
    }

    // Parse subject (text only for subject line)
    const parsedSubject = template.subject ? parseTemplateBodyForSMS(template.subject) : sequence.name || 'Sequence Message'
    const subject = replaceTemplateVariables(parsedSubject, context)

    // Add compliance unsubscribe footer
    const webhookBaseUrl = process.env.SENDGRID_WEBHOOK || process.env.API_URL || 'http://localhost:3001'
    const unsubscribeFooter = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p style="margin: 8px 0;">You're receiving this email because you completed a purchase with us.</p>
        <p style="margin: 8px 0;">
          <a href="${webhookBaseUrl}/unsubscribe/${run.id}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from these emails</a>
        </p>
      </div>
    `
    const emailWithFooter = renderedBody + unsubscribeFooter

    // Send email with tracking pixel
    await this.emailProvider.send(email as string, subject, emailWithFooter, run.id)
    
    // Increment email counter
    run.emailsSent = (run.emailsSent || 0) + 1
    await run.save()
    
    console.log(`📊 Email sent tracked for run ${run.id}: ${run.emailsSent} total`)
  }
}

