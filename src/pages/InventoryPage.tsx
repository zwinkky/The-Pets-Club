import Card from "../components/Card";

export default function InventoryPage({
    onOpenSection,
}: {
    onOpenSection: (s: "raw" | "general" | "client") => void;
}) {
    const Tile = ({
        title,
        desc,
        onClick,
    }: {
        title: string;
        desc: string;
        onClick: () => void;
    }) => (
        <button
            onClick={onClick}
            className="w-full text-left rounded-2xl p-5 bg-white shadow hover:shadow-md transition border"
        >
            <div className="text-lg font-semibold mb-1">{title}</div>
            <div className="text-sm text-gray-600">{desc}</div>
        </button>
    );

    return (
        <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Tile
                    title="Raw Inventory"
                    desc="Raw materials, unfinished goods, packaging supplies."
                    onClick={() => onOpenSection("raw")}
                />
                <Tile
                    title="General Inventory"
                    desc="Finished but unlabeled items ready for labeling/fulfillment."
                    onClick={() => onOpenSection("general")}
                />
                <Tile
                    title="Clients"
                    desc="Per-client labeled inventory and shipments."
                    onClick={() => onOpenSection("client")}
                />
            </div>

            <Card>
                <div className="p-4 text-sm text-gray-600">
                    Tip: Use <span className="font-mono">Inventory → Clients</span> when you convert unlabeled
                    stock to a client-labeled batch (TRANSFER), and use{" "}
                    <span className="font-mono">OUT</span> when shipping to the client.
                </div>
            </Card>
        </div>
    );
}
