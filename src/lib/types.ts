export type Client = {
    id: string;
    name: string;
    contact?: string;
    notes?: string;
};

export type OrderItem = {
    id: string;
    product_name: string;
    variation?: string;
    qty: number;
    wholesale_price: number;
    retail_price: number;
};

export type Order = {
    id: string;
    client_id: string;
    order_code: string;
    shop_fees: number;
    items: OrderItem[];
    // new (from DB): order_date lives on orders table itself (not inside items)
};

export type Product = {
    id: string;
    name: string;
};

export type ProductVariant = {
    id: string;
    product_id: string;
    name: string;
    wholesale_price: number;
    retail_price_default?: number | null;
};
