// components/Card.tsx
import { ReactNode } from "react";

export type CardProps = {
    title?: ReactNode;          // ← make optional
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
};

export default function Card({ title, actions, className, children }: CardProps) {
    return (
        <div className={`bg-white border rounded-lg shadow-sm ${className ?? ""}`}>
            {(title || actions) && (
                <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="font-medium">{title}</div>
                    {actions ? <div>{actions}</div> : null}
                </div>
            )}
            <div className="p-3">{children}</div>
        </div>
    );
}
