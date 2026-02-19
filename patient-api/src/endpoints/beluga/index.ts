import express, { Request, Response } from "express";
import { authenticateJWT, getCurrentUser } from "../../config/jwt";
import { MedicalCompanySlug } from "@fuse/enums";
import Order from "../../models/Order";
import User from "../../models/User";
import Clinic from "../../models/Clinic";
import Questionnaire from "../../models/Questionnaire";
import ShippingAddress from "../../models/ShippingAddress";
import TenantProduct from "../../models/TenantProduct";
import Product from "../../models/Product";
import BelugaProduct from "../../models/BelugaProduct";
import BelugaEvent, { BelugaEventType, BelugaMessageChannel, BelugaSenderRole } from "../../models/BelugaEvent";
import { Op } from "sequelize";
import fs from "fs";
import path from "path";

const router = express.Router();

interface BelugaAPIProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  strength?: string;
  raw?: any;
}

interface BelugaPatientPreference {
  name: string;
  strength: string;
  quantity: string;
  refills: string;
  daysSupply: string;
  medId: string;
}

const DEFAULT_BELUGA_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.belugahealth.com"
    : "https://api-staging.belugahealth.com";

const PRODUCT_ENDPOINT_CANDIDATES = [
  "/external/products",
  "/external/medications",
  "/external/offerings",
  "/products",
  "/medications",
];

const DEFAULT_BELUGA_COMPANY_CANDIDATES: string[] = [];
const DEFAULT_BELUGA_VISIT_TYPE_CANDIDATES = ["asynchronous", "synchronous"];

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const onlyDigits = (value: string): string => value.replace(/\D/g, "");

const formatDobForBeluga = (value?: string): string | undefined => {
  const raw = toNonEmptyString(value);
  if (!raw) return undefined;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    return `${iso[2]}/${iso[3]}/${iso[1]}`;
  }

  const us = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (us) {
    return `${us[1]}/${us[2]}/${us[3]}`;
  }

  return undefined;
};

const normalizeBelugaSex = (value?: string): "Male" | "Female" | undefined => {
  const raw = toNonEmptyString(value)?.toLowerCase();
  if (!raw) return undefined;
  if (raw.startsWith("m")) return "Male";
  if (raw.startsWith("f")) return "Female";
  return undefined;
};

const readEnvValueFromEnvLocal = (key: string): string | undefined => {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(process.cwd(), "..", "..", ".env.local"),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      const content = fs.readFileSync(candidatePath, "utf8");
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = content.match(new RegExp(`^${escapedKey}\\s*=\\s*(.+)$`, "m"));
      const raw = match?.[1]?.trim();
      if (!raw) continue;

      const unquoted = raw.replace(/^['"]|['"]$/g, "");
      const normalized = toNonEmptyString(unquoted);
      if (normalized) return normalized;
    } catch {
      // Non-blocking fallback lookup
    }
  }

  return undefined;
};

const resolveBelugaBaseUrl = (): string => {
  return (
    toNonEmptyString(process.env.BELUGA_BASE_URL) ||
    readEnvValueFromEnvLocal("BELUGA_BASE_URL") ||
    DEFAULT_BELUGA_BASE_URL
  );
};

const resolveBelugaApiKey = (): string | null => {
  const key =
    toNonEmptyString(process.env.BELUGA_API_KEY) ||
    readEnvValueFromEnvLocal("BELUGA_API_KEY");
  return key || null;
};

const buildBelugaUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${resolveBelugaBaseUrl().replace(/\/+$/, "")}/${pathOrUrl.replace(/^\/+/, "")}`;
};

const belugaRequest = async (
  pathOrUrl: string,
  init?: { method?: "GET" | "POST"; body?: any },
  options?: { allowHttpErrors?: boolean }
): Promise<{ statusCode: number; payload: any }> => {
  const apiKey = resolveBelugaApiKey();
  if (!apiKey) {
    throw new Error("BELUGA_API_KEY is not configured");
  }

  const method = init?.method || "GET";
  const url = buildBelugaUrl(pathOrUrl);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const rawText = await response.text();
  let payload: any = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { raw: rawText };
  }

  if (!response.ok && !options?.allowHttpErrors) {
    const error = new Error(`Beluga request failed with HTTP ${response.status}`);
    (error as any).statusCode = response.status;
    (error as any).payload = payload;
    throw error;
  }

  return { statusCode: response.status, payload };
};

const normalizeBelugaProducts = (payload: any): BelugaAPIProduct[] => {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.products)
        ? payload.products
        : Array.isArray(payload?.offerings)
          ? payload.offerings
          : Array.isArray(payload?.items)
            ? payload.items
            : [];

  const normalized = candidates
    .map((item: any): BelugaAPIProduct | null => {
      const id =
        toNonEmptyString(item?.medId) ||
        toNonEmptyString(item?.productId) ||
        toNonEmptyString(item?.offering_id) ||
        toNonEmptyString(item?.id);
      const name =
        toNonEmptyString(item?.name) ||
        toNonEmptyString(item?.title) ||
        (id ? `Beluga Product ${id}` : undefined);

      if (!id || !name) return null;

      return {
        id,
        name,
        description: toNonEmptyString(item?.description),
        category: toNonEmptyString(item?.category),
        type: toNonEmptyString(item?.type),
        strength:
          toNonEmptyString(item?.strength) ||
          toNonEmptyString(item?.dosage) ||
          toNonEmptyString(item?.sig),
        raw: item,
      };
    })
    .filter((item): item is BelugaAPIProduct => Boolean(item));

  const deduped = new Map<string, BelugaAPIProduct>();
  for (const product of normalized) {
    if (!deduped.has(product.id)) {
      deduped.set(product.id, product);
    }
  }
  return Array.from(deduped.values());
};

const getBelugaErrorText = (payload: any): string => {
  const raw =
    toNonEmptyString(payload?.error) ||
    toNonEmptyString(payload?.info) ||
    toNonEmptyString(payload?.message) ||
    toNonEmptyString(payload?.data) ||
    toNonEmptyString(payload?.raw) ||
    "";
  return raw.toLowerCase();
};

const mapVisitResponseToProducts = (payload: any): BelugaAPIProduct[] => {
  const formObj = payload?.data?.formObj || payload?.formObj;
  const preferences = Array.isArray(formObj?.patientPreference) ? formObj.patientPreference : [];

  return preferences
    .map((item: any): BelugaAPIProduct | null => {
      const id = toNonEmptyString(item?.medId);
      if (!id) return null;
      return {
        id,
        name: toNonEmptyString(item?.name) || `Beluga Product ${id}`,
        strength: toNonEmptyString(item?.strength),
        description: toNonEmptyString(item?.name),
      };
    })
    .filter((item): item is BelugaAPIProduct => Boolean(item));
};

const dedupeProducts = (items: BelugaAPIProduct[]): BelugaAPIProduct[] => {
  const map = new Map<string, BelugaAPIProduct>();
  for (const item of items) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
};

const fetchBelugaProductsFromRecentVisits = async (): Promise<BelugaAPIProduct[]> => {
  const orders = await Order.findAll({
    where: {
      questionnaireId: { [Op.ne]: null } as any,
    } as any,
    order: [["createdAt", "DESC"]] as any,
    limit: 75,
  } as any);

  const collected: BelugaAPIProduct[] = [];

  for (const order of orders) {
    try {
      const questionnaire = await Questionnaire.findByPk((order as any).questionnaireId);
      if (!questionnaire || questionnaire.medicalCompanySource !== MedicalCompanySlug.BELUGA) {
        continue;
      }

      const masterId = String((order as any).id);
      const visitResponse = await belugaRequest(
        `/visit/externalFetch/${encodeURIComponent(masterId)}`,
        { method: "GET" },
        { allowHttpErrors: true }
      );

      if (visitResponse.statusCode >= 400 || visitResponse.payload?.status !== 200) {
        continue;
      }

      collected.push(...mapVisitResponseToProducts(visitResponse.payload));
    } catch {
      // Non-blocking: keep collecting from other masterIds
    }
  }

  return dedupeProducts(collected);
};

const fetchBelugaProductsFromLocalMappings = async (): Promise<BelugaAPIProduct[]> => {
  const mappedProducts = await Product.findAll({
    where: {
      belugaProductId: { [Op.ne]: null } as any,
    } as any,
    attributes: ["id", "name", "description", "belugaProductId", "placeholderSig"] as any,
    order: [["updatedAt", "DESC"]] as any,
    limit: 300,
  } as any);

  const normalized = mappedProducts
    .map((item: any): BelugaAPIProduct | null => {
      const id = toNonEmptyString(item?.belugaProductId);
      if (!id) return null;
      return {
        id,
        name: toNonEmptyString(item?.name) || `Beluga Product ${id}`,
        description: toNonEmptyString(item?.description) || "Mapped from local product",
        strength: toNonEmptyString(item?.placeholderSig),
      };
    })
    .filter((item): item is BelugaAPIProduct => Boolean(item));

  return dedupeProducts(normalized);
};

const fetchBelugaProducts = async (): Promise<{ products: BelugaAPIProduct[]; source: string; warning?: string }> => {
  const configuredEndpoint = toNonEmptyString(process.env.BELUGA_PRODUCTS_ENDPOINT);
  const endpointsToTry = configuredEndpoint
    ? [configuredEndpoint]
    : PRODUCT_ENDPOINT_CANDIDATES;

  let lastError: any = null;

  for (const endpoint of endpointsToTry) {
    try {
      const getResponse = await belugaRequest(endpoint, { method: "GET" }, { allowHttpErrors: true });
      let parsed = normalizeBelugaProducts(getResponse.payload);

      if (parsed.length === 0 && (getResponse.statusCode === 405 || getResponse.statusCode === 404)) {
        const postResponse = await belugaRequest(endpoint, { method: "POST", body: {} }, { allowHttpErrors: true });
        parsed = normalizeBelugaProducts(postResponse.payload);
      }

      if (parsed.length > 0) {
        return { products: parsed, source: endpoint };
      }
    } catch (error) {
      lastError = error;
    }
  }

  // If Beluga does not expose product-list endpoint, derive medIds dynamically from existing Beluga visits.
  const fromVisits = await fetchBelugaProductsFromRecentVisits();
  if (fromVisits.length > 0) {
    return { products: fromVisits, source: "derived-from-beluga-visits" };
  }

  // Final fallback: IDs already mapped in local products table.
  const fromLocalMappings = await fetchBelugaProductsFromLocalMappings();
  if (fromLocalMappings.length > 0) {
    return { products: fromLocalMappings, source: "local-product-beluga-mappings" };
  }

  if (lastError) {
    return {
      products: [],
      source: "unavailable",
      warning:
        "Unable to discover Beluga products automatically from this account yet. Add product mappings manually first, then products will appear here.",
    };
  }

  return {
    products: [],
    source: "unavailable",
    warning:
      "Beluga does not expose a product list endpoint in the provided API docs. Products will appear here once mapped or once visits exist.",
  };
};

const findAnswerFromQuestionnaire = (answers: Record<string, any>, terms: string[]): string | undefined => {
  const normalizedTerms = terms.map((term) => term.toLowerCase());
  
  // Handle new structured format: { answers: [{questionText, answer}], metadata }
  if (answers.answers && Array.isArray(answers.answers)) {
    for (const item of answers.answers) {
      const questionText = item.questionText || item.questionId || '';
      const normalizedQuestion = questionText.toLowerCase();
      
      if (normalizedTerms.some((term) => normalizedQuestion.includes(term))) {
        const value = item.answer;
        if (Array.isArray(value)) {
          const content = value
            .map((item) => (item == null ? "" : String(item).trim()))
            .filter(Boolean)
            .join("; ");
          if (content) return content;
        }
        const valueAsString = toNonEmptyString(String(value ?? ""));
        if (valueAsString) return valueAsString;
      }
    }
  }
  
  // Handle old flat format: { "Question?": "Answer" }
  for (const [key, value] of Object.entries(answers)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedTerms.some((term) => normalizedKey.includes(term))) {
      if (Array.isArray(value)) {
        const content = value
          .map((item) => (item == null ? "" : String(item).trim()))
          .filter(Boolean)
          .join("; ");
        if (content) return content;
      }
      const valueAsString = toNonEmptyString(String(value ?? ""));
      if (valueAsString) return valueAsString;
    }
  }
  return undefined;
};

const collectBelugaCustomQuestions = (answers: Record<string, any>, questionnaire?: Questionnaire | null) => {
  const excludedTerms = [
    "first name",
    "last name",
    "email",
    "phone",
    "mobile",
    "dob",
    "date of birth",
    "gender",
    "sex",
    "address",
    "city",
    "state",
    "zip",
    "self reported meds",
    "selfreportedmeds",
    "allergies",
    "medical conditions",
    "medicalconditions",
  ];

  // Build a map of question text -> question options for multiple-choice questions
  const questionOptionsMap = new Map<string, string[]>();
  if (questionnaire) {
    const steps = (questionnaire as any).steps || [];
    for (const step of steps) {
      const questions = (step as any).questions || [];
      for (const q of questions) {
        const questionText = toNonEmptyString(q.questionText);
        const answerType = toNonEmptyString(q.answerType);
        
        // For multiple-choice questions, store their options
        if (questionText && (answerType === 'multiple_choice' || answerType === 'single_choice' || answerType === 'radio')) {
          const options = Array.isArray(q.options) ? q.options : [];
          const optionTexts = options
            .map((opt: any) => toNonEmptyString(opt.text || opt.label || opt))
            .filter(Boolean);
          
          if (optionTexts.length > 0) {
            questionOptionsMap.set(questionText, optionTexts);
          }
        }
      }
    }
  }

  const result: Record<string, string> = {};
  let index = 1;

  // Handle both new structured format and old flat format
  let answerEntries: Array<[string, any]> = [];
  
  if (answers.answers && Array.isArray(answers.answers)) {
    // New structured format: { answers: [{questionText, answer, ...}], metadata: {...} }
    for (const item of answers.answers) {
      if (item.questionText && item.answer !== undefined) {
        answerEntries.push([item.questionText, item.answer]);
      }
    }
  } else {
    // Old flat format: { "Question?": "Answer" }
    answerEntries = Object.entries(answers);
  }

  for (const [question, answer] of answerEntries) {
    const normalizedQuestion = question.toLowerCase();
    if (excludedTerms.some((term) => normalizedQuestion.includes(term))) {
      continue;
    }

    let answerText = "";
    if (Array.isArray(answer)) {
      answerText = answer.map((v) => String(v ?? "").trim()).filter(Boolean).join("; ");
    } else if (typeof answer === "object" && answer !== null) {
      answerText = JSON.stringify(answer);
    } else {
      answerText = String(answer ?? "").trim();
    }

    if (!answerText) continue;

    // For Beluga API: append "POSSIBLE ANSWERS: option1; option2; option3" for multiple-choice questions
    let questionText = question;
    const options = questionOptionsMap.get(question);
    if (options && options.length > 0) {
      questionText = `${question} POSSIBLE ANSWERS: ${options.join("; ")}`;
    }

    result[`Q${index}`] = questionText;
    result[`A${index}`] = answerText;
    index += 1;
  }

  return result;
};

const dedupeStrings = (values: Array<string | undefined | null>): string[] => {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = toNonEmptyString(value || "");
    if (normalized) set.add(normalized);
  }
  return Array.from(set);
};

const normalizeSlugCandidate = (value?: string): string | undefined => {
  const raw = toNonEmptyString(value)?.toLowerCase();
  if (!raw) return undefined;
  return raw.replace(/[^a-z0-9]/g, "");
};

const resolveBelugaCompanyCandidates = (clinic: Clinic | null, requestedCompany?: string): string[] => {
  // Prioritize environment variable if set
  const envCompanyId = toNonEmptyString(process.env.BELUGA_COMPANY_ID) || 
                       readEnvValueFromEnvLocal("BELUGA_COMPANY_ID");
  
  const clinicName = toNonEmptyString((clinic as any)?.name);
  const clinicSlug = toNonEmptyString((clinic as any)?.slug);
  return dedupeStrings([
    envCompanyId, // Try environment config first
    requestedCompany,
    clinicSlug,
    normalizeSlugCandidate(clinicSlug),
    clinicName,
    normalizeSlugCandidate(clinicName),
    ...DEFAULT_BELUGA_COMPANY_CANDIDATES,
  ]);
};

const resolveBelugaVisitTypeCandidates = (params: {
  requestedVisitType?: string;
  questionnaire?: Questionnaire | null;
  state?: string;
  patientVisitType?: string;
}): string[] => {
  // Prioritize environment variable if set
  const envVisitType = toNonEmptyString(process.env.BELUGA_DEFAULT_VISIT_TYPE) ||
                       readEnvValueFromEnvLocal("BELUGA_DEFAULT_VISIT_TYPE");
  
  const state = toNonEmptyString(params.state)?.toUpperCase();
  const questionnaireVisitType =
    state && params.questionnaire?.visitTypeByState
      ? ((params.questionnaire.visitTypeByState as any)[state] as string | undefined)
      : undefined;

  return dedupeStrings([
    envVisitType, // Try environment config first
    params.requestedVisitType,
    params.patientVisitType,
    questionnaireVisitType,
    ...DEFAULT_BELUGA_VISIT_TYPE_CANDIDATES,
  ]);
};

const extractBelugaPharmacyIds = (payload: any): string[] => {
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return dedupeStrings(
    list.map((item: any) => {
      const id = item?.PharmacyId ?? item?.pharmacyId ?? item?.id;
      return id == null ? undefined : String(id);
    })
  );
};

const resolveBelugaPharmacyCandidates = async (params: {
  requestedPharmacyId?: string;
  zip?: string;
  city?: string;
  state?: string;
}): Promise<string[]> => {
  console.log('🏥 [PHARMACY] Starting pharmacy search with params:', params);
  const candidates = new Set<string>();
  const requested = toNonEmptyString(params.requestedPharmacyId);
  if (requested) {
    console.log('🏥 [PHARMACY] Using requested pharmacyId:', requested);
    candidates.add(requested);
  }

  const searches = [
    { zip: params.zip, state: params.state },
    { city: params.city, state: params.state },
    { city: params.city },
    { state: params.state },
  ];

  for (const search of searches) {
    const body: Record<string, string> = {};
    const zip = onlyDigits(String(search.zip || ""));
    const city = toNonEmptyString(search.city || "");
    const state = toNonEmptyString(search.state || "")?.toUpperCase();
    if (zip) body.zip = zip;
    if (city) body.city = city;
    if (state) body.state = state;
    if (Object.keys(body).length === 0) continue;

    console.log('🏥 [PHARMACY] Searching Beluga API with:', body);
    try {
      const response = await belugaRequest("/external/pharmacies", { method: "POST", body }, { allowHttpErrors: true });
      console.log('🏥 [PHARMACY] API response status:', response.statusCode);
      console.log('🏥 [PHARMACY] API response payload:', JSON.stringify(response.payload, null, 2));
      
      const ids = extractBelugaPharmacyIds(response.payload);
      console.log('🏥 [PHARMACY] Extracted pharmacy IDs:', ids);
      
      ids.slice(0, 8).forEach((id) => candidates.add(id));
      if (candidates.size >= 8) break;
    } catch (error: any) {
      console.log('⚠️ [PHARMACY] API call failed:', error?.message || error);
      // Continue trying broader searches
    }
  }

  console.log('🏥 [PHARMACY] Final candidates:', Array.from(candidates));
  return Array.from(candidates);
};

const getBelugaPatientHistoryHints = async (phone: string): Promise<{ visitType?: string }> => {
  try {
    const patientResponse = await belugaRequest(`/patient/externalFetch/${phone}`, { method: "GET" }, { allowHttpErrors: true });
    if (patientResponse.statusCode >= 400 || patientResponse.payload?.status !== 200) {
      return {};
    }

    const visits = Array.isArray(patientResponse.payload?.data?.visits) ? patientResponse.payload.data.visits : [];
    const latestMasterId = visits[0];
    if (!latestMasterId) return {};

    const visitResponse = await belugaRequest(`/visit/externalFetch/${encodeURIComponent(String(latestMasterId))}`, { method: "GET" }, {
      allowHttpErrors: true,
    });
    if (visitResponse.statusCode >= 400 || visitResponse.payload?.status !== 200) {
      return {};
    }

    const visitType = toNonEmptyString(visitResponse.payload?.data?.visitType);
    return { visitType };
  } catch {
    return {};
  }
};

const getBelugaPatientMasterIdsByPhone = async (phone: string): Promise<string[]> => {
  try {
    const patientResponse = await belugaRequest(`/patient/externalFetch/${phone}`, { method: "GET" }, { allowHttpErrors: true });
    if (patientResponse.statusCode >= 400 || patientResponse.payload?.status !== 200) {
      return [];
    }

    const visits = Array.isArray(patientResponse.payload?.data?.visits) ? patientResponse.payload.data.visits : [];
    return visits
      .map((item: unknown) => toNonEmptyString(String(item ?? "")))
      .filter((item): item is string => Boolean(item));
  } catch {
    return [];
  }
};

const normalizeBelugaPatientPreferenceArray = (value: unknown): BelugaPatientPreference[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any): BelugaPatientPreference | null => {
      const name = toNonEmptyString(item?.name);
      const strength = toNonEmptyString(item?.strength);
      const quantity = toNonEmptyString(item?.quantity);
      const refills = toNonEmptyString(item?.refills);
      const daysSupply = toNonEmptyString(item?.daysSupply);
      const medId = toNonEmptyString(item?.medId);

      if (!name || !strength || !quantity || !refills || !daysSupply || !medId) {
        return null;
      }

      return {
        name,
        strength,
        quantity,
        refills,
        daysSupply,
        medId,
      };
    })
    .filter((item): item is BelugaPatientPreference => Boolean(item));
};

const normalizeBelugaPhotos = (input: unknown): Array<{ mime: "image/jpeg"; data: string }> => {
  if (!Array.isArray(input)) return [];

  return input
    .map((item: any): { mime: "image/jpeg"; data: string } | null => {
      const mimeRaw = toNonEmptyString(item?.mime)?.toLowerCase();
      const data = toNonEmptyString(item?.data);
      if (!data) return null;
      if (mimeRaw !== "image/jpeg") return null;
      return { mime: "image/jpeg", data };
    })
    .filter((item): item is { mime: "image/jpeg"; data: string } => Boolean(item));
};

const submitBelugaPhotos = async (
  visitId: string,
  images: Array<{ mime: "image/jpeg"; data: string }>
) => {
  if (images.length === 0) {
    return { attempted: false, reason: "no_images_provided" as const };
  }

  const response = await belugaRequest(
    "/external/receivePhotos",
    {
      method: "POST",
      body: {
        visitId,
        images,
      },
    },
    { allowHttpErrors: true }
  );

  const success = response.statusCode < 400 && response.payload?.status === 200;
  return {
    attempted: true,
    success,
    statusCode: response.statusCode,
    payload: response.payload,
    visitId,
  };
};

const resolveBelugaWebhookSecret = (): string | undefined => {
  return (
    toNonEmptyString(process.env.FUSE_BELUGA_WEBHOOK_SECRET) ||
    readEnvValueFromEnvLocal("FUSE_BELUGA_WEBHOOK_SECRET")
  );
};

const isBelugaWebhookAuthorized = (req: Request): { authorized: boolean; configError?: boolean } => {
  const expectedSecret = resolveBelugaWebhookSecret();
  if (!expectedSecret) return { authorized: false, configError: true };

  const authHeader = toNonEmptyString(String(req.headers.authorization || ""));
  const headerSecret = toNonEmptyString(String(req.headers["x-beluga-webhook-secret"] || ""));
  if (headerSecret && headerSecret === expectedSecret) return { authorized: true };

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = toNonEmptyString(authHeader.slice(7));
    if (token === expectedSecret) return { authorized: true };
  }

  return { authorized: false };
};

const findBelugaOrderByMasterId = async (masterId: string): Promise<Order | null> => {
  const byBelugaMaster = await Order.findOne({
    where: {
      belugaMasterId: masterId,
    } as any,
  } as any);
  if (byBelugaMaster) return byBelugaMaster;

  const byOrderId = await Order.findByPk(masterId);
  if (byOrderId) return byOrderId;
  return null;
};

const storeBelugaEvent = async (params: {
  masterId: string;
  eventType: BelugaEventType;
  senderRole: BelugaSenderRole;
  channel?: BelugaMessageChannel;
  source: "webhook" | "outbound";
  message?: string;
  payload?: Record<string, any>;
  userId?: string | null;
  orderId?: string | null;
}) => {
  return BelugaEvent.create({
    userId: params.userId || null,
    orderId: params.orderId || null,
    masterId: params.masterId,
    eventType: params.eventType,
    senderRole: params.senderRole,
    channel: params.channel || "system",
    message: params.message || null,
    source: params.source,
    payload: params.payload || null,
  } as any);
};

const mapBelugaIncomingEvent = (event: string): {
  eventType: BelugaEventType;
  senderRole: BelugaSenderRole;
  channel: BelugaMessageChannel;
  message?: string;
} | null => {
  switch (event) {
    case "DOCTOR_CHAT":
      return { eventType: "DOCTOR_CHAT", senderRole: "doctor", channel: "patient_chat" };
    case "CS_MESSAGE":
      return { eventType: "CS_MESSAGE", senderRole: "beluga_admin", channel: "customer_service" };
    case "RX_WRITTEN":
      return { eventType: "RX_WRITTEN", senderRole: "system", channel: "system" };
    case "CONSULT_CONCLUDED":
      return { eventType: "CONSULT_CONCLUDED", senderRole: "system", channel: "system" };
    case "CONSULT_CANCELED":
      return { eventType: "CONSULT_CANCELED", senderRole: "system", channel: "system" };
    case "NAME_UPDATE":
      return { eventType: "NAME_UPDATE", senderRole: "system", channel: "system" };
    default:
      return null;
  }
};

router.get("/products", authenticateJWT, async (_req: Request, res: Response) => {
  try {
    const { products, source, warning } = await fetchBelugaProducts();
    return res.json({
      success: true,
      data: products,
      count: products.length,
      source,
      ...(warning ? { warning } : {}),
    });
  } catch (error: any) {
    console.error("❌ Error fetching Beluga products:", error?.message || error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: "Failed to fetch Beluga products",
      details: error?.payload || error?.message || null,
    });
  }
});

router.get("/products/:productId", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { products } = await fetchBelugaProducts();
    const product = products.find((item) => item.id === productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Beluga product not found",
      });
    }

    return res.json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    console.error("❌ Error fetching Beluga product:", error?.message || error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: "Failed to fetch Beluga product",
      details: error?.payload || error?.message || null,
    });
  }
});

/**
 * GET /beluga/my-visits
 * Returns all Beluga visits for the authenticated user, sourced from their Orders.
 * Each visit is enriched with live data from the Beluga API.
 */
router.get("/my-visits", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findByPk(currentUser.id);
    const userPhone = onlyDigits(toNonEmptyString((user as any)?.phoneNumber || "") || "");

    const orders = await Order.findAll({
      where: {
        userId: currentUser.id,
        belugaMasterId: { [Op.ne]: null },
      } as any,
      attributes: ["id", "belugaMasterId", "belugaVisitId", "status", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    const orderByMasterId = new Map<string, Order>();
    for (const order of orders) {
      const masterId = toNonEmptyString(String((order as any).belugaMasterId || ""));
      if (!masterId || orderByMasterId.has(masterId)) continue;
      orderByMasterId.set(masterId, order);
    }

    if (userPhone.length === 10) {
      const phoneMasterIds = await getBelugaPatientMasterIdsByPhone(userPhone);
      for (const masterId of phoneMasterIds) {
        if (!orderByMasterId.has(masterId)) {
          orderByMasterId.set(masterId, null as any);
        }
      }
    }

    const masterIds = Array.from(orderByMasterId.keys());
    const visits = await Promise.all(
      masterIds.map(async (masterId) => {
        const order = orderByMasterId.get(masterId) || null;
        const belugaVisitId = toNonEmptyString(String((order as any)?.belugaVisitId || ""));

        let visitData: any = null;
        try {
          const response = await belugaRequest(`/visit/externalFetch/${encodeURIComponent(masterId)}`, { method: "GET" }, { allowHttpErrors: true });
          if (response.statusCode === 200 && response.payload?.status === 200) {
            visitData = response.payload;
          }
        } catch {
          // Visit data unavailable; return what we have
        }

        return {
          orderId: String((order as any)?.id || masterId),
          masterId,
          belugaVisitId: belugaVisitId || toNonEmptyString(visitData?.data?.visitId) || null,
          orderStatus: (order as any)?.status || null,
          orderCreatedAt: (order as any)?.createdAt || null,
          visitStatus: visitData?.visitStatus || null,
          resolvedStatus: visitData?.resolvedStatus || null,
          updateTimestamp: visitData?.updateTimestamp || null,
          visitType: visitData?.data?.visitType || null,
          formObj: visitData?.data?.formObj || null,
          rxHistory: Array.isArray(visitData?.data?.rxHistory) ? visitData.data.rxHistory : [],
        };
      })
    );

    visits.sort((a, b) => {
      const aTime = new Date(a.orderCreatedAt || a.updateTimestamp || 0).getTime();
      const bTime = new Date(b.orderCreatedAt || b.updateTimestamp || 0).getTime();
      return bTime - aTime;
    });

    return res.json({ success: true, data: visits });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to fetch Beluga visits",
      details: error?.message || null,
    });
  }
});

router.get("/visits/:masterId", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const masterId = toNonEmptyString(req.params.masterId);
    if (!masterId) {
      return res.status(400).json({ success: false, message: "masterId is required" });
    }
    const response = await belugaRequest(`/visit/externalFetch/${encodeURIComponent(masterId)}`);
    return res.json({ success: true, data: response.payload });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to fetch Beluga visit",
      details: error?.payload || error?.message || null,
    });
  }
});

router.get("/patients/:phone", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const phone = onlyDigits(req.params.phone || "");
    if (phone.length !== 10) {
      return res.status(400).json({ success: false, message: "phone must contain exactly 10 digits" });
    }
    const response = await belugaRequest(`/patient/externalFetch/${phone}`);
    return res.json({ success: true, data: response.payload });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to fetch Beluga patient",
      details: error?.payload || error?.message || null,
    });
  }
});

router.get("/pharmacies", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const body: Record<string, string> = {};
    const name = toNonEmptyString(String(req.query.name || ""));
    const city = toNonEmptyString(String(req.query.city || ""));
    const state = toNonEmptyString(String(req.query.state || ""))?.toUpperCase();
    const zip = onlyDigits(String(req.query.zip || ""));

    if (name) body.name = name;
    if (city) body.city = city;
    if (state) body.state = state;
    if (zip) body.zip = zip;

    if (Object.keys(body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one search parameter is required (name, city, state, zip)",
      });
    }

    const response = await belugaRequest("/external/pharmacies", {
      method: "POST",
      body,
    });
    return res.json({ success: true, data: response.payload });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to fetch Beluga pharmacies",
      details: error?.payload || error?.message || null,
    });
  }
});

/**
 * POST /beluga/webhook
 * Receives webhook events from Beluga (doctor chat, CS chat, rx written, consult status, name updates).
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const authResult = isBelugaWebhookAuthorized(req);
    if (authResult.configError) {
      console.error("BELUGA_WEBHOOK_SECRET environment variable is not set");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }
    if (!authResult.authorized) {
      console.warn("⚠️ Invalid Beluga webhook authorization");
      return res.status(403).json({ success: false, message: "Invalid Beluga webhook authorization" });
    }

    const masterId = toNonEmptyString(req.body?.masterId);
    const event = toNonEmptyString(req.body?.event);
    if (!masterId || !event) {
      return res.status(400).json({
        success: false,
        message: "masterId and event are required",
      });
    }

    const mapped = mapBelugaIncomingEvent(event);
    if (!mapped) {
      return res.status(400).json({
        success: false,
        message: `Unsupported Beluga event: ${event}`,
      });
    }

    const order = await findBelugaOrderByMasterId(masterId);
    const orderId = order?.id ? String(order.id) : null;
    const userId = (order as any)?.userId ? String((order as any).userId) : null;

    if (mapped.eventType === "NAME_UPDATE" && order?.id) {
      const firstName = toNonEmptyString(req.body?.firstName);
      const lastName = toNonEmptyString(req.body?.lastName);
      if (firstName && lastName && userId) {
        await User.update(
          { firstName, lastName } as any,
          {
            where: { id: userId } as any,
          } as any
        );
      }
    }

    const message =
      mapped.eventType === "DOCTOR_CHAT" || mapped.eventType === "CS_MESSAGE"
        ? toNonEmptyString(req.body?.content) || ""
        : undefined;

    await storeBelugaEvent({
      masterId,
      eventType: mapped.eventType,
      senderRole: mapped.senderRole,
      channel: mapped.channel,
      source: "webhook",
      message,
      payload: req.body || null,
      userId,
      orderId,
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to process Beluga webhook",
      details: error?.message || null,
    });
  }
});

router.get("/chats/:masterId/messages", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser?.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const masterId = toNonEmptyString(req.params.masterId);
    if (!masterId) {
      return res.status(400).json({ success: false, message: "masterId is required" });
    }

    const order = await findBelugaOrderByMasterId(masterId);
    if (!order || String((order as any).userId) !== String(currentUser.id)) {
      return res.status(404).json({
        success: false,
        message: "Beluga visit not found for current user",
      });
    }

    const messages = await BelugaEvent.findAll({
      where: {
        masterId,
        eventType: {
          [Op.in]: ["DOCTOR_CHAT", "CS_MESSAGE", "PATIENT_CHAT", "PATIENT_CS_MESSAGE"] as any,
        } as any,
      } as any,
      order: [["createdAt", "ASC"]] as any,
    } as any);

    return res.json({
      success: true,
      data: messages.map((item: any) => ({
        id: item.id,
        masterId: item.masterId,
        eventType: item.eventType,
        senderRole: item.senderRole,
        channel: item.channel,
        message: item.message,
        source: item.source,
        createdAt: item.createdAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to load Beluga chat messages",
      details: error?.message || null,
    });
  }
});

router.post("/messages/patient", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser?.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { masterId, content, isMedia } = req.body || {};
    const resolvedMasterId = toNonEmptyString(masterId);
    const resolvedContent = toNonEmptyString(content);

    if (!resolvedMasterId || !resolvedContent) {
      return res.status(400).json({
        success: false,
        message: "masterId and content are required",
      });
    }

    const order = await findBelugaOrderByMasterId(resolvedMasterId);
    if (!order || String((order as any).userId) !== String(currentUser.id)) {
      return res.status(404).json({
        success: false,
        message: "Beluga visit not found for current user",
      });
    }

    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const firstName = toNonEmptyString(user.firstName) || "Patient";
    const lastName = toNonEmptyString(user.lastName) || "User";

    const response = await belugaRequest("/external/receiveChat", {
      method: "POST",
      body: {
        firstName,
        lastName,
        content: resolvedContent,
        isMedia: Boolean(isMedia),
        masterId: resolvedMasterId,
      },
    });

    await storeBelugaEvent({
      masterId: resolvedMasterId,
      eventType: "PATIENT_CHAT",
      senderRole: "patient",
      channel: "patient_chat",
      source: "outbound",
      message: resolvedContent,
      payload: {
        isMedia: Boolean(isMedia),
      },
      userId: String(currentUser.id),
      orderId: String(order.id),
    });

    return res.json({
      success: true,
      data: response.payload,
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to send Beluga patient message",
      details: error?.payload || error?.message || null,
    });
  }
});

router.post("/messages/customer-service", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser?.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { masterId, content } = req.body || {};
    const resolvedMasterId = toNonEmptyString(masterId);
    const resolvedContent = toNonEmptyString(content);

    if (!resolvedMasterId || !resolvedContent) {
      return res.status(400).json({
        success: false,
        message: "masterId and content are required",
      });
    }

    const order = await findBelugaOrderByMasterId(resolvedMasterId);
    if (!order || String((order as any).userId) !== String(currentUser.id)) {
      return res.status(404).json({
        success: false,
        message: "Beluga visit not found for current user",
      });
    }

    const response = await belugaRequest("/external/receiveCSMessage", {
      method: "POST",
      body: {
        content: resolvedContent,
        masterId: resolvedMasterId,
      },
    });

    await storeBelugaEvent({
      masterId: resolvedMasterId,
      eventType: "PATIENT_CS_MESSAGE",
      senderRole: "patient",
      channel: "customer_service",
      source: "outbound",
      message: resolvedContent,
      payload: undefined,
      userId: String(currentUser.id),
      orderId: String(order.id),
    });

    return res.json({
      success: true,
      data: response.payload,
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to send Beluga customer service message",
      details: error?.payload || error?.message || null,
    });
  }
});

router.post("/patients/:masterId/name", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const masterId = toNonEmptyString(req.params.masterId);
    const firstName = toNonEmptyString(req.body?.firstName);
    const lastName = toNonEmptyString(req.body?.lastName);

    if (!masterId || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "masterId, firstName and lastName are required",
      });
    }

    const response = await belugaRequest("/external/patientName", {
      method: "POST",
      body: {
        masterId,
        firstName,
        lastName,
      },
    });

    return res.json({
      success: true,
      data: response.payload,
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to update Beluga patient name",
      details: error?.payload || error?.message || null,
    });
  }
});

router.post("/visits/:masterId/preferences", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser?.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const masterId = toNonEmptyString(req.params.masterId);
    const patientPreference = normalizeBelugaPatientPreferenceArray(req.body?.patientPreference);
    const requestedPharmacyId = toNonEmptyString(req.body?.pharmacyId);
    if (!masterId || patientPreference.length === 0) {
      return res.status(400).json({
        success: false,
        message: "masterId and patientPreference[] with required fields are required",
      });
    }

    const user = await User.findByPk(currentUser.id);
    const phone = onlyDigits(toNonEmptyString((user as any)?.phoneNumber || "") || "");
    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Current user must have a valid 10-digit phone number to update Beluga preferences",
      });
    }

    const visitResponse = await belugaRequest(`/visit/externalFetch/${encodeURIComponent(masterId)}`, { method: "GET" }, { allowHttpErrors: true });
    if (visitResponse.statusCode >= 400 || visitResponse.payload?.status !== 200) {
      return res.status(404).json({
        success: false,
        message: "Beluga visit not found",
        details: visitResponse.payload || null,
      });
    }

    const masterIds = await getBelugaPatientMasterIdsByPhone(phone);
    const belongsByPhoneList = masterIds.includes(masterId);
    const visitPhone = onlyDigits(toNonEmptyString(visitResponse.payload?.data?.formObj?.phone || "") || "");
    const belongsByVisitPhone = visitPhone.length === 10 && visitPhone === phone;
    const order = await findBelugaOrderByMasterId(masterId);
    const belongsByOrder = Boolean(order && String((order as any).userId) === String(currentUser.id));
    if (!belongsByPhoneList && !belongsByVisitPhone && !belongsByOrder) {
      return res.status(404).json({
        success: false,
        message: "Beluga visit not found for current user",
      });
    }

    const existingVisitPreferences = normalizeBelugaPatientPreferenceArray(
      visitResponse.payload?.data?.formObj?.patientPreference
    );
    if (existingVisitPreferences.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Beluga visit has no existing patientPreference to update",
      });
    }
    if (patientPreference.length !== existingVisitPreferences.length) {
      return res.status(400).json({
        success: false,
        message: "patientPreference length must match existing Beluga visit preferences",
      });
    }

    const sanitizedPatientPreference = existingVisitPreferences.map((existing, index) => {
      const incoming = patientPreference[index];
      return {
        ...incoming,
        // medId must remain immutable for the existing visit preference slot.
        medId: existing.medId,
      };
    });

    const pharmacyId =
      requestedPharmacyId ||
      toNonEmptyString(visitResponse.payload?.data?.pharmacyId) ||
      toNonEmptyString(visitResponse.payload?.pharmacyId);

    if (!pharmacyId) {
      return res.status(400).json({
        success: false,
        message: "pharmacyId is required to update visit preferences",
      });
    }

    const updateResponse = await belugaRequest(
      "/external/updateVisit",
      {
        method: "POST",
        body: {
          masterId,
          pharmacyId,
          patientPreference: sanitizedPatientPreference,
          apiKey: resolveBelugaApiKey(),
        },
      },
      { allowHttpErrors: true }
    );

    if (updateResponse.statusCode >= 400) {
      return res.status(updateResponse.statusCode).json({
        success: false,
        message: "Beluga visit preference update failed",
        details: updateResponse.payload || null,
      });
    }

    const statusValue = toNonEmptyString(String(updateResponse.payload?.status || ""));
    const successStatuses = new Set(["VISIT_DATA_UPDATED", "NEW_RX_SENT", "200"]);
    if (!statusValue || !successStatuses.has(statusValue)) {
      return res.status(400).json({
        success: false,
        message: "Beluga did not accept visit preference update",
        details: updateResponse.payload || null,
      });
    }

    return res.json({
      success: true,
      data: updateResponse.payload,
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to update Beluga visit preferences",
      details: error?.payload || error?.message || null,
    });
  }
});

router.post("/cases", async (req: Request, res: Response) => {
  try {
    console.log('🐋 [BELUGA] ========== POST /beluga/cases REQUEST ==========');
    console.log('🐋 [BELUGA] Request body:', JSON.stringify(req.body, null, 2));
    
    let currentUser: any = null;
    try {
      currentUser = getCurrentUser(req);
      console.log('🐋 [BELUGA] Authenticated user:', currentUser?.id);
    } catch {
      console.log('🐋 [BELUGA] No authenticated user (checkout flow)');
      // User may be unauthenticated during checkout. We'll infer user from order.
    }

    const {
      orderId,
      patientOverrides,
      clinicId,
      company: requestedCompany,
      visitType: requestedVisitType,
      pharmacyId: requestedPharmacyId,
      belugaPhotos,
    } = req.body || {};
    if (!orderId || typeof orderId !== "string") {
      console.log('❌ [BELUGA] Missing orderId in request');
      return res.status(400).json({ success: false, message: "orderId is required" });
    }
    
    console.log('🐋 [BELUGA] Processing order:', orderId);

    const order = await Order.findByPk(orderId);
    if (!order) {
      console.log('❌ [BELUGA] Order not found');
      console.log('🐋 [BELUGA] ========== END (ORDER NOT FOUND) ==========');
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    console.log('✅ [BELUGA] Order found:', {
      orderId: order.id,
      userId: (order as any).userId,
      questionnaireId: (order as any).questionnaireId,
      tenantProductId: (order as any).tenantProductId,
    });

    let clinic: Clinic | null = null;
    if (clinicId) {
      clinic = await Clinic.findByPk(clinicId);
    } else if ((order as any).userId) {
      const ownerUser = await User.findByPk((order as any).userId);
      if (ownerUser?.clinicId) {
        clinic = await Clinic.findByPk(ownerUser.clinicId);
      }
    }

    if (currentUser && (order as any).userId !== currentUser.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const user = await User.findByPk((order as any).userId);
    if (!user) {
      console.log('❌ [BELUGA] User not found for order');
      console.log('🐋 [BELUGA] ========== END (USER NOT FOUND) ==========');
      return res.status(404).json({ success: false, message: "User not found for order" });
    }
    
    console.log('✅ [BELUGA] User found:', user.id);

    const questionnaireAnswers = ((order as any).questionnaireAnswers || {}) as Record<string, any>;
    let questionnaire: Questionnaire | null = null;

    if ((order as any).questionnaireId) {
      questionnaire = await Questionnaire.findByPk((order as any).questionnaireId);
      console.log('🐋 [BELUGA] Questionnaire lookup:', questionnaire ? `Found (${questionnaire.id})` : 'Not found');
    } else {
      console.log('⚠️ [BELUGA] No questionnaireId on order');
    }

    let tenantProductRecord: TenantProduct | null = null;
    let product: Product | null = null;
    if ((order as any).tenantProductId) {
      console.log('🐋 [BELUGA] Looking up product from tenantProductId:', (order as any).tenantProductId);
      tenantProductRecord = await TenantProduct.findByPk((order as any).tenantProductId, {
        include: [{ model: Product, as: "product", required: false }] as any,
      } as any);
      product = (tenantProductRecord as any)?.product || null;
      console.log('🐋 [BELUGA] Product found:', product ? product.id : 'null');

      if (!questionnaire && product?.id) {
        console.log('🐋 [BELUGA] No questionnaire from order, looking up by productId:', product.id);
        questionnaire = await Questionnaire.findOne({
          where: { productId: product.id },
          order: [["createdAt", "DESC"]] as any,
        } as any);
        console.log('🐋 [BELUGA] Questionnaire from product:', questionnaire ? `Found (${questionnaire.id})` : 'Not found');
      }
    } else {
      console.log('⚠️ [BELUGA] No tenantProductId on order');
    }

    console.log('🐋 [BELUGA] Checking medical company source:', {
      questionnaireId: questionnaire?.id,
      questionnaireMedicalCompanySource: questionnaire?.medicalCompanySource,
      clinicDashboardFormat: clinic?.patientPortalDashboardFormat,
    });

    const medicalCompanySource = questionnaire?.medicalCompanySource || clinic?.patientPortalDashboardFormat || null;
    
    console.log('🐋 [BELUGA] Resolved medical company source:', medicalCompanySource);
    console.log('🐋 [BELUGA] Expected:', MedicalCompanySlug.BELUGA);
    console.log('🐋 [BELUGA] Match:', medicalCompanySource === MedicalCompanySlug.BELUGA);

    if (medicalCompanySource !== MedicalCompanySlug.BELUGA) {
      console.log('❌ [BELUGA] Medical company source is not Beluga, skipping');
      console.log('🐋 [BELUGA] ========== END (SKIPPED - NOT BELUGA) ==========');
      return res.json({
        success: true,
        message: "Beluga case creation skipped (questionnaire medical company is not beluga)",
        data: { skipped: true, medicalCompanySource },
      });
    }
    
    console.log('✅ [BELUGA] Medical company is Beluga, continuing...');

    const shippingAddress = (order as any).shippingAddressId
      ? await ShippingAddress.findByPk((order as any).shippingAddressId)
      : null;
    const normalizedBelugaPhotos = normalizeBelugaPhotos(belugaPhotos);

    const firstName =
      toNonEmptyString(patientOverrides?.firstName) ||
      toNonEmptyString(user.firstName) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["first name"]);
    const lastName =
      toNonEmptyString(patientOverrides?.lastName) ||
      toNonEmptyString(user.lastName) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["last name"]);
    const email =
      toNonEmptyString(patientOverrides?.email) ||
      toNonEmptyString(user.email) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["email"]);
    const dob = formatDobForBeluga(
      toNonEmptyString(patientOverrides?.dob) ||
      toNonEmptyString(user.dob as any) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["date of birth", "dob", "birthday"])
    );
    const phoneCandidate =
      toNonEmptyString(patientOverrides?.phoneNumber) ||
      toNonEmptyString(user.phoneNumber) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["mobile", "phone"]);
    const phone = phoneCandidate ? onlyDigits(phoneCandidate) : "";
    const sex = normalizeBelugaSex(
      toNonEmptyString(patientOverrides?.gender) ||
      toNonEmptyString(user.gender as any) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["gender", "sex"])
    );
    const address =
      toNonEmptyString(shippingAddress?.address) ||
      toNonEmptyString(user.address) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["address"]);
    const city =
      toNonEmptyString(shippingAddress?.city) ||
      toNonEmptyString(user.city) ||
      findAnswerFromQuestionnaire(questionnaireAnswers, ["city"]);
    const state =
      (toNonEmptyString(shippingAddress?.state) ||
        toNonEmptyString(user.state) ||
        findAnswerFromQuestionnaire(questionnaireAnswers, ["state"]) ||
        "").toUpperCase();
    const zip =
      onlyDigits(
        toNonEmptyString(shippingAddress?.zipCode) ||
        toNonEmptyString(user.zipCode) ||
        findAnswerFromQuestionnaire(questionnaireAnswers, ["zip", "postal"]) ||
        ""
      ) || undefined;

    const selfReportedMeds =
      findAnswerFromQuestionnaire(questionnaireAnswers, ["self reported meds", "current medication", "medication list"]) ||
      "None reported";
    const allergies =
      findAnswerFromQuestionnaire(questionnaireAnswers, ["allergies", "allergy"]) ||
      "None reported";
    const medicalConditions =
      findAnswerFromQuestionnaire(questionnaireAnswers, ["medical conditions", "health conditions", "condition"]) ||
      "None reported";

    const belugaProductUUID = toNonEmptyString(product?.belugaProductId);
    if (!belugaProductUUID) {
      console.log('❌ [BELUGA] Product is not linked to a BelugaProduct');
      console.log('🐋 [BELUGA] ========== END (VALIDATION ERROR) ==========');
      return res.status(400).json({
        success: false,
        message: "Selected product is missing belugaProductId (not linked to a BelugaProduct)",
        details: {
          orderId: order.id,
          tenantProductId: (order as any).tenantProductId || null,
          productId: product?.id || null,
        },
      });
    }

    console.log('🐋 [BELUGA] Looking up BelugaProduct:', belugaProductUUID);
    // Lookup the BelugaProduct record to get all prescription details
    const belugaProduct = await BelugaProduct.findByPk(belugaProductUUID);
    if (!belugaProduct) {
      console.log('❌ [BELUGA] BelugaProduct not found in database');
      console.log('🐋 [BELUGA] ========== END (VALIDATION ERROR) ==========');
      return res.status(400).json({
        success: false,
        message: "Linked BelugaProduct not found",
        details: {
          orderId: order.id,
          productId: product?.id || null,
          belugaProductId: belugaProductUUID,
        },
      });
    }

    console.log('✅ [BELUGA] Found BelugaProduct:', {
      id: belugaProduct.id,
      name: belugaProduct.name,
      medId: belugaProduct.medId || 'null (will try without medId)',
    });

    const forcedBelugaMedId =
      process.env.NODE_ENV !== "production"
        ? toNonEmptyString(process.env.BELUGA_TEST_MED_ID) ||
          readEnvValueFromEnvLocal("BELUGA_TEST_MED_ID")
        : undefined;
    const belugaMedId = forcedBelugaMedId || toNonEmptyString(belugaProduct.medId);
    if (forcedBelugaMedId) {
      console.log("🧪 [BELUGA] Development mode: forcing test medId:", forcedBelugaMedId);
    }
    if (!belugaMedId) {
      console.log('⚠️ [BELUGA] BelugaProduct has no medId - proceeding without it (Beluga API will validate)');
    }

    console.log('🐋 [BELUGA] Building patientPreference array...');
    const patientPreference = [
      {
        name: toNonEmptyString(belugaProduct.name) || "N/A",
        strength: toNonEmptyString(belugaProduct.strength) || "N/A",
        quantity: toNonEmptyString(belugaProduct.quantity) || "1",
        refills: toNonEmptyString(belugaProduct.refills) || "0",
        daysSupply: toNonEmptyString(belugaProduct.daysSupply) || "30",
        ...(belugaMedId ? { medId: belugaMedId } : {}), // Only include medId if present
      },
    ];
    console.log('✅ [BELUGA] patientPreference built:', JSON.stringify(patientPreference, null, 2));

    console.log('🐋 [BELUGA] Collecting custom questions from questionnaire answers...');
    console.log('🐋 [BELUGA] questionnaireAnswers:', JSON.stringify(questionnaireAnswers, null, 2));
    console.log('🐋 [BELUGA] questionnaire:', questionnaire ? `Present (${questionnaire.id})` : 'null');
    
    const customQuestions = collectBelugaCustomQuestions(questionnaireAnswers, questionnaire);
    console.log('✅ [BELUGA] Custom questions collected:', JSON.stringify(customQuestions, null, 2));
    
    const masterId = String(order.id);

    console.log('🐋 [BELUGA] Building form object...');
    const formObj = {
      consentsSigned: true,
      firstName,
      lastName,
      dob,
      phone,
      email,
      address,
      city,
      state,
      zip,
      sex,
      selfReportedMeds,
      allergies,
      medicalConditions,
      patientPreference,
      ...customQuestions,
    };
    console.log('✅ [BELUGA] Form object built, validating required fields...');

    const requiredValidation: Array<{ key: string; value: unknown }> = [
      { key: "firstName", value: formObj.firstName },
      { key: "lastName", value: formObj.lastName },
      { key: "dob", value: formObj.dob },
      { key: "phone", value: formObj.phone },
      { key: "email", value: formObj.email },
      { key: "address", value: formObj.address },
      { key: "city", value: formObj.city },
      { key: "state", value: formObj.state },
      { key: "zip", value: formObj.zip },
      { key: "sex", value: formObj.sex },
      { key: "selfReportedMeds", value: formObj.selfReportedMeds },
      { key: "allergies", value: formObj.allergies },
      { key: "medicalConditions", value: formObj.medicalConditions },
    ];

    const missingFields = requiredValidation
      .filter((item) => !toNonEmptyString(String(item.value ?? "")))
      .map((item) => item.key);

    if (phone.length !== 10) {
      missingFields.push("phone (must contain 10 digits)");
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      missingFields.push("state (must be two uppercase letters)");
    }
    if (!zip || zip.length !== 5) {
      missingFields.push("zip (must contain 5 digits)");
    }

    if (missingFields.length > 0) {
      console.log('❌ [BELUGA] Validation failed - missing required fields:', missingFields);
      console.log('🐋 [BELUGA] Form data:', JSON.stringify(formObj, null, 2));
      console.log('🐋 [BELUGA] ========== END (VALIDATION FAILED) ==========');
      return res.status(400).json({
        success: false,
        message: "Cannot create Beluga visit: missing or invalid required fields",
        details: {
          missingFields,
          orderId: order.id,
          userId: user.id,
        },
      });
    }

    if (normalizedBelugaPhotos.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Beluga requires at least one JPEG image in belugaPhotos for receivePhotos",
      });
    }

    console.log('✅ [BELUGA] All required fields validated');
    console.log('🐋 [BELUGA] Resolving dynamic parameters (company, visitType, pharmacy)...');

    console.log('🐋 [BELUGA] Step 1: Getting patient history hints...');
    const patientHistoryHints = await getBelugaPatientHistoryHints(phone);
    console.log('✅ [BELUGA] Patient history hints:', patientHistoryHints);

    console.log('🐋 [BELUGA] Step 2: Resolving company candidates...');
    const companyCandidates = resolveBelugaCompanyCandidates(clinic, requestedCompany);
    console.log('✅ [BELUGA] Company candidates:', companyCandidates);

    console.log('🐋 [BELUGA] Step 3: Resolving visit type candidates...');
    const visitTypeCandidates = resolveBelugaVisitTypeCandidates({
      requestedVisitType,
      questionnaire,
      state,
      patientVisitType: patientHistoryHints.visitType,
    });
    console.log('✅ [BELUGA] Visit type candidates:', visitTypeCandidates);

    console.log('🐋 [BELUGA] Step 4: Resolving pharmacy candidates...');
    console.log('🐋 [BELUGA] Pharmacy search inputs:', { requestedPharmacyId, zip, city, state });
    const pharmacyCandidates = await resolveBelugaPharmacyCandidates({
      requestedPharmacyId,
      zip,
      city,
      state,
    });
    console.log('✅ [BELUGA] Pharmacy candidates:', pharmacyCandidates);

    if (companyCandidates.length === 0) {
      console.log('❌ [BELUGA] No company candidates found');
      console.log('🐋 [BELUGA] ========== END (NO COMPANY) ==========');
      return res.status(400).json({
        success: false,
        message: "Unable to resolve Beluga company dynamically",
      });
    }

    if (visitTypeCandidates.length === 0) {
      console.log('❌ [BELUGA] No visit type candidates found');
      console.log('🐋 [BELUGA] ========== END (NO VISIT TYPE) ==========');
      return res.status(400).json({
        success: false,
        message: "Unable to resolve Beluga visitType dynamically",
      });
    }

    if (pharmacyCandidates.length === 0) {
      console.log('❌ [BELUGA] No pharmacy candidates found');
      console.log('🐋 [BELUGA] Details:', { city, state, zip });
      console.log('🐋 [BELUGA] ========== END (NO PHARMACY) ==========');
      return res.status(400).json({
        success: false,
        message: "Unable to resolve Beluga pharmacyId dynamically from patient address",
        details: { city, state, zip },
      });
    }

    console.log('🐋 [BELUGA] Checking if visit already exists for masterId:', masterId);
    const existingVisit = await belugaRequest(`/visit/externalFetch/${encodeURIComponent(masterId)}`, { method: "GET" }, {
      allowHttpErrors: true,
    });

    if (existingVisit.statusCode === 200 && existingVisit.payload?.status === 200) {
      const existingVisitId =
        toNonEmptyString(existingVisit.payload?.data?.visitId) ||
        toNonEmptyString(existingVisit.payload?.visitId) ||
        masterId;
      const photoResult = await submitBelugaPhotos(existingVisitId, normalizedBelugaPhotos);
      if (photoResult.attempted && !photoResult.success) {
        return res.status(502).json({
          success: false,
          message: "Beluga visit exists but photo submission failed",
          details: {
            masterId,
            visitId: existingVisitId,
            belugaPhotoResponse: photoResult.payload,
          },
        });
      }

      console.log('ℹ️ [BELUGA] Visit already exists, skipping creation');
      console.log('🐋 [BELUGA] ========== END (ALREADY EXISTS) ==========');
      return res.json({
        success: true,
        message: "Beluga visit already exists for this order",
        data: {
          skipped: true,
          alreadyExists: true,
          masterId,
          visit: existingVisit.payload,
          belugaPhotoSubmission: photoResult,
        },
      });
    }
    
    console.log('🐋 [BELUGA] No existing visit found, proceeding with creation');

    console.log('🐋 [BELUGA] ========== CREATING VISIT ==========');
    console.log('🐋 [BELUGA] Order ID:', order.id);
    console.log('🐋 [BELUGA] masterId:', masterId);
    console.log('🐋 [BELUGA] Form data:', JSON.stringify(formObj, null, 2));
    console.log('🐋 [BELUGA] Company candidates:', companyCandidates);
    console.log('🐋 [BELUGA] Visit type candidates:', visitTypeCandidates);
    console.log('🐋 [BELUGA] Pharmacy candidates:', pharmacyCandidates);

    const attempts: Array<{
      company: string;
      visitType: string;
      pharmacyId: string;
      statusCode: number;
      error: string;
    }> = [];
    let createdPayload: any = null;
    let createdMeta: { company: string; visitType: string; pharmacyId: string } | null = null;
    let lastFailure: any = null;

    outerLoop:
    for (const company of companyCandidates) {
      for (const visitType of visitTypeCandidates) {
        for (const pharmacyId of pharmacyCandidates) {
          const payload = {
            formObj,
            pharmacyId,
            masterId,
            company,
            visitType,
          };

          console.log(`🐋 [BELUGA] Attempting: company="${company}", visitType="${visitType}", pharmacyId="${pharmacyId}"`);
          console.log('🐋 [BELUGA] Full payload:', JSON.stringify(payload, null, 2));

          const createVisitResponse = await belugaRequest(
            "/visit/createNoPayPhotos",
            { method: "POST", body: payload },
            { allowHttpErrors: true }
          );

          console.log('🐋 [BELUGA] Response status:', createVisitResponse.statusCode);
          console.log('🐋 [BELUGA] Response payload:', JSON.stringify(createVisitResponse.payload, null, 2));

          const errorText = getBelugaErrorText(createVisitResponse.payload);
          attempts.push({
            company,
            visitType,
            pharmacyId,
            statusCode: createVisitResponse.statusCode,
            error: errorText || "none",
          });

          if (createVisitResponse.statusCode < 400 && createVisitResponse.payload?.status === 200) {
            console.log('✅ [BELUGA] SUCCESS! Visit created successfully');
            console.log('✅ [BELUGA] visitId:', createVisitResponse.payload?.data?.visitId);
            console.log('✅ [BELUGA] masterId:', createVisitResponse.payload?.data?.masterId);
            createdPayload = createVisitResponse.payload;
            createdMeta = { company, visitType, pharmacyId };
            break outerLoop;
          }

          console.log('❌ [BELUGA] Attempt failed:', errorText || 'Unknown error');
          lastFailure = createVisitResponse;

          // Duplicate masterId means the visit already exists; treat as idempotent success.
          if (errorText.includes("duplicate masterid")) {
            const visitLookup = await belugaRequest(`/visit/externalFetch/${encodeURIComponent(masterId)}`, { method: "GET" }, {
              allowHttpErrors: true,
            });
            if (visitLookup.statusCode === 200 && visitLookup.payload?.status === 200) {
              const duplicateVisitId =
                toNonEmptyString(visitLookup.payload?.data?.visitId) ||
                toNonEmptyString(visitLookup.payload?.visitId) ||
                masterId;
              const photoResult = await submitBelugaPhotos(duplicateVisitId, normalizedBelugaPhotos);
              if (photoResult.attempted && !photoResult.success) {
                return res.status(502).json({
                  success: false,
                  message: "Beluga visit already existed but photo submission failed",
                  details: {
                    masterId,
                    visitId: duplicateVisitId,
                    belugaPhotoResponse: photoResult.payload,
                  },
                });
              }

              await order.update({
                belugaMasterId: masterId,
                belugaVisitId: duplicateVisitId !== masterId ? duplicateVisitId : undefined,
              });

              return res.json({
                success: true,
                message: "Beluga visit already exists for this order",
                data: {
                  skipped: true,
                  alreadyExists: true,
                  masterId,
                  visit: visitLookup.payload,
                  resolved: { company, visitType, pharmacyId },
                  belugaPhotoSubmission: photoResult,
                },
              });
            }
          }

          // If medId is not valid for this account, fail immediately.
          if (errorText.includes("no match for")) {
            return res.status(400).json({
              success: false,
              message: "Beluga rejected the product medId - it may not be enabled for your company",
              details: {
                belugaProductName: belugaProduct.name,
                belugaMedId: belugaMedId,
                response: createVisitResponse.payload,
                attempted: { company, visitType, pharmacyId },
              },
            });
          }
        }
      }
    }

    if (!createdPayload || !createdMeta) {
      console.log('❌ [BELUGA] ALL ATTEMPTS FAILED');
      console.log('❌ [BELUGA] Total attempts:', attempts.length);
      console.log('❌ [BELUGA] Attempts summary:', JSON.stringify(attempts, null, 2));
      console.log('❌ [BELUGA] Last failure payload:', JSON.stringify(lastFailure?.payload, null, 2));
      console.log('🐋 [BELUGA] ========== END (FAILED) ==========');
      
      return res.status(lastFailure?.statusCode || 400).json({
        success: false,
        message: "Beluga visit creation failed after dynamic resolution attempts",
        details: {
          lastResponse: lastFailure?.payload || null,
          companyCandidates,
          visitTypeCandidates,
          pharmacyCandidates,
          attempts: attempts.slice(-20),
        },
      });
    }

    console.log('🎉 [BELUGA] Visit created successfully!');
    console.log('🎉 [BELUGA] Resolved with:', createdMeta);
    console.log('🎉 [BELUGA] Visit data:', JSON.stringify(createdPayload?.data, null, 2));

    const createdVisitId =
      toNonEmptyString(createdPayload?.data?.visitId) ||
      toNonEmptyString(createdPayload?.visitId) ||
      masterId;
    const photoResult = await submitBelugaPhotos(createdVisitId, normalizedBelugaPhotos);
    if (photoResult.attempted && !photoResult.success) {
      return res.status(502).json({
        success: false,
        message: "Beluga visit created but photo submission failed",
        details: {
          masterId,
          visitId: createdVisitId,
          belugaResponse: createdPayload,
          belugaPhotoResponse: photoResult.payload,
        },
      });
    }

    const savedVisitId = toNonEmptyString(createdPayload?.data?.visitId) || toNonEmptyString(createdPayload?.visitId);
    await order.update({
      belugaMasterId: masterId,
      ...(savedVisitId ? { belugaVisitId: savedVisitId } : {}),
    });
    console.log('💾 [BELUGA] Saved to Order — belugaMasterId:', masterId, '| belugaVisitId:', savedVisitId || '(none)');

    console.log('🐋 [BELUGA] ========== END (SUCCESS) ==========');

    return res.json({
      success: true,
      message: "Beluga visit created successfully",
      data: {
        orderId: order.id,
        masterId,
        belugaResponse: createdPayload,
        resolved: createdMeta,
        belugaPhotoSubmission: photoResult,
      },
    });
  } catch (error: any) {
    console.error("❌ [BELUGA] EXCEPTION in POST /beluga/cases:", error?.message || error);
    console.error("❌ [BELUGA] Stack trace:", error?.stack);
    console.log('🐋 [BELUGA] ========== END (EXCEPTION) ==========');
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Failed to create Beluga visit",
      details: error?.payload || error?.message || null,
    });
  }
});

export default router;
