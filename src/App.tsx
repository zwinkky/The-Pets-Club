import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientPage from "./pages/ClientPage";
import OrderEditor from "./pages/OrderEditor";
import ProductsPage from "./pages/ProductsPage";

// Inventory hub + sections
import InventoryPage from "./pages/InventoryPage";               // hub (shows 3 tiles)
import InventoryRawPage from "./pages/InventoryRawPage";         // NEW
import InventoryGeneralPage from "./pages/InventoryGeneralPage"; // NEW
import InventoryClientsPage from "./pages/InventoryClientsPage"; // NEW

type AppRoute =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "client"; params: { id: string } }
  | { name: "order"; params: { id?: string; clientId: string } }
  | { name: "products"; params: { clientId: string; fromClientId?: string } }
  | { name: "inventory" }            // hub
  | { name: "inventory_raw" }        // NEW
  | { name: "inventory_general" }    // NEW
  | { name: "inventory_clients" };   // NEW

type UserRole = "admin" | "editor";

// ---- persist/restore route across tab switches/reloads ----
const ROUTE_KEY = "app_route";
const loadRoute = (): AppRoute => {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    return raw ? JSON.parse(raw) : { name: "login" };
  } catch {
    return { name: "login" };
  }
};
const saveRoute = (r: AppRoute) => {
  try {
    localStorage.setItem(ROUTE_KEY, JSON.stringify(r));
  } catch { }
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => loadRoute());

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // render immediately with a safe default
  const [userRole, setUserRole] = useState<UserRole>("editor");
  const isLoggedIn = !!session;
  const isAdmin = userRole === "admin";

  // keep route persisted
  useEffect(() => {
    saveRoute(route);
  }, [route]);

  // ---- helpers ----
  const loadRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (!error && data?.role) setUserRole(data.role as UserRole);
    else setUserRole("editor");
  };

  const getSessionWithTimeout = async (ms = 2500) => {
    return Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: Session | null } }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null } }), ms)
      ),
    ]);
  };

  // ---- init auth (don’t override route unless necessary) ----
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await getSessionWithTimeout();
        if (!mounted) return;

        const s = data.session ?? null;
        setSession(s);
        setAuthReady(true); // render now

        if (s) {
          // logged in: restore last route if we were on "login"
          loadRole(s.user.id); // fire-and-forget
          if (route.name === "login") {
            const last = loadRoute();
            setRoute(last.name === "login" ? { name: "dashboard" } : last);
          }
        } else {
          // logged out
          setUserRole("editor");
          setRoute({ name: "login" });
        }
      } catch {
        if (mounted) {
          setSession(null);
          setUserRole("editor");
          setAuthReady(true);
          setRoute({ name: "login" });
        }
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);

      // Only navigate on explicit sign-in/sign-out.
      if (event === "SIGNED_OUT") {
        setUserRole("editor");
        setRoute({ name: "login" });
      }
      if (event === "SIGNED_IN") {
        if (s) loadRole(s.user.id);
        const last = loadRoute();
        setRoute(last.name === "login" ? { name: "dashboard" } : last);
      }

      // Ignore TOKEN_REFRESHED / USER_UPDATED etc. to prevent unwanted jumps.
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // (route is intentionally not a dep to avoid loops)

  // --- ROUTE GUARD: Products is admin-only and must be scoped to a client ---
  const go = (next: AppRoute) => {
    if (next.name === "products") {
      if (!isAdmin) return setRoute({ name: "dashboard" });
      if (!next.params?.clientId) return setRoute({ name: "dashboard" });
    }
    setRoute(next);
  };

  // If role flips while on Products, bounce out
  useEffect(() => {
    if (route.name === "products" && !isAdmin) {
      const fromClientId = route.params?.fromClientId;
      setRoute(
        fromClientId
          ? { name: "client", params: { id: fromClientId } }
          : { name: "dashboard" }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, route.name]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-sm text-gray-500">Initializing…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {!isLoggedIn || route.name === "login" ? (
        <LoginPage />
      ) : (
        <>
          <Topbar
            active={route.name}
            onHome={() => go({ name: "dashboard" })}
            onOpenInventory={() => go({ name: "inventory" })}
            onSignOut={async () => {
              try {
                // 1) local sign out (no 403 spam)
                await supabase.auth.signOut({ scope: "local" });
              } finally {
                // 2) immediately clear local app state & navigate
                setSession(null);
                setUserRole("editor");
                setRoute({ name: "login" });
              }
              // 3) optional global revoke (ignore failures)
              // try { await supabase.auth.signOut({ scope: "global" }); } catch {}
            }}
          />

          {route.name === "dashboard" && (
            <DashboardPage
              onOpenClient={(cId) => go({ name: "client", params: { id: cId } })}
            />
          )}

          {route.name === "client" && (
            <ClientPage
              isAdmin={isAdmin}
              clientId={route.params.id}
              onBack={() => go({ name: "dashboard" })}
              onNewOrder={(clientId) => go({ name: "order", params: { clientId } })}
              onOpenOrder={(orderId, clientId) =>
                go({ name: "order", params: { id: orderId, clientId } })
              }
              onOpenProducts={() =>
                go({
                  name: "products",
                  params: {
                    clientId: route.params.id,
                    fromClientId: route.params.id,
                  },
                })
              }
            />
          )}

          {route.name === "order" && (
            <OrderEditor
              isAdmin={isAdmin}
              orderId={route.params?.id}
              clientId={route.params.clientId}
              onCancel={(clientId) => go({ name: "client", params: { id: clientId } })}
            />
          )}

          {route.name === "products" && (
            <ProductsPage
              isAdmin={isAdmin}
              clientId={route.params.clientId}
              onBack={() => {
                const fromClientId = route.params?.fromClientId;
                go(
                  fromClientId
                    ? { name: "client", params: { id: fromClientId } }
                    : { name: "dashboard" }
                );
              }}
            />
          )}

          {/* Inventory Hub + Section routes */}
          {route.name === "inventory" && (
            <InventoryPage
              onOpenSection={(s) =>
                go(
                  s === "raw"
                    ? { name: "inventory_raw" }
                    : s === "general"
                      ? { name: "inventory_general" }
                      : { name: "inventory_clients" }
                )
              }
            />
          )}
          {route.name === "inventory_raw" && <InventoryRawPage />}
          {route.name === "inventory_general" && <InventoryGeneralPage />}
          {route.name === "inventory_clients" && <InventoryClientsPage />}
        </>
      )}
    </div>
  );
}

function Topbar({
  active,
  onSignOut,
  onHome,
  onOpenInventory,
}: {
  active: AppRoute["name"];
  onSignOut: () => void | Promise<void>;
  onHome: () => void;
  onOpenInventory: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const btn = (isActive: boolean) =>
    `px-3 py-2 rounded ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 hover:bg-gray-200"}`;

  // Highlight Inventory for the hub and all section pages
  const isInv =
    active === "inventory" ||
    active === "inventory_raw" ||
    active === "inventory_general" ||
    active === "inventory_clients";

  return (
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-6xl mx-auto p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="text-lg font-semibold mr-2" onClick={onHome}>
            Sales Record System
          </button>
          <button className={btn(active === "dashboard")} onClick={onHome}>
            Dashboard
          </button>
          <button className={btn(isInv)} onClick={onOpenInventory}>
            Inventory
          </button>
        </div>

        <button
          className="text-sm text-red-600"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            try {
              await onSignOut();
            } finally {
              setSigningOut(false);
            }
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
