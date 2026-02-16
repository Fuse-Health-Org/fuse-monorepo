import React from "react";

const TELEHEALTH_CONSENT_URL = "https://customerconsents.s3.amazonaws.com/Beluga_Health_Telemedicine_Informed_Consent.pdf";
const PRIVACY_POLICY_URL = "https://customerconsents.s3.amazonaws.com/Beluga_Health_PA_Privacy_Policy.pdf";

interface BelugaConsentStepProps {
  consentGiven: boolean;
  onConsentChange: (value: boolean) => void;
  error?: string;
}

export const BelugaConsentStep: React.FC<BelugaConsentStepProps> = ({
  consentGiven,
  onConsentChange,
  error,
}) => {
  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-medium text-gray-900 text-center">
        Informed Consent & Privacy Policy
      </h2>
      <p className="text-gray-600 text-base leading-relaxed">
        Before continuing with the clinical intake questionnaire, please review and acknowledge the following documents from Beluga Health:
      </p>
      <ul className="space-y-3">
        <li>
          <a
            href={TELEHEALTH_CONSENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4FA59C] hover:text-[#3d847c] underline font-medium"
          >
            Beluga&apos;s Telehealth Informed Consent
          </a>
          <span className="text-gray-600 text-sm ml-1">(opens in new tab)</span>
        </li>
        <li>
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4FA59C] hover:text-[#3d847c] underline font-medium"
          >
            Beluga&apos;s Privacy Policy
          </a>
          <span className="text-gray-600 text-sm ml-1">(opens in new tab)</span>
        </li>
      </ul>
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consentGiven}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-[#4FA59C] focus:ring-[#4FA59C]"
        />
        <span className="text-gray-700 text-base leading-relaxed">
          I have read and agree to the{" "}
          <a
            href={TELEHEALTH_CONSENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4FA59C] hover:text-[#3d847c] underline"
            onClick={(e) => e.stopPropagation()}
          >
            Telehealth Informed Consent
          </a>{" "}
          and{" "}
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4FA59C] hover:text-[#3d847c] underline"
            onClick={(e) => e.stopPropagation()}
          >
            Privacy Policy
          </a>{" "}
          from Beluga Health.
        </span>
      </label>
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
};
