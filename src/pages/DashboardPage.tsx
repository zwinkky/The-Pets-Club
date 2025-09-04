import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../components/Card";
import type { Client } from "../lib/types";

export default function DashboardPage({ onOpenClient }: { onOpenClient: (clientId: string) => void }) {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const [name, setName] = useState("");
    const [contact, setContact] = useState("");
    const [notes, setNotes] = useState("");

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.rpc("is_admin");
            if (!error) setIsAdmin(Boolean(data));
            load();
        })();
    }, []);

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("clients")
            .select("id,name,contact,notes,created_at")
            .order("created_at", { ascending: false });
        if (error) alert(error.message);
        setClients((data || []) as Client[]);
        setLoading(false);
    };

    const add = async () => {
        if (!name.trim()) return;
        const { error } = await supabase.from("clients").insert({ name: name.trim(), contact, notes });
        if (error) return alert(error.message);
        setName(""); setContact(""); setNotes("");
        load();
    };

    const rename = async (id: string) => {
        const n = prompt("New client name?");
        if (!n) return;
        const { error } = await supabase.from("clients").update({ name: n }).eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const del = async (id: string) => {
        if (!isAdmin) return alert("Only admins can delete clients.");
        if (!confirm("Delete this client and all of their orders?")) return;

        // Either call the RPC…
        const { error } = await supabase.rpc("admin_delete_client", { _client_id: id });

        // …or rely on direct delete (RLS will allow only admins)
        // const { error } = await supabase.from("clients").delete().eq("id", id);

        if (error) {
            if (error.message?.includes("not_admin")) alert("You are not an admin.");
            else if (error.message?.includes("not_found")) alert("Client not found.");
            else alert(error.message);
            return;
        }
        load();
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <Card title="Add Client">
                <div className="grid gap-2 md:grid-cols-4">
                    <input className="border rounded-lg p-2" placeholder="Client name" value={name} onChange={e => setName(e.target.value)} />
                    <input className="border rounded-lg p-2" placeholder="Contact" value={contact} onChange={e => setContact(e.target.value)} />
                    <input className="border rounded-lg p-2" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
                    <button className="bg-black text-white rounded-lg" onClick={add}>Add</button>
                </div>
            </Card>

            <Card title="Clients">
                {loading ? (
                    <div className="text-sm text-gray-600">Loading…</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Name</th>
                                    <th className="p-2 text-left">Contact</th>
                                    <th className="p-2 text-left">Notes</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map((c) => (
                                    <tr key={c.id} className="border-b">
                                        <td className="p-2">{c.name}</td>
                                        <td className="p-2">{c.contact}</td>
                                        <td className="p-2">{c.notes}</td>
                                        <td className="p-2 text-right space-x-2">
                                            <button className="underline" onClick={() => onOpenClient(c.id)}>View</button>
                                            <button className="underline" onClick={() => rename(c.id)}>Edit</button>
                                            {isAdmin && (
                                                <button className="text-red-600" onClick={() => del(c.id)}>Delete</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
