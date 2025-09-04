import React from "react";

export default function Card({
    title,
    children,
    actions,
}: {
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{title}</div>
                {actions}
            </div>
            {children}
        </div>
    );
}
