import React from "react";
import { Icon } from "@iconify/react";

interface Medication {
  id: string;
  name: string;
  type: string;
  badge: string | null;
  badgeColor?: string;
  subtitle: string;
  description: string;
  benefits: string[];
  icon: string;
  isSelected?: boolean;
}

interface MedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medications: Medication[];
  selectedMedication: string;
  onSelectMedication: (medicationId: string) => void;
}

export const MedicationModal: React.FC<MedicationModalProps> = ({
  isOpen,
  onClose,
  medications,
  selectedMedication,
  onSelectMedication,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-start justify-center p-4 z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', margin: 0 }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-gray-900">Choose Preferred Medication</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Icon icon="lucide:x" className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600 text-sm mt-2">
            Your provider will take this into consideration when creating your treatment plan.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {medications.map((medication) => (
            <div
              key={medication.id}
              className={`relative border rounded-2xl p-4 cursor-pointer transition-all ${selectedMedication === medication.id
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-200 hover:border-gray-300"
                }`}
              onClick={() => onSelectMedication(medication.id)}
            >
              {selectedMedication === medication.id && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Icon icon="lucide:check" className="w-4 h-4 text-white" />
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 flex items-center justify-center">
                  {medication.icon === "heyfeels" ? (
                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                      <div className="text-white text-xs font-bold">
                        <div>hey</div>
                        <div>feels</div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                      {medication.icon}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-gray-900">{medication.name}</h3>
                    {medication.badge && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${medication.badgeColor}`}>
                        {medication.badge}
                      </span>
                    )}
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                      {medication.type}
                    </span>
                  </div>

                  <p className="text-emerald-600 font-medium text-sm mb-1">{medication.subtitle}</p>
                  <p className="text-gray-600 text-sm mb-3">{medication.description}</p>

                  <div className="space-y-1">
                    {medication.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Icon icon="lucide:check" className="w-3 h-3 text-emerald-600" />
                        <span className="text-gray-700 text-sm">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

