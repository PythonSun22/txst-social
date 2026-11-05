(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/frontend/src/components/AuthForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/@supabase/auth-js/dist/module/lib/errors.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function describeAuthError(cause, mode) {
    if (cause instanceof __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthError"]) {
        if (cause.code === "over_email_send_rate_limit") {
            return "Too many attempts right now — please wait a few minutes and try again.";
        }
        // The DB's txstate.edu-only trigger (FR-01) rejects the insert with its
        // own message, but Supabase's Auth API wraps any DB error at signup into
        // this generic, unhelpful text rather than passing the real one through.
        // We catch the txstate.edu case earlier, client-side, so this is the
        // fallback for anything else that hits it.
        if (cause.status === 500) {
            return "Something went wrong creating your account. Please try again.";
        }
        return cause.message;
    }
    if (cause instanceof Error) return cause.message;
    if (mode === "signup") return "Sign-up failed.";
    if (mode === "confirm") return "That code didn't work.";
    return "Sign-in failed.";
}
function AuthForm() {
    _s();
    const [profile, setProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("signin");
    const [email, setEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [pendingEmail, setPendingEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [code, setCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [message, setMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthForm.useEffect": ()=>{
            let active = true;
            let request;
            async function refresh() {
                request?.abort();
                const controller = new AbortController();
                request = controller;
                try {
                    const current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])(controller.signal);
                    if (active && !controller.signal.aborted) {
                        setProfile(current);
                        setError("");
                    }
                } catch (cause) {
                    if (active && !controller.signal.aborted) {
                        setProfile(null);
                        setError(cause instanceof Error ? cause.message : "Unable to load your account.");
                    }
                } finally{
                    if (active && !controller.signal.aborted) setLoading(false);
                }
            }
            try {
                const { data } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.onAuthStateChange({
                    "AuthForm.useEffect": ()=>{
                        // Leave the Auth callback before asking the SDK for the current session.
                        queueMicrotask({
                            "AuthForm.useEffect": ()=>{
                                if (active) void refresh();
                            }
                        }["AuthForm.useEffect"]);
                    }
                }["AuthForm.useEffect"]);
                void refresh();
                return ({
                    "AuthForm.useEffect": ()=>{
                        active = false;
                        request?.abort();
                        data.subscription.unsubscribe();
                    }
                })["AuthForm.useEffect"];
            } catch (cause) {
                queueMicrotask({
                    "AuthForm.useEffect": ()=>{
                        if (active) {
                            setError(cause instanceof Error ? cause.message : "Sign-in is unavailable.");
                            setLoading(false);
                        }
                    }
                }["AuthForm.useEffect"]);
                return ({
                    "AuthForm.useEffect": ()=>{
                        active = false;
                    }
                })["AuthForm.useEffect"];
            }
        }
    }["AuthForm.useEffect"], []);
    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        try {
            if (mode === "signup") {
                const trimmedEmail = email.trim();
                // FR-01 is enforced for real by a DB trigger, but Supabase's Auth API
                // wraps the trigger's rejection into a generic "Database error saving
                // new user" message instead of passing it through (confirmed against
                // the real project) — so we check client-side first for a message
                // that's actually useful.
                if (!trimmedEmail.toLowerCase().endsWith("@txstate.edu")) {
                    setError("Boko Lynx is limited to Texas State (txstate.edu) email addresses.");
                    setBusy(false);
                    return;
                }
                const { data, error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.signUp({
                    email: trimmedEmail,
                    password
                });
                if (error) throw error;
                // Supabase returns 200 with an empty identities array instead of an
                // error when the email is already registered, to avoid leaking which
                // addresses exist.
                if (data.user && data.user.identities?.length === 0) {
                    setError("An account with this email may already exist. Try signing in, or check your inbox if you haven't confirmed it yet.");
                } else {
                    // A plain confirmation link can be "clicked" by a mail security
                    // scanner (e.g. TXST's Microsoft 365 gateway) before the student
                    // ever opens the email, silently confirming accounts nobody asked
                    // to confirm. A code the student has to type can't be guessed by a
                    // scanner that only fetches URLs, so we use verifyOtp instead of
                    // relying on the emailed link.
                    setPendingEmail(trimmedEmail);
                    setMessage("Enter the confirmation code we emailed you.");
                    setMode("confirm");
                }
            } else if (mode === "confirm") {
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.verifyOtp({
                    email: pendingEmail,
                    token: code.trim(),
                    type: "email"
                });
                if (error) throw error;
                setCode("");
                setPendingEmail("");
            } else {
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.signInWithPassword({
                    email: email.trim(),
                    password
                });
                if (error) throw error;
            }
            setPassword("");
        } catch (cause) {
            setError(describeAuthError(cause, mode));
        } finally{
            setBusy(false);
        }
    }
    async function signOut() {
        setBusy(true);
        setError("");
        try {
            const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.signOut({
                scope: "local"
            });
            if (error) throw error;
            setProfile(null);
            setMessage("Signed out.");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Sign-out failed.");
        } finally{
            setBusy(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "max-w-md space-y-4 py-4",
        children: [
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Loading account…"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 142,
                columnNumber: 17
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                children: error
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 143,
                columnNumber: 15
            }, this),
            message && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: message
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 144,
                columnNumber: 17
            }, this),
            profile ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "Signed in as ",
                            profile.display_name || profile.username,
                            "."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 146,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: profile.email_verified ? "Your Texas State email is verified." : "Verify your Texas State email before posting."
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 147,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 145,
                columnNumber: 16
            }, this) : mode === "confirm" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: submit,
                className: "space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "Enter the code we emailed to ",
                            pendingEmail,
                            "."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 149,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-gray-500",
                        children: "Don't see it? Check your Junk/Spam folder — Texas State's mail filter sometimes routes it there."
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 150,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block",
                        children: [
                            "Confirmation code",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "block w-full rounded border p-2",
                                type: "text",
                                inputMode: "numeric",
                                autoComplete: "one-time-code",
                                required: true,
                                value: code,
                                onChange: (event)=>setCode(event.target.value)
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                                lineNumber: 155,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 154,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "rounded border px-4 py-2",
                        disabled: busy,
                        type: "submit",
                        children: busy ? "Please wait…" : "Confirm"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 157,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "block text-sm underline",
                        type: "button",
                        disabled: busy,
                        onClick: ()=>{
                            setMode("signup");
                            setCode("");
                            setPendingEmail("");
                            setError("");
                            setMessage("");
                        },
                        children: "Start over"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 160,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 148,
                columnNumber: 32
            }, this) : !loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: submit,
                className: "space-y-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: mode === "signup" ? "Create an account with your Texas State email." : "Sign in with your existing Texas State account."
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 169,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block",
                        children: [
                            "Texas State email",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "block w-full rounded border p-2",
                                type: "email",
                                autoComplete: "username",
                                required: true,
                                value: email,
                                onChange: (event)=>setEmail(event.target.value)
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                                lineNumber: 175,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 174,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "block",
                        children: [
                            "Password",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                className: "block w-full rounded border p-2",
                                type: "password",
                                autoComplete: mode === "signup" ? "new-password" : "current-password",
                                required: true,
                                minLength: 6,
                                value: password,
                                onChange: (event)=>setPassword(event.target.value)
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                                lineNumber: 178,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 177,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "rounded border px-4 py-2",
                        disabled: busy,
                        type: "submit",
                        children: busy ? "Please wait…" : mode === "signup" ? "Sign up" : "Sign in"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 180,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "block text-sm underline",
                        type: "button",
                        disabled: busy,
                        onClick: ()=>{
                            setMode(mode === "signup" ? "signin" : "signup");
                            setError("");
                            setMessage("");
                        },
                        children: mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/AuthForm.tsx",
                        lineNumber: 183,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 168,
                columnNumber: 27
            }, this),
            !loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "rounded border px-4 py-2",
                disabled: busy,
                onClick: signOut,
                children: "Sign out"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/AuthForm.tsx",
                lineNumber: 192,
                columnNumber: 18
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/AuthForm.tsx",
        lineNumber: 141,
        columnNumber: 10
    }, this);
}
_s(AuthForm, "8IaQtcQVKNKS8pv15jX5cx6rg68=");
_c = AuthForm;
var _c;
__turbopack_context__.k.register(_c, "AuthForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=frontend_src_components_AuthForm_tsx_0pn78px._.js.map