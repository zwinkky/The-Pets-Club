import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Card from "../components/Card";
import { fmt } from "../lib/utils";
import type { Product, ProductVariant } from "../lib/types";

type Row = {
    product_id: string;
    product_name: string;
    variant_id: string;
    variant_name: string;
    wholesale_price: number | null; // effective (override or default)
    retail_price: number | null;    // effective (override or default)
    has_override: boolean;
    is_active: boolean;
};

export default function ProductsPage({
    isAdmin,
    clientId,
    onBack,
}: {
    isAdmin: boolean;
    clientId: string;
    onBack: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Row[]>([]);

    // global catalog for creation & picker
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);

    // assign-to-client picker
    const [selProductId, setSelProductId] = useState<string>("");
    const [selVariantId, setSelVariantId] = useState<string>("");

    // create base product
    const [newProdName, setNewProdName] = useState("");

    // create base variant
    const [nvProductId, setNvProductId] = useState<string>("");
    const [nvName, setNvName] = useState("");
    const [nvWholesale, setNvWholesale] = useState<string>("");
    const [nvRetail, setNvRetail] = useState<string>("");
    const [nvAddToClient, setNvAddToClient] = useState(true);

    // ---- load only this client's catalog ----
    const loadCatalog = async () => {
        setLoading(true);
        setRows([]);
        const { data, error } = await supabase.rpc("client_catalog_for_admin", {
            p_client_id: clientId,
        });
        if (error) alert(error.message);
        setRows(((data || []) as Row[]) ?? []);
        setLoading(false);
    };

    // ---- load global products/variants for pickers ----
    const loadGlobals = async () => {
        const [{ data: p, error: e1 }, { data: v, error: e2 }] = await Promise.all([
            supabase.from("products").select("id,name").order("name"),
            supabase
                .from("product_variants")
                .select("id,product_id,name,wholesale_price,retail_price_default")
                .order("name"),
        ]);
        if (e1) alert(e1.message);
        if (e2) alert(e2.message);
        setAllProducts(p || []);
        setAllVariants(v || []);
    };

    useEffect(() => {
        setRows([]);
        setSelProductId("");
        setSelVariantId("");
        setNvProductId("");
        setNvName("");
        setNvWholesale("");
        setNvRetail("");
        loadCatalog();
        loadGlobals();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId]);

    // picker options (hide already-assigned variants)
    const assignedVariantIds = useMemo(
        () => new Set(rows.map((r) => r.variant_id)),
        [rows]
    );
    const variantsByProduct = useMemo(() => {
        const map: Record<string, ProductVariant[]> = {};
        for (const v of allVariants) {
            if (assignedVariantIds.has(v.id)) continue;
            (map[v.product_id] ||= []).push(v);
        }
        return map;
    }, [allVariants, assignedVariantIds]);

    // ---------- assign/remove for this client ----------
    const addVariantToClient = async () => {
        if (!selProductId || !selVariantId) return alert("Select a product and variant first.");
        const { error } = await supabase
            .from("client_product_variants")
            .upsert(
                { client_id: clientId, variant_id: selVariantId, is_active: true },
                { onConflict: "client_id,variant_id" }
            );
        if (error) return alert(error.message);
        setSelVariantId("");
        await loadCatalog();
    };

    const removeVariantFromClient = async (variant_id: string) => {
        if (!confirm("Remove this variant from this client's catalog?")) return;
        const { error } = await supabase
            .from("client_product_variants")
            .delete()
            .eq("client_id", clientId)
            .eq("variant_id", variant_id);
        if (error) return alert(error.message);
        await loadCatalog();
    };

    // ---------- NEW: per-client price overrides ----------
    const editWholesaleOverride = async (variant_id: string) => {
        const val = prompt("Wholesale price for THIS CLIENT (leave blank to clear):", "");
        if (val === null) return;
        const patch =
            val.trim() === ""
                ? { custom_wholesale_price: null }
                : { custom_wholesale_price: Number(val) || 0 };
        const { error } = await supabase
            .from("client_product_variants")
            .update(patch)
            .eq("client_id", clientId)
            .eq("variant_id", variant_id);
        if (error) return alert(error.message);
        await loadCatalog();
    };

    const editRetailOverride = async (variant_id: string) => {
        const val = prompt("Retail price for THIS CLIENT (leave blank to clear):", "");
        if (val === null) return;
        const patch =
            val.trim() === ""
                ? { custom_retail_price: null }
                : { custom_retail_price: Number(val) || 0 };
        const { error } = await supabase
            .from("client_product_variants")
            .update(patch)
            .eq("client_id", clientId)
            .eq("variant_id", variant_id);
        if (error) return alert(error.message);
        await loadCatalog();
    };

    const clearOverrides = async (variant_id: string) => {
        const { error } = await supabase
            .from("client_product_variants")
            .update({ custom_wholesale_price: null, custom_retail_price: null })
            .eq("client_id", clientId)
            .eq("variant_id", variant_id);
        if (error) return alert(error.message);
        await loadCatalog();
    };

    // ---------- create base product / variant ----------
    const createProduct = async () => {
        const name = newProdName.trim();
        if (!name) return;
        const { data, error } = await supabase
            .from("products")
            .insert({ name })
            .select("id")
            .single();
        if (error) return alert(error.message);
        setNewProdName("");
        await loadGlobals();
        if (data?.id) setNvProductId(data.id);
    };

    const createVariant = async () => {
        if (!nvProductId) return alert("Choose a product for the new variant.");
        const name = nvName.trim();
        if (!name) return alert("Variant name is required.");
        const wholesale = Number(nvWholesale || "0");
        const retail = Number(nvRetail || "0");

        const { data, error } = await supabase
            .from("product_variants")
            .insert({
                product_id: nvProductId,
                name,
                wholesale_price: wholesale,
                retail_price_default: retail,
            })
            .select("id")
            .single();
        if (error) return alert(error.message);

        if (nvAddToClient && data?.id) {
            const link = await supabase
                .from("client_product_variants")
                .upsert(
                    { client_id: clientId, variant_id: data.id, is_active: true },
                    { onConflict: "client_id,variant_id" }
                );
            if (link.error) return alert(link.error.message);
        }

        setNvName(""); setNvWholesale(""); setNvRetail("");
        await Promise.all([loadGlobals(), loadCatalog()]);
    };

    // group rows by product for display
    const grouped = useMemo(() => {
        const byProduct: Record<string, { name: string; variants: Row[] }> = {};
        for (const r of rows) {
            if (!byProduct[r.product_id]) byProduct[r.product_id] = { name: r.product_name, variants: [] };
            byProduct[r.product_id].variants.push(r);
        }
        return byProduct;
    }, [rows]);

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <button className="underline" onClick={onBack}>← Back</button>
            <h1 className="text-2xl font-bold">Client Product List</h1>
            <div className="text-xs text-gray-600">Client ID: {clientId}</div>

            {isAdmin && (
                <Card title="Create New Product (Global)">
                    <div className="grid gap-2 md:grid-cols-4 items-center">
                        <input
                            className="border rounded-lg p-2"
                            placeholder="Product name (e.g., Shampoo)"
                            value={newProdName}
                            onChange={(e) => setNewProdName(e.target.value)}
                        />
                        <button className="bg-black text-white rounded-lg py-2" onClick={createProduct}>
                            Create Product
                        </button>
                    </div>
                </Card>
            )}

            {isAdmin && (
                <Card title="Create New Variant (Global)">
                    <div className="grid gap-2 md:grid-cols-6 items-center">
                        <select className="border rounded-lg p-2" value={nvProductId} onChange={(e) => setNvProductId(e.target.value)}>
                            <option value="">Select product…</option>
                            {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className="border rounded-lg p-2" placeholder="Variant name (e.g., 1L)" value={nvName} onChange={(e) => setNvName(e.target.value)} />
                        <input className="border rounded-lg p-2 text-right" placeholder="Wholesale" type="number" value={nvWholesale} onChange={(e) => setNvWholesale(e.target.value)} />
                        <input className="border rounded-lg p-2 text-right" placeholder="Retail (default)" type="number" value={nvRetail} onChange={(e) => setNvRetail(e.target.value)} />
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={nvAddToClient} onChange={(e) => setNvAddToClient(e.target.checked)} />
                            Also add to this client
                        </label>
                        <button className="bg-black text-white rounded-lg py-2" onClick={createVariant}>
                            Create Variant
                        </button>
                    </div>
                </Card>
            )}

            {isAdmin && (
                <Card title="Add Variant to this Client">
                    <div className="grid gap-2 md:grid-cols-4 items-center">
                        <select className="border rounded-lg p-2" value={selProductId} onChange={(e) => { setSelProductId(e.target.value); setSelVariantId(""); }}>
                            <option value="">Select product…</option>
                            {allProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>

                        <select className="border rounded-lg p-2" value={selVariantId} onChange={(e) => setSelVariantId(e.target.value)} disabled={!selProductId}>
                            <option value="">{selProductId ? "Select variant…" : "Pick a product first"}</option>
                            {(variantsByProduct[selProductId] || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>

                        <button className="bg-black text-white rounded-lg py-2" onClick={addVariantToClient}>Add to Client</button>
                        <button className="border rounded-lg py-2" onClick={loadCatalog}>Reload</button>
                    </div>
                </Card>
            )}

            <Card title="Products for this Client">
                {loading ? (
                    <div className="text-sm text-gray-600">Loading…</div>
                ) : rows.length === 0 ? (
                    <div className="text-sm text-gray-600">No variants assigned to this client yet.</div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(grouped).map(([pid, group]) => (
                            <div key={pid} className="border rounded-xl p-3 bg-white">
                                <div className="font-medium mb-2">{group.name}</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">Variant</th>
                                                <th className="p-2 text-right">Wholesale</th>
                                                <th className="p-2 text-right">Retail</th>
                                                <th className="p-2 text-center">Override?</th>
                                                <th className="p-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.variants.map((r) => (
                                                <tr key={r.variant_id} className="border-b">
                                                    <td className="p-2">{r.variant_name}</td>
                                                    <td className="p-2 text-right">
                                                        {r.wholesale_price == null ? "—" : `₱${fmt(Number(r.wholesale_price))}`}
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        {r.retail_price == null ? "—" : `₱${fmt(Number(r.retail_price))}`}
                                                    </td>
                                                    <td className="p-2 text-center">{r.has_override ? "✔" : "—"}</td>
                                                    <td className="p-2 text-right space-x-3">
                                                        <button className="underline" onClick={() => editWholesaleOverride(r.variant_id)}>
                                                            Edit wholesale
                                                        </button>
                                                        <button className="underline" onClick={() => editRetailOverride(r.variant_id)}>
                                                            Edit retail
                                                        </button>
                                                        {r.has_override && (
                                                            <button className="underline" onClick={() => clearOverrides(r.variant_id)}>
                                                                Use defaults
                                                            </button>
                                                        )}
                                                        <button className="text-red-600" onClick={() => removeVariantFromClient(r.variant_id)}>
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
