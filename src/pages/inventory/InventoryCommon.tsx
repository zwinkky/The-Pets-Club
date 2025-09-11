import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Card from "../../components/Card";

export type InventoryRow = {
    id: string;
    type: "raw" | "general" | "client";
    name: string;
    unit: string;
    location: string | null;
    batch_code: string | null;
    expiry_date: string | null;
    reorder_point: number | string;
    qty_on_hand: number | string;
    reorder_status: "In stock" | "Low stock" | "No stock";
    product_id?: string | null;
    variant_id?: string | null;
    client_id?: string | null;
    category?: string | null;          // text category
};

// Optional seeds to show in the UI until real data arrives
const STARTER_CATEGORY_OPTIONS = [

];

const fmtNum = (v: number | string | null | undefined) => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
    return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(
        Number.isFinite(n) ? n : 0
    );
};

function StatusChip({ status }: { status: InventoryRow["reorder_status"] }) {
    const cls =
        status === "No stock"
            ? "bg-red-500"
            : status === "Low stock"
                ? "bg-amber-500"
                : "bg-emerald-500";
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs text-white ${cls}`}>
            {status}
        </span>
    );
}

export function InventoryTable({
    type,
    title,
    clientId,
    disableNew,
    toolbarRight,
    searchDisabled,
}: {
    type: "raw" | "general" | "client";
    title: string;
    clientId?: string | null;
    disableNew?: boolean;
    toolbarRight?: ReactNode;
    searchDisabled?: boolean;
}) {
    const [rows, setRows] = useState<InventoryRow[]>([]);
    const [search, setSearch] = useState("");

    // Category filter + dynamic options
    const [categoryFilter, setCategoryFilter] = useState<string>("__ALL__");
    const [categoryOptions, setCategoryOptions] = useState<string[]>(
        STARTER_CATEGORY_OPTIONS
    );

    const showReorder = type === "raw";
    const colCount =
        1 + // name
        1 + // unit
        1 + // on hand
        (showReorder ? 1 : 0) +
        1 + // status
        1 + // category
        1; // actions

    async function load() {
        if (type === "client" && !clientId) {
            setRows([]);
            return;
        }

        let q = supabase
            .from("inventory_status")
            .select("*")
            .eq("type", type)
            .order("name", { ascending: true });

        if (type === "client" && clientId) q = q.eq("client_id", clientId);
        if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
        if (categoryFilter !== "__ALL__") q = q.eq("category", categoryFilter as any);

        const { data, error } = await q;
        if (error) return;

        let next = (data ?? []) as InventoryRow[];

        // Client-side fallback if needed
        if (
            categoryFilter !== "__ALL__" &&
            next.length &&
            next.some((r) => "category" in r)
        ) {
            next = next.filter((r) => (r.category ?? "__NONE__") === categoryFilter);
        }

        // Build/merge distinct category options from result
        const discovered = Array.from(
            new Set(
                next.map((r) => (r.category || "").trim()).filter(Boolean)
            )
        );
        setCategoryOptions((prev) =>
            Array.from(new Set([...(prev ?? []), ...discovered])).sort()
        );

        setRows(next);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, clientId, search, categoryFilter]);

    // When a new category is created from a modal, add to filter options immediately
    function handleCategoryCreated(c: string) {
        const v = c.trim();
        if (!v) return;
        setCategoryOptions((prev) =>
            prev.includes(v) ? prev : [...prev, v].sort()
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{title}</h2>

                <div className="ml-auto flex items-center gap-2">
                    {toolbarRight}

                    {/* Category filter */}
                    <label className="text-sm text-gray-700">Category</label>
                    <select
                        className="border rounded px-3 py-2 text-sm"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="__ALL__">All</option>
                        {categoryOptions.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    <input
                        placeholder="Search by name…"
                        className={`border px-3 py-2 rounded w-64 ${searchDisabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                            }`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        disabled={!!searchDisabled}
                    />

                    <NewItemButton
                        defaultType={type}
                        onCreated={load}
                        disabled={!!disableNew}
                        extraValues={type === "client" ? { client_id: clientId ?? null } : {}}
                        categoryOptions={categoryOptions}
                        onCategoryCreated={handleCategoryCreated}
                    />
                </div>
            </div>

            <Card>
                <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-0">
                            <tr className="text-xs uppercase tracking-wide text-gray-600">
                                <th className="p-2 text-left whitespace-nowrap min-w-[220px]">Name</th>
                                <th className="p-2 text-left whitespace-nowrap w-28">Unit</th>
                                <th className="p-2 text-right whitespace-nowrap w-32">On Hand</th>
                                {showReorder && (
                                    <th className="p-2 text-right whitespace-nowrap w-32">Reorder Pt</th>
                                )}
                                <th className="p-2 text-left whitespace-nowrap w-28">Status</th>
                                <th className="p-2 text-left whitespace-nowrap w-40">Category</th>
                                <th className="p-2 text-right whitespace-nowrap w-[260px]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="[&>tr:nth-child(even)]:bg-gray-50">
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t">
                                    <td className="p-2">{r.name}</td>
                                    <td className="p-2">{r.unit}</td>
                                    <td className="p-2 text-right tabular-nums">{fmtNum(r.qty_on_hand)}</td>
                                    {showReorder && (
                                        <td className="p-2 text-right tabular-nums">
                                            {fmtNum(r.reorder_point)}
                                        </td>
                                    )}
                                    <td className="p-2"><StatusChip status={r.reorder_status} /></td>
                                    <td className="p-2">{r.category || "—"}</td>
                                    <td className="p-2">
                                        <div className="flex items-center justify-end gap-2">
                                            <MovementMenu item={r} onChange={load} clientId={clientId || undefined} />
                                            <EditItemButton
                                                item={r}
                                                onSaved={load}
                                                categoryOptions={categoryOptions}
                                                onCategoryCreated={handleCategoryCreated}
                                            />
                                            <DeleteItemButton item={r} onDeleted={load} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && (
                                <tr>
                                    <td colSpan={colCount} className="p-8 text-center text-gray-500">
                                        {type === "client" && !clientId
                                            ? "Select a client to view items."
                                            : "No items yet."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

/* ---------- New Item ---------- */
function NewItemButton({
    defaultType,
    onCreated,
    extraValues = {},
    disabled,
    // NEW:
    categoryOptions = [],
    onCategoryCreated,
}: {
    defaultType: "raw" | "general" | "client";
    onCreated: () => void;
    extraValues?: Record<string, any>;
    disabled?: boolean;
    categoryOptions?: string[];
    onCategoryCreated?: (c: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("");
    const [reorderPoint, setReorderPoint] = useState(0);

    // typeable category
    const [category, setCategory] = useState<string>("");

    async function save() {
        const payload = {
            type: defaultType,
            name,
            unit,
            reorder_point: defaultType === "raw" ? reorderPoint : 0,
            category: category.trim() || null,
            ...extraValues,
        };

        const { error } = await supabase.from("inventory_items").insert(payload);
        if (error) return alert(error.message);

        // publish new category immediately
        const trimmed = category.trim();
        if (onCategoryCreated && trimmed && !categoryOptions.includes(trimmed)) {
            onCategoryCreated(trimmed);
        }

        setOpen(false);
        setName("");
        setUnit("");
        setReorderPoint(0);
        setCategory("");
        onCreated();
    }

    const btnCls = disabled
        ? "bg-gray-300 text-gray-600"
        : "bg-emerald-600 hover:bg-emerald-700 text-white";

    return (
        <>
            <button
                disabled={disabled}
                className={`px-3 py-2 rounded ${btnCls}`}
                onClick={() => !disabled && setOpen(true)}
            >
                + New {defaultType === "client" ? "Client Item" : defaultType === "general" ? "General Item" : "Raw Item"}
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-3">
                    <div className="bg-white p-4 rounded w-[420px] space-y-3 shadow-lg">
                        <h3 className="font-semibold text-lg">New {defaultType} item</h3>
                        <input
                            className="w-full border px-3 py-2 rounded"
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <div className="flex gap-2">
                            <input
                                className="flex-1 border px-3 py-2 rounded"
                                placeholder="Unit"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                required
                            />
                            {defaultType === "raw" && (
                                <input
                                    className="w-40 border px-3 py-2 rounded"
                                    type="number"
                                    placeholder="Reorder point"
                                    value={reorderPoint}
                                    onChange={(e) => setReorderPoint(+e.target.value)}
                                />
                            )}
                        </div>

                        {/* Typeable Category with suggestions */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Category</label>
                            <input
                                className="w-full border px-3 py-2 rounded"
                                list="inventory-category-options"
                                placeholder="Type or select a category…"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                required
                            />
                            <datalist id="inventory-category-options">
                                {categoryOptions.map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button className="px-3 py-2" onClick={() => setOpen(false)}>
                                Cancel
                            </button>
                            <button className="px-3 py-2 bg-black text-white rounded" onClick={save}>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ---------- Movements (IN / OUT / TRANSFER with conversion) ---------- */
function MovementMenu({
    item,
    onChange,
    clientId,
}: {
    item: InventoryRow;
    onChange: () => void;
    clientId?: string | null;
}) {
    const [open, setOpen] = useState<null | "in" | "out" | "transfer">(null);
    const [qty, setQty] = useState<number>(0);
    const [prodQty, setProdQty] = useState<number | "">("");
    const [note, setNote] = useState("");
    const [toItem, setToItem] = useState<{
        id: string;
        name: string;
        type: "raw" | "general" | "client";
        unit: string;
    } | null>(null);

    useEffect(() => {
        if (!open) {
            setQty(0);
            setProdQty("");
            setNote("");
            setToItem(null);
        }
    }, [open]);

    async function submit(kind: "in" | "out" | "transfer") {
        if (qty <= 0) return;

        if (kind === "transfer") {
            if (!toItem) return alert("Select destination item");

            const available = Number(item.qty_on_hand ?? 0);
            if (qty > available) return alert(`Not enough stock to transfer. Available: ${available}`);

            const finalProdQty = prodQty === "" ? qty : Number(prodQty);
            if (!Number.isFinite(finalProdQty) || finalProdQty < 0)
                return alert("Produced quantity must be a valid number.");

            if (finalProdQty === qty) {
                const { error } = await supabase.from("inventory_movements").insert({
                    item_id: toItem.id,
                    movement: "transfer",
                    qty,
                    note,
                    from_item_id: item.id,
                });
                if (error) return alert(error.message);
            } else {
                const outRes = await supabase.from("inventory_movements").insert({
                    item_id: item.id,
                    movement: "out",
                    qty,
                    note: note || `convert to ${toItem.name}`,
                });
                if (outRes.error) return alert(outRes.error.message);

                const inRes = await supabase.from("inventory_movements").insert({
                    item_id: toItem.id,
                    movement: "in",
                    qty: finalProdQty,
                    note: note || `from ${item.name}`,
                });
                if (inRes.error) {
                    await supabase.from("inventory_movements").insert({
                        item_id: item.id,
                        movement: "in",
                        qty,
                        note: "rollback: failed destination insert",
                    });
                    return alert(inRes.error.message);
                }
            }
        } else {
            const { error } = await supabase.from("inventory_movements").insert({
                item_id: item.id,
                movement: kind,
                qty,
                note,
            });
            if (error) return alert(error.message);
        }

        setOpen(null);
        onChange();
    }

    const ghostBtn =
        "px-2 py-1 rounded border bg-white hover:bg-gray-50 transition whitespace-nowrap";

    return (
        <>
            <button className={ghostBtn} onClick={() => setOpen("in")}>IN</button>
            <button className={ghostBtn} onClick={() => setOpen("out")}>OUT</button>
            <button className={ghostBtn} onClick={() => setOpen("transfer")}>Transfer</button>

            {!!open && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-3">
                    <div className="bg-white p-4 rounded w-[420px] space-y-3 shadow-lg">
                        <h3 className="font-semibold text-lg">
                            {open === "transfer" ? "Transfer" : open.toUpperCase()} — {item.name}
                        </h3>

                        <input
                            type="number"
                            min={0}
                            value={qty}
                            onChange={(e) => setQty(+e.target.value)}
                            placeholder={`Consumed qty (${item.unit})`}
                            className="w-full border px-3 py-2 rounded"
                        />

                        {open === "transfer" && (
                            <>
                                <TransferPicker
                                    sourceType={item.type}
                                    currentItemId={item.id}
                                    limitClientId={clientId}
                                    onPick={(opt) => {
                                        setToItem(opt);
                                        setProdQty("");
                                    }}
                                />
                                <input
                                    type="number"
                                    min={0}
                                    value={prodQty}
                                    onChange={(e) =>
                                        setProdQty(e.target.value === "" ? "" : +e.target.value)
                                    }
                                    placeholder={`Produced qty${toItem ? ` (${toItem.unit})` : ""}`}
                                    className="w-full border px-3 py-2 rounded"
                                    disabled={!toItem}
                                />
                            </>
                        )}

                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="w-full border px-3 py-2 rounded"
                        />

                        <div className="flex gap-2 justify-end">
                            <button className="px-3 py-2" onClick={() => setOpen(null)}>
                                Cancel
                            </button>
                            <button
                                className="px-3 py-2 bg-black text-white rounded"
                                onClick={() => submit(open!)}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ---------- Destination picker ---------- */
function TransferPicker({
    sourceType,
    currentItemId,
    limitClientId,
    onPick,
}: {
    sourceType: "raw" | "general" | "client";
    currentItemId: string;
    limitClientId?: string | null;
    onPick: (
        opt:
            | { id: string; name: string; type: "raw" | "general" | "client"; unit: string }
            | null
    ) => void;
}) {
    const [options, setOptions] = useState<
        { id: string; name: string; type: "raw" | "general" | "client"; unit: string }[]
    >([]);
    const [val, setVal] = useState("");

    useEffect(() => {
        (async () => {
            let q = supabase
                .from("inventory_items")
                .select("id,name,type,unit,client_id")
                .neq("id", currentItemId)
                .order("type", { ascending: true })
                .order("name", { ascending: true });

            if (sourceType === "raw") q = q.in("type", ["general"]);
            if (sourceType === "general") q = q.in("type", ["client"]);
            if (sourceType === "client") q = q.in("type", ["general"]);
            if (sourceType === "general" && limitClientId) q = q.eq("client_id", limitClientId);

            const { data, error } = await q;
            if (!error) {
                setOptions(((data ?? []) as any).map((d: any) => ({
                    id: d.id, name: d.name, type: d.type, unit: d.unit
                })));
            }
        })();
    }, [currentItemId, sourceType, limitClientId]);

    return (
        <select
            className="w-full border px-3 py-2 rounded"
            value={val}
            onChange={(e) => {
                const id = e.target.value;
                setVal(id);
                const found = options.find((o) => o.id === id) || null;
                onPick(found);
            }}
        >
            <option value="">Choose destination item</option>
            {options.map((o) => (
                <option key={o.id} value={o.id}>
                    {o.type.toUpperCase()} • {o.name} {o.unit ? `(${o.unit})` : ""}
                </option>
            ))}
        </select>
    );
}

/* ---------- Edit ---------- */
function EditItemButton({
    item,
    onSaved,
    // NEW:
    categoryOptions = [],
    onCategoryCreated,
}: {
    item: InventoryRow;
    onSaved: () => void;
    categoryOptions?: string[];
    onCategoryCreated?: (c: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const [name, setName] = useState(item.name);
    const [unit, setUnit] = useState(item.unit || "");
    const [reorderPoint, setReorderPoint] = useState<number>(
        Number(item.reorder_point ?? 0)
    );

    const [category, setCategory] = useState<string>(item.category || "");

    useEffect(() => {
        if (open) {
            setName(item.name);
            setUnit(item.unit || "");
            setReorderPoint(Number(item.reorder_point ?? 0));
            setCategory(item.category || "");
        }
    }, [open, item]);

    async function save() {
        if (!name.trim()) return alert("Name is required.");
        setBusy(true);

        const payload: Record<string, any> = {
            name: name.trim(),
            unit: unit.trim(),
            category: category.trim() || null,
        };
        if (item.type === "raw") payload.reorder_point = Number(reorderPoint || 0);

        const { error } = await supabase
            .from("inventory_items")
            .update(payload)
            .eq("id", item.id);

        setBusy(false);
        if (error) return alert(error.message);

        // publish new category if created here
        const trimmed = category.trim();
        if (onCategoryCreated && trimmed && !categoryOptions.includes(trimmed)) {
            onCategoryCreated(trimmed);
        }

        setOpen(false);
        onSaved();
    }

    return (
        <>
            <button
                className="px-2 py-1 rounded border hover:bg-gray-50 transition whitespace-nowrap"
                onClick={() => setOpen(true)}
                title="Edit this item"
            >
                Edit
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-3">
                    <div className="bg-white p-4 rounded w-[420px] space-y-3 shadow-lg">
                        <h3 className="font-semibold text-lg">Edit “{item.name}”</h3>

                        <input
                            className="w-full border px-3 py-2 rounded"
                            placeholder="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />

                        <div className="flex gap-2">
                            <input
                                className="flex-1 border px-3 py-2 rounded"
                                placeholder="Unit"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                            />
                            {item.type === "raw" && (
                                <input
                                    className="w-40 border px-3 py-2 rounded"
                                    type="number"
                                    placeholder="Reorder point"
                                    value={reorderPoint}
                                    onChange={(e) => setReorderPoint(+e.target.value)}
                                />
                            )}
                        </div>

                        {/* Typeable Category with suggestions */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Category</label>
                            <input
                                className="w-full border px-3 py-2 rounded"
                                list="inventory-category-options" // reuse the same datalist id
                                placeholder="Type or select a category…"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            />
                            <datalist id="inventory-category-options">
                                {categoryOptions.map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button className="px-3 py-2" onClick={() => setOpen(false)} disabled={busy}>
                                Cancel
                            </button>
                            <button
                                className="px-3 py-2 bg-black text-white rounded"
                                onClick={save}
                                disabled={busy}
                            >
                                {busy ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ---------- Delete ---------- */
function DeleteItemButton({ item, onDeleted }: { item: InventoryRow; onDeleted: () => void }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    async function doDelete() {
        setBusy(true);
        const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
        setBusy(false);
        if (error) return alert(error.message);
        setOpen(false);
        onDeleted();
    }

    return (
        <>
            <button
                className="px-2 py-1 rounded border text-red-600 hover:bg-red-50 transition whitespace-nowrap"
                onClick={() => setOpen(true)}
                title="Delete this item"
            >
                Delete
            </button>
            {open && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-3">
                    <div className="bg-white p-4 rounded w-[420px] space-y-3 shadow-lg">
                        <h3 className="font-semibold text-lg">Delete “{item.name}”?</h3>
                        <p className="text-sm text-gray-600">
                            This will permanently delete the item and its movement history.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button className="px-3 py-2" onClick={() => setOpen(false)} disabled={busy}>
                                Cancel
                            </button>
                            <button
                                className="px-3 py-2 bg-red-600 text-white rounded"
                                onClick={doDelete}
                                disabled={busy}
                            >
                                {busy ? "Deleting…" : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
