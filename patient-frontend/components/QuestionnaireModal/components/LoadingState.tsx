import React from "react";
import { Modal, ModalContent, ModalBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface LoadingStateProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  isOpen,
  onClose,
  loading,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      classNames={{
        base: "m-0 sm:m-0 max-w-full max-h-full",
        wrapper: "w-full h-full",
        backdrop: "bg-overlay/50"
      }}
      hideCloseButton
    >
      <ModalContent className="h-full bg-white">
        <ModalBody className="flex items-center justify-center">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Icon icon="lucide:loader-2" className="text-4xl text-primary animate-spin" />
            </div>
            <p className="text-lg">
              {loading ? 'Loading questionnaire...' : 'No questionnaire found for this treatment'}
            </p>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

