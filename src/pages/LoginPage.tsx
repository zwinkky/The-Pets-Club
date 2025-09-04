import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        setLoading(false);
        if (error) setErr(error.message);
        // success: App listens to onAuthStateChange and will route to dashboard
    };

    return (
        <div className="min-h-screen grid place-items-center p-6">
            <div className="w-full max-w-sm bg-white border rounded-2xl p-6 shadow-sm">
                <h1 className="text-2xl font-bold mb-4">Login</h1>
                <form onSubmit={submit} className="space-y-3">
                    <input
                        className="w-full border rounded-lg p-2"
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <input
                        className="w-full border rounded-lg p-2"
                        type="password"
                        placeholder="Password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        required
                    />
                    {err && <div className="text-sm text-red-600">{err}</div>}
                    <button className="w-full bg-black text-white py-2 rounded-lg" disabled={loading}>
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}
