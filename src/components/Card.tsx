import type { ReactNode } from "react";

type CardProps = {
    title: string;
    children: ReactNode;
    actions?: ReactNode;
};

export default function Card({ title, children, actions }: CardProps) {
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
