import "reflect-metadata";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import { initializeDatabase } from "./config/database";
import { isValidImageFile } from "./config/s3";
import { sequenceRoutes, webhookRoutes } from "./features/sequences";
import { templateRoutes } from "./features/templates";
import { contactRoutes } from "./features/contacts";
import { tagRoutes } from "./features/tags";
import { authRoutes } from "./features/auth";
import { clinicRoutes } from "./features/clinics";
import { customWebsiteRoutes } from "./features/custom-websites";
import { productRoutes } from "./features/products";
import { treatmentRoutes } from "./features/treatments";
import { orderRoutes } from "./features/orders";
import { subscriptionRoutes } from "./features/subscriptions";
import { questionnaireRoutes } from "./features/questionnaires";
import { adminRoutes } from "./features/admin";
import { stripeRoutes } from "./features/stripe";

// HIPAA Compliance Note: TLS certificate validation is enabled globally.
// Database SSL uses relaxed validation (rejectUnauthorized: false) because
// AWS RDS certificates aren't in Node's default CA store.
// All other HTTPS connections (Stripe, SendGrid, etc.) use full TLS validation.

const app = express();

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable is not set");
} else {
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Stripe secret key found, initializing...");
  }
}

// Validate APP_WEBHOOK_SECRET
if (!process.env.APP_WEBHOOK_SECRET) {
  console.error("❌ APP_WEBHOOK_SECRET environment variable is not set");
  process.exit(1);
}

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (isValidImageFile(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP images, and PDF files are allowed."
        )
      );
    }
  },
});

// HIPAA-compliant CORS configuration with explicit origin whitelisting
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);

      // SECURITY: Strict CORS configuration - no hardcoded IPs in production
      const allowedOrigins =
        process.env.NODE_ENV === "production"
          ? [
            process.env.FRONTEND_URL,
            // Add additional production domains via environment variables only
            process.env.ADDITIONAL_ALLOWED_ORIGINS?.split(",").map((o) =>
              o.trim()
            ),
          ]
            .flat()
            .filter(Boolean)
          : [
            "http://localhost:3000",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3005",
            "http://localhost:3030",
            // Development only - no production domains
          ];

      // SECURITY: Validate all origins are HTTPS in production
      if (process.env.NODE_ENV === "production") {
        const insecureOrigins = allowedOrigins.filter(
          (origin) =>
            typeof origin === "string" && !origin.startsWith("https://")
        );
        if (insecureOrigins.length > 0) {
          console.error(
            "❌ CRITICAL: HTTP origins not allowed in production:",
            insecureOrigins
          );
          throw new Error("All production origins must use HTTPS");
        }
      }
      // Check if origin is in allowed list or matches patterns
      const isAllowed =
        allowedOrigins.includes(origin) ||
        // Allow clinic subdomains in development
        (process.env.NODE_ENV === "development" &&
          /^http:\/\/[a-zA-Z0-9.-]+\.localhost:3000$/.test(origin)) ||
        // Allow production clinic domains
        (process.env.NODE_ENV === "production" &&
          /^https:\/\/app\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(origin)) ||
        // Allow fuse.health root domain and any subdomain
        (process.env.NODE_ENV === "production" &&
          /^https:\/\/([a-zA-Z0-9-]+\.)*fuse\.health$/.test(origin)) ||
        // Allow any origin containing fusehealth.com
        origin.includes("fusehealth.com") ||
        // Allow fusehealthstaging.xyz and all its subdomains
        /^https:\/\/([a-zA-Z0-9-]+\.)?fusehealthstaging\.xyz$/.test(origin) ||
        // Allow all subdomains of unboundedhealth.xyz (legacy support)
        /^https:\/\/[a-zA-Z0-9-]+\.unboundedhealth\.xyz$/.test(origin);

      if (isAllowed) {
        if (process.env.NODE_ENV === "development") {
          console.log(`✅ CORS allowed origin: ${origin}`);
        }
        callback(null, true);
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log(`❌ CORS blocked origin: ${origin}`);
        }
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Essential for cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false, // disable if frontend loads remote assets
  })
);

app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  })
);

app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.referrerPolicy({ policy: "no-referrer" }));

app.disable("x-powered-by");

// Conditional JSON parsing - exclude webhook paths that need raw body
app.use((req, res, next) => {
  if (
    req.path.startsWith("/webhook/stripe") ||
    req.path.startsWith("/md/webhooks")
  ) {
    next(); // Skip JSON parsing for webhook endpoints that need raw body
  } else {
    express.json()(req, res, next); // Apply JSON parsing for all other routes
  }
});

// ============================================================================
// REGISTER ALL FEATURE ROUTES
// ============================================================================

app.use("/", authRoutes);
app.use("/", clinicRoutes);
app.use("/", customWebsiteRoutes);
app.use("/", productRoutes);
app.use("/", treatmentRoutes);
app.use("/", orderRoutes);
app.use("/", subscriptionRoutes);
app.use("/", questionnaireRoutes);
app.use("/", adminRoutes);
app.use("/", stripeRoutes);
app.use("/", sequenceRoutes);
app.use("/", webhookRoutes);
app.use("/", templateRoutes);
app.use("/", contactRoutes);
app.use("/", tagRoutes);

// Health check endpoint
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

const PORT = process.env.PORT || 3001;

// Initialize database connection and start server
async function startServer() {
  const dbConnected = await initializeDatabase();

  if (!dbConnected) {
    console.error("❌ Failed to connect to database. Exiting...");
    process.exit(1);
  }

  const httpServer = app.listen(PORT, () => {
    console.log(`🚀 API listening on :${PORT}`);
    console.log("📊 Database connected successfully");
    console.log("🔒 HIPAA-compliant security features enabled");
    console.log("✨ All routes refactored to vertical slice architecture");
  });

  // Initialize WebSocket server
  const WebSocketService = (await import("./services/websocket.service"))
    .default;
  WebSocketService.initialize(httpServer);
  console.log("🔌 WebSocket server initialized");

  // Initialize Prescription Expiration Worker
  const PrescriptionExpirationWorker = (
    await import("./services/sequence/PrescriptionExpirationWorker")
  ).default;
  const prescriptionWorker = new PrescriptionExpirationWorker();
  prescriptionWorker.start();
  console.log("💊 Prescription expiration worker initialized");

  // Initialize Support Ticket Auto-Close Service
  const SupportTicketAutoCloseService = (await import('./services/supportTicketAutoClose.service')).default;
  const ticketAutoCloseService = new SupportTicketAutoCloseService();
  ticketAutoCloseService.start();
  console.log('🎫 Support ticket auto-close service initialized');

  // Start auto-approval service
  const AutoApprovalService = (await import("./services/autoApproval.service"))
    .default;
  AutoApprovalService.start();
  console.log("🤖 Auto-approval service started");
}

startServer();
