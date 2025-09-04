import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../components/Card";
import type { Client } from "../lib/types";
import { fmt } from "../lib/utils";

type OrderTotalsRow = {
    order_id: string;
    order_code: string;
    client_id: string;
    wholesale_total: string;
    retail_total: string;
    shop_fees: string;
    order_income: string;
    client_profit: string;
};

type OrderDateMap = Record<string, string>; // order_id -> YYYY-MM-DD

export default function ClientPage({
    clientId,
    onBack,
    onNewOrder,
    onOpenOrder,
    onOpenProducts,
}: {
    clientId: string;
    onBack: () => void;
    onNewOrder: (clientId: string) => void;
    onOpenOrder: (orderId: string, clientId: string) => void;
    onOpenProducts: () => void;
}) {
    const [client, setClient] = useState<Client | null>(null);
    const [orders, setOrders] = useState<OrderTotalsRow[]>([]);
    const [orderDates, setOrderDates] = useState<OrderDateMap>({});
    const [loading, setLoading] = useState(true);

    // admins or editors can delete orders
    const [canDeleteOrders, setCanDeleteOrders] = useState(false);

    const load = async () => {
        setLoading(true);

        // client
        const { data: c, error: e1 } = await supabase
            .from("clients")
            .select("*")
            .eq("id", clientId)
            .single();
        if (e1) {
            alert(e1.message);
            setLoading(false);
            return;
        }
        setClient(c as Client);

        // order totals
        const { data: o, error: e2 } = await supabase
            .from("order_totals")
            .select("*")
            .eq("client_id", clientId)
            .order("order_code", { ascending: false });
        if (e2) alert(e2.message);
        setOrders((o || []) as any);

        // order dates
        const { data: od, error: e3 } = await supabase
            .from("orders")
            .select("id, order_date")
            .eq("client_id", clientId);
        if (e3) alert(e3.message);
        const map: OrderDateMap = {};
        (od || []).forEach((row: any) => {
            map[row.id] = row.order_date;
        });
        setOrderDates(map);

        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [clientId]);

    useEffect(() => {
        // Check role: admin OR editor can delete orders
        (async () => {
            const [adm, edt] = await Promise.all([supabase.rpc("is_admin"), supabase.rpc("is_editor")]);
            setCanDeleteOrders(Boolean(adm.data) || Boolean(edt.data));
        })();
    }, []);

    // -------- Totals (across all orders) --------
    const totals = useMemo(() => {
        const sum = { w: 0, r: 0, f: 0, inc: 0, prof: 0 };
        for (const o of orders) {
            sum.w += Number(o.wholesale_total) || 0;
            sum.r += Number(o.retail_total) || 0;
            sum.f += Number(o.shop_fees) || 0;
            sum.inc += Number(o.order_income) || 0;
            sum.prof += Number(o.client_profit) || 0;
        }
        return sum;
    }, [orders]);

    const deleteOrder = async (orderId: string) => {
        if (!canDeleteOrders) return alert("You don't have permission to delete orders.");
        if (!confirm("Delete this order? This cannot be undone.")) return;
        const { error } = await supabase.from("orders").delete().eq("id", orderId);
        if (error) return alert(error.message);
        await load();
    };

    if (!client)
        return (
            <div className="max-w-6xl mx-auto p-6">
                <button className="underline" onClick={onBack}>
                    ← Back
                </button>
                <div className="mt-4">{loading ? "Loading…" : "Client not found."}</div>
            </div>
        );

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <button className="underline" onClick={onBack}>
                        ← Back
                    </button>
                    <h1 className="text-2xl font-bold">{client.name}</h1>
                    <div className="text-sm text-gray-600">
                        {client.contact} · {client.notes}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="bg-white border rounded-lg px-4 py-2" onClick={onOpenProducts}>
                        Product List
                    </button>
                    <button
                        className="bg-black text-white rounded-lg px-4 py-2"
                        onClick={() => onNewOrder(client.id)}
                    >
                        New Order
                    </button>
                </div>
            </div>

            {/* ---- Totals section ---- */}
            <Card title="Totals">
                {loading ? (
                    <div className="text-sm text-gray-600">Calculating…</div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-5">
                        <SummaryBox label="Wholesale Total" value={totals.w} />
                        <SummaryBox label="Retail Total" value={totals.r} />
                        <SummaryBox label="Shop Fees" value={totals.f} />
                        <SummaryBox label="Order Income" value={totals.inc} />
                        <SummaryBox label="Client Profit" value={totals.prof} />
                    </div>
                )}
            </Card>

            {/* ---- Orders table ---- */}
            <Card title="Orders">
                {loading ? (
                    <div className="text-sm text-gray-600">Loading…</div>
                ) : orders.length === 0 ? (
                    <div className="text-sm text-gray-600">No orders yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-2 text-left">Order Date</th>
                                    <th className="p-2 text-left">Order ID</th>
                                    <th className="p-2 text-right">Wholesale Total</th>
                                    <th className="p-2 text-right">Retail Total</th>
                                    <th className="p-2 text-right">Shop Fees</th>
                                    <th className="p-2 text-right">Order Income</th>
                                    <th className="p-2 text-right">Client Profit</th>
                                    <th className="p-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => {
                                    const date = orderDates[o.order_id];
                                    return (
                                        <tr key={o.order_id} className="border-b">
                                            <td className="p-2">
                                                {date ? new Date(date).toLocaleDateString() : "—"}
                                            </td>
                                            <td className="p-2">{o.order_code}</td>
                                            <td className="p-2 text-right">₱{fmt(Number(o.wholesale_total))}</td>
                                            <td className="p-2 text-right">₱{fmt(Number(o.retail_total))}</td>
                                            <td className="p-2 text-right">₱{fmt(Number(o.shop_fees))}</td>
                                            <td className="p-2 text-right">₱{fmt(Number(o.order_income))}</td>
                                            <td className="p-2 text-right">₱{fmt(Number(o.client_profit))}</td>
                                            <td className="p-2 text-right">
                                                <button
                                                    className="underline"
                                                    onClick={() => onOpenOrder(o.order_id, o.client_id)}
                                                >
                                                    Open
                                                </button>
                                                {canDeleteOrders && (
                                                    <button
                                                        className="text-red-600 ml-2"
                                                        onClick={() => deleteOrder(o.order_id)}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

function SummaryBox({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white border rounded-2xl p-3">
            <div className="text-xs text-gray-600">{label}</div>
            <div className="text-lg font-semibold">₱{fmt(value)}</div>
        </div>
    );
}
