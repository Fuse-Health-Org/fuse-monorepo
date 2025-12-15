import React from "react";

interface InformationalStepViewProps {
  stepTitle: string;
  stepDescription?: string;
}

export const InformationalStepView: React.FC<InformationalStepViewProps> = ({
  stepTitle,
  stepDescription,
}) => {
  return (
    <div className="text-center space-y-4">
      <h2 className="text-2xl font-medium text-gray-900 mb-3">
        {stepTitle}
      </h2>
      {stepDescription && (
        <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto">
          {stepDescription}
        </p>
      )}
    </div>
  );
};

