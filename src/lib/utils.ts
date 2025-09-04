import type { Order } from "./types";

export function fmt(n: number) {
    return (n || 0).toFixed(2);
}

export function calcOrderTotals(o: Order) {
    const wholesale_total = o.items.reduce((s, it) => s + it.qty * it.wholesale_price, 0);
    const retail_total = o.items.reduce((s, it) => s + it.qty * it.retail_price, 0);
    const order_income = retail_total - o.shop_fees;
    const client_profit = order_income - wholesale_total;
    return { wholesale_total, retail_total, order_income, client_profit };
}
