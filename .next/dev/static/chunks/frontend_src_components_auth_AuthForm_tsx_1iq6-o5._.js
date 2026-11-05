(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/frontend/src/components/auth/AuthForm.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AuthForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f40$supabase$2f$auth$2d$js$2f$dist$2f$module$2f$lib$2f$errors$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/@supabase/auth-js/dist/module/lib/errors.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/profiles.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const fieldClassName = "mt-2 block w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10";
const primaryButtonClassName = "flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#681c20] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60";
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
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [profile, setProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("signin");
    const [email, setEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [pendingEmail, setPendingEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [code, setCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthForm.useEffect": ()=>{
            let active = true;
            let request;
            async function refresh() {
                request?.abort();
                const controller = new AbortController();
                request = controller;
                try {
                    const current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])(controller.signal);
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
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthForm.useEffect": ()=>{
            if (profile) router.replace(profile.username_chosen ? "/" : "/choose-username");
        }
    }["AuthForm.useEffect"], [
        profile,
        router
    ]);
    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
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
                    setMode("confirm");
                }
            } else if (mode === "confirm") {
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.verifyOtp({
                    email: pendingEmail,
                    token: code.trim(),
                    type: "email"
                });
                if (error) throw error;
                const current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])();
                if (!current) throw new Error("Unable to load your account.");
                setProfile(current);
                setCode("");
                setPendingEmail("");
            } else {
                const { error } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.signInWithPassword({
                    email: email.trim(),
                    password
                });
                if (error) throw error;
                const current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])();
                if (!current) throw new Error("Unable to load your account.");
                setProfile(current);
            }
            setPassword("");
        } catch (cause) {
            setError(describeAuthError(cause, mode));
        } finally{
            setBusy(false);
        }
    }
    function switchMode(nextMode) {
        setMode(nextMode);
        setError("");
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-auto w-full max-w-lg px-6 py-7 sm:px-8 sm:py-8",
        children: [
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800",
                children: error
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                lineNumber: 151,
                columnNumber: 9
            }, this),
            loading || profile ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                role: "status",
                className: "flex min-h-44 items-center gap-3 text-sm text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        "aria-hidden": "true",
                        className: "h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 157,
                        columnNumber: 11
                    }, this),
                    profile ? profile.username_chosen ? "Opening ForAll…" : "Opening username setup…" : "Loading your account…"
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                lineNumber: 156,
                columnNumber: 9
            }, this) : mode === "confirm" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                onSubmit: submit,
                className: "space-y-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "font-serif text-2xl font-bold text-primary",
                                children: "Check your inbox"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 163,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-sm leading-6 text-muted-foreground",
                                children: [
                                    "Enter the confirmation code we emailed to ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "break-all font-semibold text-foreground",
                                        children: pendingEmail
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                        lineNumber: 165,
                                        columnNumber: 57
                                    }, this),
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 164,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 162,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                htmlFor: "auth-code",
                                className: "text-sm font-semibold text-foreground",
                                children: "Confirmation code"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 169,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                id: "auth-code",
                                name: "code",
                                className: fieldClassName,
                                type: "text",
                                inputMode: "numeric",
                                autoComplete: "one-time-code",
                                required: true,
                                value: code,
                                onChange: (event)=>setCode(event.target.value)
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 170,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-xs leading-5 text-muted-foreground",
                                children: "Check your Junk or Spam folder if the email has not arrived."
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 181,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 168,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: primaryButtonClassName,
                        disabled: busy,
                        type: "submit",
                        children: busy ? "Please wait…" : "Confirm email"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 185,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "w-full rounded-lg py-1 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
                        type: "button",
                        disabled: busy,
                        onClick: ()=>{
                            setMode("signup");
                            setCode("");
                            setPendingEmail("");
                            setError("");
                        },
                        children: "Start over"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 188,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                lineNumber: 161,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-7 grid grid-cols-2 rounded-xl bg-secondary p-1",
                        "aria-label": "Account action",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                "aria-pressed": mode === "signin",
                                className: `rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${mode === "signin" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`,
                                disabled: busy,
                                onClick: ()=>switchMode("signin"),
                                children: "Sign in"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 200,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                "aria-pressed": mode === "signup",
                                className: `rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${mode === "signup" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`,
                                disabled: busy,
                                onClick: ()=>switchMode("signup"),
                                children: "Create account"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 209,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 199,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "font-serif text-2xl font-bold text-primary",
                                children: mode === "signup" ? "Join TXST Lynx" : "Welcome back"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 221,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-sm leading-6 text-muted-foreground",
                                children: mode === "signup" ? "Create an account with your Texas State email." : "Sign in with your Texas State account."
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 224,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 220,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: submit,
                        className: "space-y-5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        htmlFor: "auth-email",
                                        className: "text-sm font-semibold text-foreground",
                                        children: "Texas State email"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                        lineNumber: 233,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        id: "auth-email",
                                        name: "email",
                                        className: fieldClassName,
                                        type: "email",
                                        placeholder: "name@txstate.edu",
                                        autoComplete: "username",
                                        autoCapitalize: "none",
                                        spellCheck: false,
                                        required: true,
                                        value: email,
                                        onChange: (event)=>setEmail(event.target.value)
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                        lineNumber: 234,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 232,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        htmlFor: "auth-password",
                                        className: "text-sm font-semibold text-foreground",
                                        children: "Password"
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                        lineNumber: 249,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        id: "auth-password",
                                        name: "password",
                                        className: fieldClassName,
                                        type: "password",
                                        placeholder: "Enter your password",
                                        autoComplete: mode === "signup" ? "new-password" : "current-password",
                                        required: true,
                                        minLength: 6,
                                        value: password,
                                        onChange: (event)=>setPassword(event.target.value)
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                        lineNumber: 250,
                                        columnNumber: 15
                                    }, this),
                                    mode === "signup" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-xs text-muted-foreground",
                                        children: "Use at least 6 characters."
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                        lineNumber: 262,
                                        columnNumber: 37
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 248,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: primaryButtonClassName,
                                disabled: busy,
                                type: "submit",
                                children: busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 264,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 231,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-6 text-center text-sm text-muted-foreground",
                        children: [
                            mode === "signup" ? "Already have an account?" : "New to TXST Lynx?",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "rounded font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
                                type: "button",
                                disabled: busy,
                                onClick: ()=>switchMode(mode === "signup" ? "signin" : "signup"),
                                children: mode === "signup" ? "Sign in" : "Create an account"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                                lineNumber: 270,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                        lineNumber: 268,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
                lineNumber: 198,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/auth/AuthForm.tsx",
        lineNumber: 149,
        columnNumber: 5
    }, this);
}
_s(AuthForm, "Ne+kZfG4ejhLxwoICLL+hqjXX4c=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = AuthForm;
var _c;
__turbopack_context__.k.register(_c, "AuthForm");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=frontend_src_components_auth_AuthForm_tsx_1iq6-o5._.js.map