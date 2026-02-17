import React from "react";

const TELEHEALTH_CONSENT_URL = "https://customerconsents.s3.amazonaws.com/Beluga_Health_Telemedicine_Informed_Consent.pdf";
const PRIVACY_POLICY_URL = "https://customerconsents.s3.amazonaws.com/Beluga_Health_PA_Privacy_Policy.pdf";

interface BelugaConsentStepProps {
  consentGiven: boolean;
  onConsentChange: (value: boolean) => void;
  onPhotoChange: (photo: { mime: "image/jpeg"; data: string; fileName: string } | null) => void;
  selectedPhotoName?: string;
  consentError?: string;
  photoError?: string;
}

export const BelugaConsentStep: React.FC<BelugaConsentStepProps> = ({
  consentGiven,
  onConsentChange,
  onPhotoChange,
  selectedPhotoName,
  consentError,
  photoError,
}) => {
  const handleFileSelection = async (file: File | null) => {
    if (!file) {
      onPhotoChange(null);
      return;
    }

    if (file.type !== "image/jpeg") {
      onPhotoChange(null);
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = typeof reader.result === "string" ? reader.result : "";
        const [, rawData] = value.split(",");
        resolve(rawData || "");
      };
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });

    onPhotoChange({
      mime: "image/jpeg",
      data: base64,
      fileName: file.name,
    });
  };

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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Upload ID/Patient photo (JPEG)
        </label>
        <input
          type="file"
          accept="image/jpeg"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0] || null;
            handleFileSelection(selectedFile).catch(() => onPhotoChange(null));
          }}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#4FA59C] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#3d847c]"
        />
        {selectedPhotoName ? (
          <p className="text-xs text-gray-500">Selected: {selectedPhotoName}</p>
        ) : (
          <p className="text-xs text-gray-500">Required for Beluga visit submission.</p>
        )}
        {photoError && <p className="text-red-500 text-sm">{photoError}</p>}
      </div>
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
      {consentError && <p className="text-red-500 text-sm">{consentError}</p>}
    </div>
  );
};
