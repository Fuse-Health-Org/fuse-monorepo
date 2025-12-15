import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { QuestionnaireModal } from '../../components/QuestionnaireModal';

const WeightLossPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  // Open modal immediately when page loads
  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  // Handle modal close - stay on current subdomain and go to home page
  const handleModalClose = () => {
    setIsModalOpen(false);
    window.location.href = window.location.origin + '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Empty page content - modal handles everything */}
      <QuestionnaireModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        treatmentId="b689451f-db88-4c98-900e-df3dbcfebe2a" // Weight Loss 2 treatment ID
        treatmentName="Weight Loss 2"
      />
    </div>
  );
};

export default WeightLossPage;