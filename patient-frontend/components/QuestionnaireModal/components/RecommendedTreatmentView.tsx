import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { MedicationModal } from "./MedicationModal";

interface RecommendedTreatmentViewProps {
  onAnswerChange: (questionId: string, value: any) => void;
  onNext: () => void;
}

export const RecommendedTreatmentView: React.FC<RecommendedTreatmentViewProps> = ({
  onAnswerChange,
  onNext,
}) => {
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState("semaglutide-orals");

  const medications = [
    {
      id: "compounded-semaglutide",
      name: "Compounded Semaglutide",
      type: "Injectable",
      badge: "Most Popular",
      badgeColor: "bg-emerald-100 text-emerald-700",
      subtitle: "Weekly Injectable",
      description: "Most commonly prescribed for consistent weight management",
      benefits: ["16% average weight loss", "Once-weekly injection"],
      icon: "💉",
    },
    {
      id: "semaglutide-orals",
      name: "Semaglutide Orals",
      type: "Oral",
      badge: "Oral",
      badgeColor: "bg-gray-100 text-gray-700",
      subtitle: "Daily Oral Option",
      description: "Needle-free alternative with flexible dosing",
      benefits: ["Oral dissolvable tablet", "Same active ingredient as Rybelsus®"],
      icon: "heyfeels",
      isSelected: true,
    },
    {
      id: "compounded-tirzepatide",
      name: "Compounded Tirzepatide",
      type: "Injectable",
      badge: null,
      subtitle: "Dual-Action Injectable",
      description: "Works on two hormone pathways for enhanced results",
      benefits: ["22% average weight loss", "GLP-1 and GIP receptor activation"],
      icon: "💉",
    },
    {
      id: "tirzepatide-orals",
      name: "Tirzepatide Orals",
      type: "Oral",
      badge: "Oral",
      badgeColor: "bg-gray-100 text-gray-700",
      subtitle: "Dual-Action Oral",
      description: "Advanced two-pathway approach in oral form",
      benefits: ["Oral dissolvable tablet", "GLP-1 and GIP receptor activation"],
      icon: "heyfeels",
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-medium text-gray-900 mb-3">Recommended Treatment</h3>
          <p className="text-gray-600 text-base">Based on your assessment, our providers recommend this treatment</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 text-emerald-600 mb-4">
            <Icon icon="lucide:check" className="w-4 h-4" />
            <span className="text-sm font-medium">Provider Recommended</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center">
              <div className="text-white text-xs font-bold">
                <div>hey</div>
                <div>feels</div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-medium text-gray-900">Semaglutide Orals</h3>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">Oral</span>
              </div>
              <p className="text-gray-900 font-medium mb-1">Daily Oral Option</p>
              <p className="text-gray-600 text-sm mb-4">Needle-free alternative with flexible dosing</p>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:check" className="w-4 h-4 text-emerald-600" />
                  <span className="text-gray-700 text-sm">Oral dissolvable tablet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:check" className="w-4 h-4 text-emerald-600" />
                  <span className="text-gray-700 text-sm">Same active ingredient as Rybelsus®</span>
                </div>
              </div>

              <button
                onClick={() => {
                  // Handle treatment selection
                  onAnswerChange('selectedTreatment', 'Semaglutide Orals');
                  onNext();
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-2xl text-base h-auto flex items-center justify-center gap-2 transition-colors"
              >
                Select This Treatment
                <Icon icon="lucide:chevron-right" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowMedicationModal(true)}
          className="w-full bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Icon icon="lucide:plus" className="w-4 h-4" />
          <span className="font-medium">View Other Treatment Options</span>
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="lucide:lock" className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900">About Compounded Medications</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:check" className="w-4 h-4 text-emerald-600" />
              <span className="text-gray-700 text-sm">Same active ingredients as brand-name medications</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon icon="lucide:check" className="w-4 h-4 text-emerald-600" />
              <span className="text-gray-700 text-sm">Custom formulated by licensed US pharmacies</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon icon="lucide:check" className="w-4 h-4 text-emerald-600" />
              <span className="text-gray-700 text-sm">Physician oversight with personalized dosing</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
          <Icon icon="lucide:dollar-sign" className="w-4 h-4" />
          <span>Special pricing available • $0 due today • Only pay if prescribed</span>
        </div>
      </div>

      {/* Medication Selection Modal */}
      <MedicationModal
        isOpen={showMedicationModal}
        onClose={() => setShowMedicationModal(false)}
        medications={medications}
        selectedMedication={selectedMedication}
        onSelectMedication={setSelectedMedication}
      />
    </>
  );
};

