import React from "react";

interface BelugaPhotoStepProps {
  onPhotoChange: (photo: { mime: "image/jpeg"; data: string; fileName: string } | null) => void;
  selectedPhotoName?: string;
  photoError?: string;
}

export const BelugaPhotoStep: React.FC<BelugaPhotoStepProps> = ({
  onPhotoChange,
  selectedPhotoName,
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
        Upload Photo
      </h2>
      <p className="text-gray-600 text-base leading-relaxed">
        Upload your photo in JPEG format before continuing with the intake.
      </p>
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
    </div>
  );
};
