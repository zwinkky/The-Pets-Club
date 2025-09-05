import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../components/Card";
import { fmt } from "../lib/utils";
import type { Product } from "../lib/types";

type VariantOption = {
    id: string;
    product_id: string;
    name: string;
    wholesale_price?: number | null;      // optional (editors won't see)
    retail_price_default: number | null;
};

type Item = {
    row_id?: string;
    product_name: string;
    variation: string;
    qty: number;
    wholesale_price?: number; // admin-only
    retail_price: number;
    product_id?: string;
    variant_id?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function OrderEditor({
    isAdmin,
    orderId,
    clientId,
    onCancel,
}: {
    isAdmin: boolean;
    orderId?: string;
    clientId: string;
    onCancel: (clientId: string) => void;
}) {
    const [orderCode, setOrderCode] = useState("");
    const [orderDate, setOrderDate] = useState<string>(today());
    const [shopFees, setShopFees] = useState<number>(0);
    const [items, setItems] = useState<Item[]>([
        { product_name: "", variation: "", qty: 1, wholesale_price: isAdmin ? 0 : undefined, retail_price: 0 },
    ]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [originalItemIds, setOriginalItemIds] = useState<string[]>([]);

    // client-scoped catalog
    const [products, setProducts] = useState<Product[]>([]);
    const [variants, setVariants] = useState<VariantOption[]>([]);
    const variantsByProduct = useMemo(
        () =>
            variants.reduce<Record<string, VariantOption[]>>((acc, v) => {
                (acc[v.product_id] ||= []).push(v);
                return acc;
            }, {}),
        [variants]
    );

    useEffect(() => {
        (async () => {
            setLoading(true);

            // 1) Load client-scoped catalog
            let catRows: any[] = [];
            if (isAdmin) {
                const { data, error } = await supabase.rpc("client_catalog_for_admin", { p_client_id: clientId });
                if (error) alert(error.message);
                catRows = (data || []) as any[];
            } else {
                const editor = await supabase.rpc("client_catalog_for_editor", { p_client_id: clientId });
                if (editor.error) {
                    const admin = await supabase.rpc("client_catalog_for_admin", { p_client_id: clientId });
                    if (admin.error) alert(admin.error.message);
                    catRows = (admin.data || []) as any[];
                } else {
                    catRows = (editor.data || []) as any[];
                }
            }

            // Build LOCAL arrays (strings for IDs) — we'll reconcile with these
            const prodMap = new Map<string, Product>();
            const varList: VariantOption[] = [];
            for (const r of catRows) {
                const pid = String(r.product_id);
                const vid = String(r.variant_id);

                if (!prodMap.has(pid)) {
                    prodMap.set(pid, { id: pid, name: r.product_name } as Product);
                }
                varList.push({
                    id: vid,
                    product_id: pid,
                    name: r.variant_name,
                    wholesale_price: isAdmin ? (r.wholesale_price ?? null) : null,
                    retail_price_default: r.retail_price ?? null,
                });
            }
            const prods = Array.from(prodMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            const vars = varList;

            // Push to state for rendering
            setProducts(prods);
            setVariants(vars);

            // 2) Load order if editing
            if (!orderId) {
                setOrderCode(Date.now().toString());
                setOrderDate(today());
                setOriginalItemIds([]);
                setLoading(false);
                return;
            }

            const { data: order, error: e1 } = await supabase
                .from("orders")
                .select("*")
                .eq("id", orderId)
                .single();
            if (e1) {
                alert(e1.message);
                setLoading(false);
                return;
            }
            setOrderCode(order.order_code);
            setOrderDate(order.order_date || today());
            setShopFees(Number(order.shop_fees));

            let rows: any[] = [];
            if (isAdmin) {
                const { data: its, error: e2 } = await supabase
                    .from("order_items")
                    .select("id,product_name,variation,qty,wholesale_price,retail_price")
                    .eq("order_id", orderId)
                    .order("id");
                if (e2) alert(e2.message);
                rows = its || [];
            } else {
                const rpc = await supabase.rpc("order_items_for_editor", { p_order_id: orderId });
                if (rpc.error) {
                    const { data: its, error: e2 } = await supabase
                        .from("order_items")
                        .select("id,product_name,variation,qty,retail_price")
                        .eq("order_id", orderId)
                        .order("id");
                    if (e2) alert(e2.message);
                    rows = its || [];
                } else {
                    rows = (rpc.data || []).map((r: any) => ({
                        id: r.id,
                        product_name: r.product_name,
                        variation: r.variation,
                        qty: Number(r.quantity) || 0,
                        retail_price: Number(r.retail_price) || 0,
                    }));
                }
            }

            // 3) Reconcile using the freshly fetched LOCAL catalog (not stale state)
            const reconciled: Item[] = rows.map((it: any) => {
                const prod =
                    prods.find((pp) => pp.name === it.product_name) || // usual path (matching by name)
                    undefined;

                const vlist = prod ? vars.filter((vv) => vv.product_id === String(prod.id)) : [];
                const varMatch = vlist.find((vv) => vv.name === it.variation);

                return {
                    row_id: String(it.id),
                    product_name: it.product_name,
                    variation: it.variation,
                    qty: Number(it.qty) || 0,
                    wholesale_price: isAdmin ? Number(it.wholesale_price) || 0 : undefined,
                    retail_price: Number(it.retail_price) || 0,
                    product_id: prod ? String(prod.id) : undefined,
                    variant_id: varMatch ? String(varMatch.id) : undefined,
                };
            });

            setItems(reconciled);
            setOriginalItemIds(reconciled.map((r) => r.row_id!).filter(Boolean));
            setLoading(false);
        })();
    }, [orderId, isAdmin, clientId]);

    const addItem = () =>
        setItems((prev) => [
            ...prev,
            { product_name: "", variation: "", qty: 1, wholesale_price: isAdmin ? 0 : undefined, retail_price: 0 },
        ]);
    const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
    const updateItem = (idx: number, patch: Partial<Item>) =>
        setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

    // totals
    const wholesaleTotal = useMemo(
        () => items.reduce((s, it) => s + (it.qty || 0) * (it.wholesale_price || 0), 0),
        [items]
    );
    const retailTotal = useMemo(
        () => items.reduce((s, it) => s + (it.qty || 0) * (it.retail_price || 0), 0),
        [items]
    );
    const orderIncome = useMemo(() => retailTotal - (shopFees || 0), [retailTotal, shopFees]);
    const clientProfit = useMemo(() => orderIncome - wholesaleTotal, [orderIncome, wholesaleTotal]);

    // selects
    const onSelectProduct = (idx: number, product_id: string) => {
        const prod = products.find((p) => String(p.id) === String(product_id));
        updateItem(idx, {
            product_id: product_id ? String(product_id) : undefined,
            product_name: prod?.name || "",
            variant_id: undefined,
            variation: "",
            wholesale_price: isAdmin ? 0 : undefined,
            retail_price: 0,
        });
    };

    const onSelectVariant = (idx: number, variant_id: string) => {
        const v = variants.find((x) => String(x.id) === String(variant_id));
        if (!v) return;
        updateItem(idx, {
            variant_id: String(variant_id),
            variation: v.name,
            wholesale_price: isAdmin ? Number(v.wholesale_price ?? 0) : undefined,
            retail_price: Number(v.retail_price_default ?? 0),
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            let id = orderId;

            // upsert order header
            if (!id) {
                const { data, error } = await supabase
                    .from("orders")
                    .insert({
                        client_id: clientId,
                        order_code: orderCode || Date.now().toString(),
                        shop_fees: shopFees,
                        order_date: orderDate,
                    })
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

            // deletions
            const currentIds = items.map((it) => it.row_id).filter(Boolean) as string[];
            const toDelete = originalItemIds.filter((oid) => !currentIds.includes(oid));
            if (toDelete.length > 0) {
                const { error } = await supabase.from("order_items").delete().in("id", toDelete);
                if (error) throw error;
            }

            // updates
            const updates = items
                .filter((it) => it.row_id)
                .map((it) => {
                    const patch: any = {
                        product_name: (it.product_name || "").trim(),
                        variation: (it.variation || "").trim(),
                        qty: Number(it.qty) || 0,
                        retail_price: Number(it.retail_price) || 0,
                    };
                    if (isAdmin) patch.wholesale_price = Number(it.wholesale_price) || 0;
                    return supabase.from("order_items").update(patch).eq("id", it.row_id);
                });
            if (updates.length) {
                const results = await Promise.all(updates);
                const err = results.find((r) => r.error);
                if (err?.error) throw err.error;
            }

            // inserts
            const insertsData = items
                .filter((it) => !it.row_id)
                .map((it) => {
                    const base: any = {
                        order_id: id,
                        product_name: (it.product_name || "").trim(),
                        variation: (it.variation || "").trim(),
                        qty: Number(it.qty) || 0,
                        retail_price: Number(it.retail_price) || 0,
                    };
                    if (isAdmin) base.wholesale_price = Number(it.wholesale_price) || 0;
                    return base;
                });
            if (insertsData.length) {
                const { error } = await supabase.from("order_items").insert(insertsData);
                if (error) throw error;
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
                        <input className="w-full border rounded-lg p-2" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-sm">Shop Fees</label>
                        <input className="w-full border rounded-lg p-2" type="number" value={shopFees} onChange={(e) => setShopFees(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-sm">Order Date</label>
                        <input className="w-full border rounded-lg p-2" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
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
                                {isAdmin && <th className="p-2 text-right">Wholesale price</th>}
                                {isAdmin && <th className="p-2 text-right">Wholesale total</th>}
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
                                                {products.map((p) => (
                                                    <option key={String(p.id)} value={String(p.id)}>{p.name}</option>
                                                ))}
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
                                                {opts.map((v) => (
                                                    <option key={String(v.id)} value={String(v.id)}>{v.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-2 text-right">
                                            <input
                                                className="w-24 border rounded p-1 text-right"
                                                type="number"
                                                value={it.qty}
                                                onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                                            />
                                        </td>

                                        {isAdmin && (
                                            <>
                                                <td className="p-2 text-right">
                                                    <input
                                                        className="w-28 border rounded p-1 text-right"
                                                        type="number"
                                                        value={it.wholesale_price || 0}
                                                        onChange={(e) => updateItem(idx, { wholesale_price: Number(e.target.value) })}
                                                    />
                                                </td>
                                                <td className="p-2 text-right">₱{fmt(wTotal)}</td>
                                            </>
                                        )}

                                        <td className="p-2 text-right">
                                            <input
                                                className="w-28 border rounded p-1 text-right"
                                                type="number"
                                                value={it.retail_price}
                                                onChange={(e) => updateItem(idx, { retail_price: Number(e.target.value) })}
                                            />
                                        </td>
                                        <td className="p-2 text-right">₱{fmt(rTotal)}</td>
                                        <td className="p-2 text-right">
                                            <button className="text-red-600" onClick={() => removeItem(idx)}>Remove</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid gap-3 md:grid-cols-4">
                {isAdmin && <SummaryBox label="Wholesale Total" value={wholesaleTotal} />}
                <SummaryBox label="Retail Total" value={retailTotal} />
                <SummaryBox label="Order Income (Retail - Fees)" value={orderIncome} />
                {isAdmin && <SummaryBox label="Client Profit (Income - Wholesale)" value={clientProfit} />}
            </div>

            <div className="flex gap-2">
                <button className="bg-black text-white rounded-lg px-4 py-2" onClick={save} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                </button>
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
