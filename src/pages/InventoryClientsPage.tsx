import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { InventoryTable } from "./inventory/InventoryCommon";

type Client = { id: string; name: string };

export default function InventoryClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [clientId, setClientId] = useState<string>("");

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from("clients").select("id,name").order("name", { ascending: true });
            setClients((data ?? []) as Client[]);
        })();
    }, []);

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <div className="text-lg font-semibold">Clients</div>
                <select
                    className="ml-auto border px-3 py-2 rounded w-72"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                >
                    <option value="">Select a client…</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            <InventoryTable
                type="client"
                title={clientId ? "Client Inventory" : "Client Inventory"}
                clientId={clientId || null}
                disableNew={!clientId}
            />
        </div>
    );
}
