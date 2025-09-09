// lib/utils.ts
import type { Order } from "./types";

/** Safely coerce possible string/nil numerics to a finite number */
export function num(v: number | string | null | undefined): number {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) ? (n as number) : 0;
}

/** Base number formatter */
function formatNumber(
    v: number | string | null | undefined,
    opts: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }
): string {
    const n = num(v);
    return new Intl.NumberFormat("en-PH", opts).format(n);
}

/** Currency formatter */
function formatMoney(
    v: number | string | null | undefined,
    currency = "PHP",
    opts: Intl.NumberFormatOptions = {}
): string {
    const n = num(v);
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency,
        ...opts,
    }).format(n);
}

/** Percent formatter (expects 0–1) */
function formatPercent(
    v: number | string | null | undefined,
    opts: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }
): string {
    const n = num(v);
    return new Intl.NumberFormat("en-PH", {
        style: "percent",
        ...opts,
    }).format(n);
}

/**
 * Backward-compatible formatter + namespaced helpers.
 * - You can still call `fmt(123)` -> "123.00"
 * - Or use `fmt.number(123)`, `fmt.money(123)`, `fmt.percent(0.15)`
 */
type FmtFn = {
    (n: number | string | null | undefined): string;
    number: (v: number | string | null | undefined, opts?: Intl.NumberFormatOptions) => string;
    money: (v: number | string | null | undefined, currency?: string, opts?: Intl.NumberFormatOptions) => string;
    percent: (v: number | string | null | undefined, opts?: Intl.NumberFormatOptions) => string;
};

export const fmt: FmtFn = Object.assign(
    // Legacy behavior: fixed 2 decimals (with locale separators)
    (n: number | string | null | undefined) =>
        formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    {
        number: formatNumber,
        money: formatMoney,
        percent: formatPercent,
    }
);

/** Totals with safe coercion (handles string numerics and missing values) */
export function calcOrderTotals(o: Order) {
    const wholesale_total = (o.items ?? []).reduce(
        (s, it) => s + num(it.qty) * num(it.wholesale_price),
        0
    );
    const retail_total = (o.items ?? []).reduce(
        (s, it) => s + num(it.qty) * num(it.retail_price),
        0
    );
    const shop_fees = num((o as any).shop_fees); // keep flexible if type doesn't include it
    const order_income = retail_total - shop_fees;
    const client_profit = order_income - wholesale_total;

    return { wholesale_total, retail_total, order_income, client_profit };
}
