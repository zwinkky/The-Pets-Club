import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import Card from "../components/Card";
import type { Product, ProductVariant } from "../lib/types";

export default function ProductsPage({ onBack }: { onBack: () => void }) {
    const [products, setProducts] = useState<Product[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [loading, setLoading] = useState(true);

    const [newName, setNewName] = useState("");

    const load = async () => {
        setLoading(true);
        const [{ data: p, error: e1 }, { data: v, error: e2 }] = await Promise.all([
            supabase.from("products").select("id,name").order("name"),
            supabase
                .from("product_variants")
                .select("id,product_id,name,wholesale_price,retail_price_default")
                .order("name"),
        ]);
        if (e1) alert(e1.message);
        if (e2) alert(e2.message);
        setProducts(p || []);
        setVariants(v || []);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, []);

    const addProduct = async () => {
        if (!newName.trim()) return;
        const { error } = await supabase.from("products").insert({ name: newName.trim() });
        if (error) return alert(error.message);
        setNewName("");
        load();
    };

    const renameProduct = async (id: string) => {
        const n = prompt("New product name?");
        if (!n) return;
        const { error } = await supabase.from("products").update({ name: n }).eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const deleteProduct = async (id: string) => {
        if (!confirm("Delete product and its variants?")) return;
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const addVariant = async (product_id: string) => {
        const name = prompt("Variant name (e.g., Bloom Breeze 1L)?");
        if (!name) return;
        const wholesale = Number(prompt("Wholesale price?") || "0");
        const retail = Number(prompt("Retail price (default)?") || "0");
        const { error } = await supabase
            .from("product_variants")
            .insert({ product_id, name: name.trim(), wholesale_price: wholesale, retail_price_default: retail });
        if (error) return alert(error.message);
        load();
    };

    const renameVariant = async (id: string) => {
        const name = prompt("New variant name?");
        if (!name) return;
        const { error } = await supabase.from("product_variants").update({ name: name.trim() }).eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const editVariantWholesale = async (id: string) => {
        const val = prompt("New wholesale price?");
        if (val == null) return;
        const price = Number(val);
        const { error } = await supabase.from("product_variants").update({ wholesale_price: price }).eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const editVariantRetail = async (id: string) => {
        const val = prompt("New retail price (default)?");
        if (val == null) return;
        const price = Number(val);
        const { error } = await supabase.from("product_variants").update({ retail_price_default: price }).eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const deleteVariant = async (id: string) => {
        if (!confirm("Delete variant?")) return;
        const { error } = await supabase.from("product_variants").delete().eq("id", id);
        if (error) return alert(error.message);
        load();
    };

    const variantsByProduct = variants.reduce<Record<string, ProductVariant[]>>((acc, v) => {
        (acc[v.product_id] ||= []).push(v);
        return acc;
    }, {});

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            <button className="underline" onClick={onBack}>← Back</button>
            <h1 className="text-2xl font-bold">Product List</h1>

            <Card title="Add Product">
                <div className="grid gap-2 md:grid-cols-4">
                    <input
                        className="border rounded-lg p-2"
                        placeholder="Product name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <button className="bg-black text-white rounded-lg" onClick={addProduct}>
                        Add
                    </button>
                </div>
            </Card>

            <Card title="Products">
                {loading ? (
                    <div className="text-sm text-gray-600">Loading…</div>
                ) : products.length === 0 ? (
                    <div className="text-sm text-gray-600">No products yet.</div>
                ) : (
                    <div className="space-y-4">
                        {products.map((p) => (
                            <div key={p.id} className="border rounded-xl p-3 bg-white">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium">{p.name}</div>
                                    <div className="space-x-3 text-sm">
                                        <button className="underline" onClick={() => addVariant(p.id)}>+ Add variant</button>
                                        <button className="underline" onClick={() => renameProduct(p.id)}>Rename</button>
                                        <button className="text-red-600" onClick={() => deleteProduct(p.id)}>Delete</button>
                                    </div>
                                </div>

                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-2 text-left">Variant</th>
                                                <th className="p-2 text-right">Wholesale price</th>
                                                <th className="p-2 text-right">Retail price (default)</th>
                                                <th className="p-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(variantsByProduct[p.id] || []).map((v) => (
                                                <tr key={v.id} className="border-b">
                                                    <td className="p-2">{v.name}</td>
                                                    <td className="p-2 text-right">₱{Number(v.wholesale_price).toFixed(2)}</td>
                                                    <td className="p-2 text-right">₱{Number(v.retail_price_default ?? 0).toFixed(2)}</td>
                                                    <td className="p-2 text-right space-x-3">
                                                        <button className="underline" onClick={() => renameVariant(v.id)}>Rename</button>
                                                        <button className="underline" onClick={() => editVariantWholesale(v.id)}>Edit wholesale</button>
                                                        <button className="underline" onClick={() => editVariantRetail(v.id)}>Edit retail</button>
                                                        <button className="text-red-600" onClick={() => deleteVariant(v.id)}>Delete</button>
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
