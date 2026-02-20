#!/usr/bin/env tsx

/**
 * HIPAA Logging Compliance Checker
 *
 * This script analyzes git diffs for potential HIPAA violations in logging statements.
 * It uses Claude AI to detect if any PHI (Protected Health Information) is being logged.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

interface ViolationResult {
  file: string;
  line: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  suggestion: string;
}

interface AnalysisResponse {
  hasViolations: boolean;
  violations: ViolationResult[];
  summary: string;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

if (!ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

const client = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

const HIPAA_ANALYSIS_PROMPT = `You are a HIPAA compliance expert reviewing code changes for Protected Health Information (PHI) exposure in logging statements.

**PHI that must NEVER be logged in production (unconditionally):**
- Patient names (firstName, lastName, fullName)
- Date of Birth (DOB, dateOfBirth, birthDate)
- Email addresses (patient emails, user emails)
- Phone numbers (phone, phoneNumber, mobile)
- Social Security Numbers (SSN, socialSecurityNumber)
- Addresses (street, city, zip, shipping address, billing address)
- Medical information:
  - Allergies
  - Medications (current, past)
  - Medical conditions
  - Prescriptions (sig, clinical notes, directions, instructions)
  - Diagnoses
  - Treatment details
  - Lab results
- Medical record numbers
- Case IDs that can identify patients
- Full request/response bodies containing patient data
- Questionnaire answers with medical intake data
- Chat messages that may contain medical information

**What IS acceptable to log:**
- User IDs (numeric IDs only, not names)
- Order IDs
- Generic error messages without PHI
- Logs gated behind \`if (process.env.NODE_ENV === 'development')\` or similar
- Technical debugging info that doesn't contain PHI
- Redacted/hashed values

**Special considerations:**
1. Frontend: \`console.log\` is stripped in production by \`removeConsole\`, but \`console.error\` and \`console.warn\` survive
2. Frontend: Server-side Next.js API routes (\`pages/api/**\`) are NOT affected by \`removeConsole\` - all logs run in production
3. Backend: All \`console.log\`, \`logger.info\`, \`log.error\` etc. run in production unless gated
4. Development-only logs are acceptable IF properly gated and no real patient data is used in dev

**Analysis instructions:**
1. Review each logging statement added or modified in the diff
2. Identify if any PHI is being logged
3. Consider the context - is it production code or development-only?
4. Check if logs are properly gated (environment checks)
5. For violations, specify severity:
   - CRITICAL: Unconditional logging of full patient records, complete PHI
   - HIGH: Unconditional logging of individual PHI fields (email, phone, DOB, etc.)
   - MEDIUM: Partial PHI or logs in server-side Next.js routes
   - LOW: Development-only or minor concerns

**Response format:**
Return a JSON object with this exact structure:
{
  "hasViolations": boolean,
  "violations": [
    {
      "file": "path/to/file.ts",
      "line": 123,
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "issue": "Brief description of what PHI is being logged",
      "suggestion": "How to fix it (e.g., 'Remove email from log', 'Log userId instead of full user object', 'Gate behind NODE_ENV check')"
    }
  ],
  "summary": "Overall assessment with count of violations by severity"
}

**Important:** Only flag actual violations. Do not flag:
- Logs that only contain IDs
- Properly gated development logs
- Logs that don't contain PHI

Now analyze this git diff:`;

async function analyzeDiffWithClaude(diff: string): Promise<AnalysisResponse> {
  console.log('Analyzing diff with Claude AI...');

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `${HIPAA_ANALYSIS_PROMPT}\n\n\`\`\`diff\n${diff}\n\`\`\``,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (Claude might wrap it in markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis: AnalysisResponse = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (error) {
    console.error('Error analyzing with Claude:', error);
    throw error;
  }
}

async function postCommentToPR(comment: string): Promise<void> {
  if (!GITHUB_TOKEN || !PR_NUMBER || !REPO_OWNER || !REPO_NAME) {
    console.log('Missing GitHub configuration, skipping PR comment');
    console.log('Comment that would have been posted:');
    console.log(comment);
    return;
  }

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues/${PR_NUMBER}/comments`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: comment }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}: ${await response.text()}`);
    }

    console.log('Successfully posted comment to PR');
  } catch (error) {
    console.error('Error posting comment to PR:', error);
    throw error;
  }
}

function formatComment(analysis: AnalysisResponse): string {
  if (!analysis.hasViolations) {
    return `## ✅ HIPAA Logging Compliance Check Passed

No PHI exposure detected in logging statements.

**Summary:** ${analysis.summary}

---
*Automated check powered by Claude AI*`;
  }

  const violationsByseverity = {
    CRITICAL: analysis.violations.filter(v => v.severity === 'CRITICAL'),
    HIGH: analysis.violations.filter(v => v.severity === 'HIGH'),
    MEDIUM: analysis.violations.filter(v => v.severity === 'MEDIUM'),
    LOW: analysis.violations.filter(v => v.severity === 'LOW'),
  };

  let comment = `## ⚠️ HIPAA Logging Compliance Issues Detected

**Summary:** ${analysis.summary}

`;

  const severityEmoji = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🔵',
  };

  for (const [severity, violations] of Object.entries(violationsByseverity)) {
    if (violations.length === 0) continue;

    comment += `\n### ${severityEmoji[severity as keyof typeof severityEmoji]} ${severity} Severity (${violations.length})\n\n`;

    violations.forEach((v, idx) => {
      comment += `**${idx + 1}. ${v.file}:${v.line}**\n`;
      comment += `- **Issue:** ${v.issue}\n`;
      comment += `- **Fix:** ${v.suggestion}\n\n`;
    });
  }

  comment += `\n---

### HIPAA Logging Guidelines

**Never log these in production:**
- Patient names, DOB, email, phone, SSN
- Addresses (shipping, billing)
- Medical data (allergies, medications, conditions, prescriptions)
- Full request/response bodies with patient data
- Chat messages or questionnaire answers

**Acceptable to log:**
- User IDs and Order IDs (numeric only)
- Generic error messages
- Development-gated logs (\`if (process.env.NODE_ENV === 'development')\`)

See \`hipaa-logging-review.md\` for full guidelines.

---
*Automated check powered by Claude AI*`;

  return comment;
}

async function main() {
  try {
    // Read the diff file
    const diff = readFileSync('pr-diff.txt', 'utf-8');

    if (!diff || diff.trim().length === 0) {
      console.log('No changes detected in diff');
      process.exit(0);
    }

    // Filter diff to only include logging-related changes
    const logPatterns = [
      /console\.(log|info|warn|error|debug)/,
      /logger\.(log|info|warn|error|debug)/,
      /log\.(log|info|warn|error|debug)/,
    ];

    const diffLines = diff.split('\n');
    const hasLoggingChanges = diffLines.some(line => {
      if (!line.startsWith('+')) return false;
      return logPatterns.some(pattern => pattern.test(line));
    });

    if (!hasLoggingChanges) {
      console.log('No logging statements found in changes, skipping HIPAA check');
      process.exit(0);
    }

    console.log('Logging changes detected, running HIPAA compliance check...');

    // Analyze with Claude
    const analysis = await analyzeDiffWithClaude(diff);

    // Format and post comment
    const comment = formatComment(analysis);
    await postCommentToPR(comment);

    // Set output for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const output = `violations_found=${analysis.hasViolations ? 'true' : 'false'}\n`;
      writeFileSync(process.env.GITHUB_OUTPUT, output, { flag: 'a' });
    }

    // Exit with appropriate code
    if (analysis.hasViolations) {
      console.log('\n❌ HIPAA violations detected!');
      console.log(comment);
      process.exit(1);
    } else {
      console.log('\n✅ No HIPAA violations detected');
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
