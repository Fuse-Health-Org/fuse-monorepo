import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface ModalHeaderProps {
  onClose: () => void;
  currentStep: number;
  totalSteps: number;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  onClose,
  currentStep,
  totalSteps,
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      <Button
        isIconOnly
        variant="light"
        onPress={onClose}
        className="text-gray-500 hover:text-gray-700"
      >
        <Icon icon="lucide:x" className="text-xl" />
      </Button>

      <div className="text-center">
        <p className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}
        </p>
      </div>

      <div className="w-10" /> {/* Spacer for centering */}
    </div>
  );
};

