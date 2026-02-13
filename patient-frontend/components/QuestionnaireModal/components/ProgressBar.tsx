import React from "react";

interface ProgressBarProps {
    progressPercent: number;
    color: string;
    backgroundColor?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    progressPercent,
    color,
    backgroundColor = "rgba(0,0,0,0.08)",
}) => (
    <div className="w-full rounded-full h-2 mb-8" style={{ backgroundColor }}>
        <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%`, background: color }}
        />
    </div>
);


