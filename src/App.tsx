import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientPage from "./pages/ClientPage";
import OrderEditor from "./pages/OrderEditor";
import ProductsPage from "./pages/ProductsPage";

type AppRoute =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "client"; params: { id: string } }
  | { name: "order"; params: { id?: string; clientId: string } }
  | { name: "products"; params: { clientId: string; fromClientId?: string } };

type UserRole = "admin" | "editor";

export default function App() {
  const [route, setRoute] = useState<AppRoute>({ name: "login" });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // render immediately with a safe default
  const [userRole, setUserRole] = useState<UserRole>("editor");
  const isLoggedIn = !!session;
  const isAdmin = userRole === "admin";

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

  // ---- init auth (don’t block UI on role fetch) ----
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
          setRoute({ name: "dashboard" });
          loadRole(s.user.id); // fire-and-forget
        } else {
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) {
        setRoute({ name: "dashboard" });
        loadRole(s.user.id);
      } else {
        setUserRole("editor");
        setRoute({ name: "login" });
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

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
      setRoute(fromClientId ? { name: "client", params: { id: fromClientId } } : { name: "dashboard" });
    }
  }, [isAdmin, route.name]); // eslint-disable-line react-hooks/exhaustive-deps

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
              // 3) optional: best-effort global revoke (ignore failures)
              // try { await supabase.auth.signOut({ scope: "global" }); } catch {}
            }}
            onHome={() => go({ name: "dashboard" })}
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
              // pass clientId so Products is always scoped
              onOpenProducts={() =>
                go({ name: "products", params: { clientId: route.params.id, fromClientId: route.params.id } })
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
                go(fromClientId ? { name: "client", params: { id: fromClientId } } : { name: "dashboard" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function Topbar({
  onSignOut,
  onHome,
}: {
  onSignOut: () => void | Promise<void>;
  onHome: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-6xl mx-auto p-3 flex items-center justify-between">
        <button className="text-lg font-semibold" onClick={onHome}>
          Sales Record System
        </button>
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
