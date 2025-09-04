import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabaseClient";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ClientPage from "./pages/ClientPage";
import OrderEditor from "./pages/OrderEditor";
import ProductsPage from "./pages/ProductsPage";

export default function App() {
  const [route, setRoute] = useState<{
    name: "login" | "dashboard" | "client" | "order" | "products";
    params?: any;
  }>({ name: "login" });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthReady(true);
      setRoute({ name: data.session ? "dashboard" : "login" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setRoute({ name: s ? "dashboard" : "login" });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) return null;
  const isLoggedIn = !!session;

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
            onHome={() => setRoute({ name: "dashboard" })}
          />

          {route.name === "dashboard" && (
            <DashboardPage
              onOpenClient={(cId) => setRoute({ name: "client", params: { id: cId } })}
            />
          )}

          {route.name === "client" && (
            <ClientPage
              clientId={route.params.id}
              onBack={() => setRoute({ name: "dashboard" })}
              onNewOrder={(clientId) => setRoute({ name: "order", params: { clientId } })}
              onOpenOrder={(orderId, clientId) =>
                setRoute({ name: "order", params: { id: orderId, clientId } })
              }
              onOpenProducts={() =>
                setRoute({ name: "products", params: { fromClientId: route.params.id } })
              }
            />
          )}

          {route.name === "order" && (
            <OrderEditor
              orderId={route.params?.id}
              clientId={route.params.clientId}
              onCancel={(clientId) => setRoute({ name: "client", params: { id: clientId } })}
            />
          )}

          {route.name === "products" && (
            <ProductsPage
              onBack={() => {
                const fromClientId = route.params?.fromClientId;
                setRoute(
                  fromClientId
                    ? { name: "client", params: { id: fromClientId } }
                    : { name: "dashboard" }
                );
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
