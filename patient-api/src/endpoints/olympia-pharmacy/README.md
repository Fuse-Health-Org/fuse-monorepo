# Olympia Pharmacy Webhook

## Overview

This webhook endpoint receives tracking updates from Olympia Pharmacy for prescription orders.

## Endpoint

**URL**: `/webhook/olympia-pharmacy`

**Method**: `POST`

**Authentication**: Bearer Token (using `OLYMPIA_PHARMACY_WEBHOOK_SECRET`)

## Environment Variables

Add the following to your `.env` file:

```bash
OLYMPIA_PHARMACY_WEBHOOK_SECRET=your_secret_token_here
```

## Webhook Payload

Olympia Pharmacy sends the following JSON structure:

```json
{
  "vendor_order_id": "xyz_12345",
  "status": "shipped",
  "tracking_number": "1Z9646F62498366759",
  "carrier": "ups"
}
```

### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vendor_order_id` | string | Yes | Your order ID that was sent to Olympia (stored as `pharmacyOrderId` in ShippingOrder) |
| `status` | string | Yes | Order status (see Status Mapping below) |
| `tracking_number` | string | No | Carrier tracking number |
| `carrier` | string | No | Shipping carrier (ups, usps, fedex, dhl) |

### Status Mapping

The webhook maps Olympia statuses to internal `OrderShippingStatus`:

| Olympia Status | Internal Status | Description |
|---------------|-----------------|-------------|
| `pending` | `PENDING` | Order received, awaiting processing |
| `processing` | `PROCESSING` | Order is being processed |
| `shipped` | `SHIPPED` | Order has been shipped |
| `delivered` | `DELIVERED` | Order has been delivered |
| `cancelled` | `CANCELLED` | Order was cancelled |
| `rejected` | `REJECTED` | Order was rejected |
| `problem` | `PROBLEM` | Issue with the order |

## Example Request

```bash
curl -X POST https://backend.fusehealthstaging.xyz/webhook/olympia-pharmacy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret_token_here" \
  -d '{
    "vendor_order_id": "xyz_12345",
    "status": "shipped",
    "tracking_number": "1Z9646F62498366759",
    "carrier": "ups"
  }'
```

## Response

### Success Response

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

### Error Responses

**401 Unauthorized** - Missing or invalid authorization header
```json
{
  "success": false,
  "message": "Authorization header required"
}
```

**400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "message": "Missing required fields: vendor_order_id and status are required"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Tracking URL Generation

When a `carrier` and `tracking_number` are provided, the webhook automatically generates a tracking URL:

- **UPS**: `https://www.ups.com/track?tracknum={tracking_number}`
- **USPS**: `https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}`
- **FedEx**: `https://www.fedex.com/fedextrack/?trknbr={tracking_number}`
- **DHL**: `https://www.dhl.com/us-en/home/tracking.html?tracking-id={tracking_number}`

## Testing

### Local Testing with ngrok

1. Start your local server
2. Start ngrok: `ngrok http 3000`
3. Use the ngrok URL in your Olympia Pharmacy webhook configuration:
   ```
   https://your-ngrok-url.ngrok-free.app/webhook/olympia-pharmacy
   ```

### Production

Configure Olympia Pharmacy to send webhooks to:
```
https://backend.fusehealthstaging.xyz/webhook/olympia-pharmacy
```

or

```
https://backend.fusehealthproduction.xyz/webhook/olympia-pharmacy
```

## Security

- All webhook requests must include a valid Bearer token
- Rate limiting is applied (1000 requests per 15 minutes)
- Invalid requests are logged for security monitoring
- Detailed error messages are only shown in development mode

## Logging

The webhook logs the following events:

- ✅ Successful tracking updates
- ⚠️ ShippingOrder not found for vendor_order_id
- ❌ Error processing webhook
- 📦 Status changes
- 🔒 Authentication failures

## Database Updates

When a webhook is received, the following fields in `ShippingOrder` are updated:

- `status` - Updated based on status mapping
- `trackingNumber` - Set from `tracking_number` field
- `trackingUrl` - Auto-generated based on carrier
- `shippedAt` - Set when status becomes `shipped` (first time only)
- `deliveredAt` - Set when status becomes `delivered` (first time only)
