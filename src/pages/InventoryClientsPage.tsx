import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { InventoryTable } from "./inventory/InventoryCommon";

export default function InventoryClientsPage() {
    const [clientId, setClientId] = useState<string | null>(null);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from("clients").select("id,name").order("name");
            setClients((data ?? []) as any);
        })();
    }, []);

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
            {/* header: title left, select right */}
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-semibold">Clients</h1>

                <select
                    className="border px-3 py-2 rounded w-64 shrink-0"
                    value={clientId ?? ""}
                    onChange={(e) => setClientId(e.target.value || null)}
                    aria-label="Select a client"
                >
                    <option value="">Select a client...</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            <InventoryTable
                type="client"
                title="Client Inventory"
                clientId={clientId}
                disableNew={!clientId}
            />
        </div>
    );
}
