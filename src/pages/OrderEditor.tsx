import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../components/Card";
import { fmt } from "../lib/utils";
import type { Product, ProductVariant } from "../lib/types";

type Item = {
    product_name: string;
    variation: string;
    qty: number;
    wholesale_price: number;
    retail_price: number;
    // local helper fields for the selects (not stored in DB)
    product_id?: string;
    variant_id?: string;
};

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

export default function OrderEditor({
    orderId,
    clientId,
    onCancel,
}: {
    orderId?: string;
    clientId: string;
    onCancel: (clientId: string) => void;
}) {
    const [orderCode, setOrderCode] = useState("");
    const [orderDate, setOrderDate] = useState<string>(today());
    const [shopFees, setShopFees] = useState<number>(0);
    const [items, setItems] = useState<Item[]>([{ product_name: "", variation: "", qty: 1, wholesale_price: 0, retail_price: 0 }]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // products/variants for dropdowns
    const [products, setProducts] = useState<Product[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const variantsByProduct = useMemo(
        () => variants.reduce<Record<string, ProductVariant[]>>((acc, v) => { (acc[v.product_id] ||= []).push(v); return acc; }, {}),
        [variants]
    );

    useEffect(() => {
        (async () => {
            // load catalog
            const [{ data: p }, { data: v }] = await Promise.all([
                supabase.from("products").select("id,name").order("name"),
                supabase.from("product_variants").select("id,product_id,name,wholesale_price,retail_price_default").order("name"),
            ]);
            setProducts(p || []);
            setVariants(v || []);

            // load order if editing
            if (!orderId) {
                setOrderCode(Date.now().toString());
                setOrderDate(today());
                setLoading(false);
                return;
            }
            const { data: order, error: e1 } = await supabase.from("orders").select("*").eq("id", orderId).single();
            if (e1) { alert(e1.message); setLoading(false); return; }
            setOrderCode(order.order_code);
            setOrderDate(order.order_date || today());
            setShopFees(Number(order.shop_fees));

            const { data: its, error: e2 } = await supabase
                .from("order_items")
                .select("product_name,variation,qty,wholesale_price,retail_price")
                .eq("order_id", orderId)
                .order("id");
            if (e2) alert(e2.message);

            const reconciled = (its || []).map((it: any) => {
                // try to map names back to ids (best-effort)
                const prod = (p || []).find((pp) => pp.name === it.product_name);
                const vlist = prod ? (v || []).filter((vv) => vv.product_id === prod.id) : [];
                const varMatch = vlist.find(vv => vv.name === it.variation);
                return {
                    ...it,
                    product_id: prod?.id,
                    variant_id: varMatch?.id,
                } as Item;
            });

            setItems(reconciled);
            setLoading(false);
        })();
    }, [orderId]);

    const addItem = () => setItems(prev => [...prev, { product_name: "", variation: "", qty: 1, wholesale_price: 0, retail_price: 0 }]);
    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
    const updateItem = (idx: number, patch: Partial<Item>) => setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

    // totals
    const wholesaleTotal = useMemo(() => items.reduce((s, it) => s + (it.qty || 0) * (it.wholesale_price || 0), 0), [items]);
    const retailTotal = useMemo(() => items.reduce((s, it) => s + (it.qty || 0) * (it.retail_price || 0), 0), [items]);
    const orderIncome = useMemo(() => retailTotal - (shopFees || 0), [retailTotal, shopFees]);
    const clientProfit = useMemo(() => orderIncome - wholesaleTotal, [orderIncome, wholesaleTotal]);

    // handlers for dependent selects
    const onSelectProduct = (idx: number, product_id: string) => {
        const prod = products.find(p => p.id === product_id);
        updateItem(idx, {
            product_id,
            product_name: prod?.name || "",
            variant_id: undefined,
            variation: "",
            wholesale_price: 0, // reset until variant chosen
        });
    };

    const onSelectVariant = (idx: number, variant_id: string) => {
        const v = variants.find(x => x.id === variant_id);
        if (!v) return;
        updateItem(idx, {
            variant_id,
            variation: v.name,
            wholesale_price: Number(v.wholesale_price) || 0, // auto-fill wholesale
            retail_price: Number(v.retail_price_default ?? 0) || 0,       // NEW: auto-fill retail default
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            let id = orderId;

            if (!id) {
                const { data, error } = await supabase
                    .from("orders")
                    .insert({ client_id: clientId, order_code: orderCode || Date.now().toString(), shop_fees: shopFees, order_date: orderDate })
                    .select("id")
                    .single();
                if (error) throw error;
                id = data!.id;
            } else {
                const { error } = await supabase
                    .from("orders")
                    .update({ order_code: orderCode, shop_fees: shopFees, order_date: orderDate })
                    .eq("id", id);
                if (error) throw error;
            }

            // Replace items
            const { error: eDel } = await supabase.from("order_items").delete().eq("order_id", id!);
            if (eDel) throw eDel;

            const payload = items.map((it) => ({
                order_id: id,
                product_name: (it.product_name || "").trim(),
                variation: (it.variation || "").trim(),
                qty: Number(it.qty) || 0,
                wholesale_price: Number(it.wholesale_price) || 0,
                retail_price: Number(it.retail_price) || 0,
            }));
            if (payload.length > 0) {
                const { error: eIns } = await supabase.from("order_items").insert(payload);
                if (eIns) throw eIns;
            }

            onCancel(clientId);
        } catch (err: any) {
            alert(err.message || String(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="max-w-6xl mx-auto p-6">Loading…</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
            <button className="underline" onClick={() => onCancel(clientId)}>← Back</button>
            <h1 className="text-2xl font-bold">{orderId ? "Edit Order" : "New Order"}</h1>

            <Card title="Order Info">
                <div className="grid gap-3 md:grid-cols-3">
                    <div>
                        <label className="text-sm">Order ID</label>
                        <input className="w-full border rounded-lg p-2" value={orderCode} onChange={e => setOrderCode(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm">Shop Fees</label>
                        <input className="w-full border rounded-lg p-2" type="number" value={shopFees} onChange={e => setShopFees(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-sm">Order Date</label>
                        <input className="w-full border rounded-lg p-2" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                    </div>
                </div>
            </Card>

            <Card title="Items" actions={<button className="text-sm underline" onClick={addItem}>+ Add item</button>}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2 text-left">Product</th>
                                <th className="p-2 text-left">Variant</th>
                                <th className="p-2 text-right">Qty</th>
                                <th className="p-2 text-right">Wholesale price</th>
                                <th className="p-2 text-right">Wholesale total</th>
                                <th className="p-2 text-right">Retail price</th>
                                <th className="p-2 text-right">Retail total</th>
                                <th className="p-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((it, idx) => {
                                const wTotal = (it.qty || 0) * (it.wholesale_price || 0);
                                const rTotal = (it.qty || 0) * (it.retail_price || 0);
                                const opts = it.product_id ? (variantsByProduct[it.product_id] || []) : [];
                                return (
                                    <tr key={idx} className="border-b">
                                        <td className="p-2">
                                            <select
                                                className="w-full border rounded p-1"
                                                value={it.product_id || ""}
                                                onChange={(e) => onSelectProduct(idx, e.target.value)}
                                            >
                                                <option value="">Select product…</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select
                                                className="w-full border rounded p-1"
                                                value={it.variant_id || ""}
                                                onChange={(e) => onSelectVariant(idx, e.target.value)}
                                                disabled={!it.product_id}
                                            >
                                                <option value="">{it.product_id ? "Select variant…" : "Pick a product first"}</option>
                                                {opts.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-2 text-right"><input className="w-24 border rounded p-1 text-right" type="number" value={it.qty} onChange={e => updateItem(idx, { qty: Number(e.target.value) })} /></td>
                                        <td className="p-2 text-right"><input className="w-28 border rounded p-1 text-right" type="number" value={it.wholesale_price} onChange={e => updateItem(idx, { wholesale_price: Number(e.target.value) })} /></td>
                                        <td className="p-2 text-right">₱{fmt(wTotal)}</td>
                                        <td className="p-2 text-right"><input className="w-28 border rounded p-1 text-right" type="number" value={it.retail_price} onChange={e => updateItem(idx, { retail_price: Number(e.target.value) })} /></td>
                                        <td className="p-2 text-right">₱{fmt(rTotal)}</td>
                                        <td className="p-2 text-right"><button className="text-red-600" onClick={() => removeItem(idx)}>Remove</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid gap-3 md:grid-cols-4">
                <SummaryBox label="Wholesale Total" value={wholesaleTotal} />
                <SummaryBox label="Retail Total" value={retailTotal} />
                <SummaryBox label="Order Income (Retail - Fees)" value={orderIncome} />
                <SummaryBox label="Client Profit (Income - Wholesale)" value={clientProfit} />
            </div>

            <div className="flex gap-2">
                <button className="bg-black text-white rounded-lg px-4 py-2" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
                <button className="px-4 py-2" onClick={() => onCancel(clientId)}>Cancel</button>
            </div>
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
