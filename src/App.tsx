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
  // ⬇️ require clientId so Products is always scoped to a client
  | { name: "products"; params: { clientId: string; fromClientId?: string } };

type UserRole = "admin" | "editor";

export default function App() {
  const [route, setRoute] = useState<AppRoute>({ name: "login" });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // role: render immediately with safe default
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

  // ---- init auth (don’t wait on role to render UI) ----
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
          loadRole(s.user.id); // non-blocking
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

  // --- ROUTE GUARD: hide Products for editors + require clientId ---
  const go = (next: AppRoute) => {
    if (next.name === "products") {
      if (!isAdmin) return setRoute({ name: "dashboard" });
      if (!next.params?.clientId) return setRoute({ name: "dashboard" }); // must be scoped
    }
    setRoute(next);
  };

  // Safety: if role changes while on Products, bounce away
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
              await supabase.auth.signOut();
            }}
            onHome={() => go({ name: "dashboard" })}
          />

          {route.name === "dashboard" && (
            <DashboardPage
              isAdmin={isAdmin}
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
              // ⬇️ pass the clientId into Products so it’s scoped
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
              clientId={route.params.clientId}  // ⬅️ ProductsPage should accept this prop
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
  return (
    <div className="sticky top-0 z-10 bg-white border-b">
      <div className="max-w-6xl mx-auto p-3 flex items-center justify-between">
        <button className="text-lg font-semibold" onClick={onHome}>
          Sales Record System
        </button>
        <button className="text-sm text-red-600" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
