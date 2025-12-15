import React from "react";

export const SuccessStoriesView: React.FC = () => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-medium text-gray-900 mb-3">But first, I want you to meet...</h3>
        <p className="text-gray-600 text-sm">Real customers who've achieved amazing results with HeyFeels</p>
      </div>

      <div
        className="overflow-x-auto mb-8 cursor-grab active:cursor-grabbing scrollbar-hidden"
        onMouseDown={(e) => {
          const container = e.currentTarget;
          const startX = e.pageX - container.offsetLeft;
          const scrollLeft = container.scrollLeft;

          const handleMouseMove = (e: MouseEvent) => {
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 1;
            container.scrollLeft = scrollLeft - walk;
          };

          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      >
        <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
          {/* Alex's testimonial */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-shrink-0" style={{ width: '254px' }}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="relative">
                <img
                  src="/before-after/m-before-0.webp"
                  alt="Alex before"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
                  Before
                </div>
              </div>
              <div className="relative">
                <img
                  src="/before-after/m-after-0.webp"
                  alt="Alex after"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium">
                  After
                </div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Alex, 28</h3>
            <p className="text-gray-600 mb-4">
              Lost <span className="text-emerald-600 font-semibold">14 pounds</span> in 4 months
            </p>
            <div className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Verified Customer
            </div>
          </div>

          {/* Jordan's testimonial */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-shrink-0" style={{ width: '254px' }}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="relative">
                <img
                  src="/before-after/m-before-1.webp"
                  alt="Jordan before"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
                  Before
                </div>
              </div>
              <div className="relative">
                <img
                  src="/before-after/m-after-1.webp"
                  alt="Jordan after"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium">
                  After
                </div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Jordan, 32</h3>
            <p className="text-gray-600 mb-4">
              Lost <span className="text-emerald-600 font-semibold">18 pounds</span> in 5 months
            </p>
            <div className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Verified Customer
            </div>
          </div>

          {/* Taylor's testimonial */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-shrink-0" style={{ width: '254px' }}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="relative">
                <img
                  src="/before-after/m-before-2.webp"
                  alt="Taylor before"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
                  Before
                </div>
              </div>
              <div className="relative">
                <img
                  src="/before-after/m-after-2.webp"
                  alt="Taylor after"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium">
                  After
                </div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Taylor, 35</h3>
            <p className="text-gray-600 mb-4">
              Lost <span className="text-emerald-600 font-semibold">12 pounds</span> in 3 months
            </p>
            <div className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Verified Customer
            </div>
          </div>

          {/* Casey's testimonial */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-shrink-0" style={{ width: '254px' }}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="relative">
                <img
                  src="/before-after/m-before-3.webp"
                  alt="Casey before"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
                  Before
                </div>
              </div>
              <div className="relative">
                <img
                  src="/before-after/m-after-3.webp"
                  alt="Casey after"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-1 rounded text-xs font-medium">
                  After
                </div>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Casey, 41</h3>
            <p className="text-gray-600 mb-4">
              Lost <span className="text-emerald-600 font-semibold">16 pounds</span> in 6 months
            </p>
            <div className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Verified Customer
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-gray-600 text-base leading-relaxed">
          Swipe to see more success stories and start your own transformation journey.
        </p>
      </div>
    </div>
  );
};

