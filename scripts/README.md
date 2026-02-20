# HIPAA Logging Compliance Checker

Automated GitHub Action that uses Claude AI to detect Protected Health Information (PHI) exposure in logging statements.

## Overview

This tool automatically reviews all pull requests for HIPAA compliance violations in logging code. It analyzes git diffs to detect if any PHI (patient names, DOB, email, medical data, etc.) is being logged to console or log files.

## Setup

### 1. Add Anthropic API Key to GitHub Secrets

1. Go to your repository settings
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add a secret named `ANTHROPIC_API_KEY` with your Anthropic API key

To get an API key:
- Visit https://console.anthropic.com/
- Create an account or sign in
- Navigate to API Keys
- Create a new key

### 2. Enable GitHub Actions

The workflow file is located at `.github/workflows/hipaa-log-check.yml` and will automatically run on:
- New pull requests
- Pull request updates (new commits)
- Pull request state changes (draft → ready for review)

**Important:** The check **does not run on draft PRs** to save API costs and allow experimentation.

## How It Works

1. **Trigger:** Runs when a PR is opened or updated (non-draft only)
2. **Diff Analysis:** Fetches git diff between PR branch and base branch
3. **Log Detection:** Identifies added/modified logging statements (console.log, logger.*, etc.)
4. **AI Analysis:** Sends changes to Claude AI with HIPAA compliance rules
5. **Violation Detection:** Claude identifies PHI exposure in logs
6. **Report:** Posts detailed findings as PR comment
7. **CI Status:** Fails the check if violations are found, blocking merge

## What Gets Flagged

### PHI that must NEVER be logged in production:

- **Personal identifiers:** firstName, lastName, email, phone, SSN
- **Demographics:** Date of Birth (DOB), addresses (shipping, billing)
- **Medical data:**
  - Allergies
  - Medications (current, past)
  - Medical conditions
  - Prescriptions (sig, clinical notes, directions)
  - Diagnoses, treatment details
  - Lab results
- **System identifiers:** Medical record numbers, identifiable case IDs
- **User content:** Questionnaire answers, chat messages, clinical notes
- **Full objects:** Complete request/response bodies containing patient data

### What IS acceptable:

✅ User IDs (numeric only, not names)
✅ Order IDs
✅ Generic error messages without PHI
✅ Development-gated logs: `if (process.env.NODE_ENV === 'development')`
✅ Redacted or hashed values

## Severity Levels

- **CRITICAL:** Unconditional logging of full patient records or complete PHI
- **HIGH:** Unconditional logging of individual PHI fields (email, phone, DOB)
- **MEDIUM:** Partial PHI or logs in server-side Next.js API routes
- **LOW:** Development-only logs or minor concerns

## Frontend Special Cases

### Next.js `removeConsole` Configuration

All frontend apps have `compiler.removeConsole` in `next.config.js` that strips `console.log` and `console.info` from production builds. However:

⚠️ **Server-side Next.js API routes (`pages/api/**`) are NOT affected** - all console statements run in production

⚠️ `console.error` and `console.warn` survive in production

## Running Locally

You can test the checker locally before pushing:

```bash
# Install dependencies
npm install -g tsx
npm install @anthropic-ai/sdk

# Set your API key
export ANTHROPIC_API_KEY="your-key-here"

# Generate a diff file
git diff main...your-branch > pr-diff.txt

# Run the checker
tsx scripts/hipaa-log-checker.ts
```

## Bypassing the Check (Not Recommended)

If you have a legitimate reason to bypass the check:

1. The check only runs on **ready-for-review** PRs
2. Draft PRs are automatically skipped
3. You can convert a PR to draft to temporarily disable the check

**However:** Bypassing HIPAA checks should only be done with explicit approval from compliance/security teams.

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is required"

Ensure you've added the API key to GitHub Secrets (see Setup step 1).

### "No changes detected in diff"

This is normal if the PR doesn't modify any logging statements. The check exits successfully.

### Check runs on draft PR

The workflow should skip draft PRs automatically. If it runs anyway:
- Check `.github/workflows/hipaa-log-check.yml` has `if: github.event.pull_request.draft == false`
- Ensure the PR is actually marked as draft in GitHub UI

### False positives

If the AI flags something that isn't actually PHI:
1. Review the finding - is it actually safe?
2. If safe, add clarifying comments in the code explaining why (e.g., "userId is numeric only")
3. Consider updating the HIPAA_ANALYSIS_PROMPT in `scripts/hipaa-log-checker.ts` to handle the edge case

## References

- Full HIPAA logging audit: `hipaa-logging-review.md`
- FUSE Health CLAUDE.md: Section on HIPAA Compliance
- HIPAA Privacy Rule: https://www.hhs.gov/hipaa/for-professionals/privacy/index.html

## Support

For issues or questions:
- File a GitHub issue in this repository
- Contact the security/compliance team
- Review existing violations in `hipaa-logging-review.md` for examples
