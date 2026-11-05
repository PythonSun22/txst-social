(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$PostCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/PostCard.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/posts.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function Home() {
    _s();
    const [posts, setPosts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [profile, setProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [cursor, setCursor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [more, setMore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [reload, setReload] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const generation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        value: 0
    });
    const paging = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            let active = true;
            let controller;
            const lifecycle = generation.current;
            async function load() {
                controller?.abort();
                controller = new AbortController();
                const request = controller;
                lifecycle.value++;
                setPosts([]);
                setProfile(null);
                setCursor(null);
                setLoading(true);
                setError("");
                try {
                    const [account, page] = await Promise.all([
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])(request.signal),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPosts"])(undefined, request.signal)
                    ]);
                    if (active && !request.signal.aborted) {
                        setProfile(account);
                        setPosts(page.items);
                        setCursor(page.next_cursor);
                    }
                } catch (cause) {
                    if (active && !request.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load posts.");
                } finally{
                    if (active && !request.signal.aborted) setLoading(false);
                }
            }
            let unsubscribe;
            try {
                const { data } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.onAuthStateChange({
                    "Home.useEffect": ()=>{
                        queueMicrotask({
                            "Home.useEffect": ()=>{
                                if (active) void load();
                            }
                        }["Home.useEffect"]);
                    }
                }["Home.useEffect"]);
                unsubscribe = ({
                    "Home.useEffect": ()=>data.subscription.unsubscribe()
                })["Home.useEffect"];
                void load();
            } catch (cause) {
                queueMicrotask({
                    "Home.useEffect": ()=>{
                        if (active) {
                            setError(cause instanceof Error ? cause.message : "Unable to load feed.");
                            setLoading(false);
                        }
                    }
                }["Home.useEffect"]);
            }
            return ({
                "Home.useEffect": ()=>{
                    active = false;
                    controller?.abort();
                    lifecycle.value++;
                    unsubscribe?.();
                }
            })["Home.useEffect"];
        }
    }["Home.useEffect"], [
        reload
    ]);
    async function loadMore() {
        if (!cursor || paging.current) return;
        const request = generation.current.value;
        paging.current = true;
        setMore(true);
        setError("");
        try {
            const page = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPosts"])(cursor);
            if (request === generation.current.value) {
                setPosts((current)=>[
                        ...current,
                        ...page.items.filter((item)=>!current.some((p)=>p.id === item.id))
                    ]);
                setCursor(page.next_cursor);
            }
        } catch (cause) {
            if (request === generation.current.value) setError(cause instanceof Error ? cause.message : "Unable to load more posts.");
        } finally{
            paging.current = false;
            setMore(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 flex items-center justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "font-serif text-xl font-bold text-primary",
                        children: "ForAll"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 64,
                        columnNumber: 61
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs text-muted-foreground",
                        children: "Newest first"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 64,
                        columnNumber: 130
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 64,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: "/submit",
                className: "mb-4 block rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-primary",
                children: "+ Create Post"
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 65,
                columnNumber: 5
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Loading posts…"
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 66,
                columnNumber: 17
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "mb-3 text-sm text-red-700",
                children: [
                    error,
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "underline",
                        onClick: ()=>setReload((n)=>n + 1),
                        children: "Reload feed"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 67,
                        columnNumber: 77
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 67,
                columnNumber: 15
            }, this),
            !loading && !error && !posts.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-card border border-border bg-card p-6 text-sm text-muted-foreground",
                children: "No posts to show yet. New posts appear here for their author while awaiting review."
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 68,
                columnNumber: 45
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: posts.map((post)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$PostCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        post: post,
                        profile: profile,
                        onLike: (id, value)=>setPosts((items)=>items.map((item)=>item.id === id ? {
                                        ...item,
                                        ...value
                                    } : item))
                    }, `${profile?.id ?? 'guest'}:${post.id}`, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 69,
                        columnNumber: 53
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 69,
                columnNumber: 5
            }, this),
            cursor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                disabled: more,
                onClick: ()=>void loadMore(),
                className: "mt-4 rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-40",
                children: more ? "Loading…" : "Load more"
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 71,
                columnNumber: 16
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 63,
        columnNumber: 10
    }, this);
}
_s(Home, "VHquilHDYJP5w8ZRowfxIMbhLKg=");
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/PawIcon.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Bobcat paw mark used in the logo and beside space names.
 *
 * @param size - Width and height in pixels.
 */ __turbopack_context__.s([
    "default",
    ()=>PawIcon
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function PawIcon({ size = 20 }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: size,
        height: size,
        viewBox: "0 0 64 64",
        fill: "currentColor",
        "aria-hidden": "true",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ellipse", {
                cx: "32",
                cy: "42",
                rx: "14",
                ry: "12"
            }, void 0, false, {
                fileName: "[project]/src/components/PawIcon.tsx",
                lineNumber: 9,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ellipse", {
                cx: "14",
                cy: "28",
                rx: "7",
                ry: "9"
            }, void 0, false, {
                fileName: "[project]/src/components/PawIcon.tsx",
                lineNumber: 10,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ellipse", {
                cx: "50",
                cy: "28",
                rx: "7",
                ry: "9"
            }, void 0, false, {
                fileName: "[project]/src/components/PawIcon.tsx",
                lineNumber: 11,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ellipse", {
                cx: "25",
                cy: "18",
                rx: "7",
                ry: "9"
            }, void 0, false, {
                fileName: "[project]/src/components/PawIcon.tsx",
                lineNumber: 12,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ellipse", {
                cx: "39",
                cy: "18",
                rx: "7",
                ry: "9"
            }, void 0, false, {
                fileName: "[project]/src/components/PawIcon.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/PawIcon.tsx",
        lineNumber: 8,
        columnNumber: 5
    }, this);
}
_c = PawIcon;
var _c;
__turbopack_context__.k.register(_c, "PawIcon");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/PostCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PostCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
/* eslint-disable @next/next/no-img-element -- Expiring, authorized Storage URLs are fetched directly. */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/PawIcon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/posts.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago"
});
function PostImage({ postId, media }) {
    _s();
    const [url, setUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [retry, setRetry] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PostImage.useEffect": ()=>{
            const controller = new AbortController();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPostImage"])(postId, media.position, controller.signal).then({
                "PostImage.useEffect": (result)=>{
                    if (!controller.signal.aborted) setUrl(result.url);
                }
            }["PostImage.useEffect"]).catch({
                "PostImage.useEffect": ()=>{
                    if (!controller.signal.aborted) setError("Image unavailable.");
                }
            }["PostImage.useEffect"]);
            return ({
                "PostImage.useEffect": ()=>controller.abort()
            })["PostImage.useEffect"];
        }
    }["PostImage.useEffect"], [
        postId,
        media.position,
        retry
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            url && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                src: url,
                alt: `Post image ${media.position + 1}`,
                width: media.width ?? undefined,
                height: media.height ?? undefined,
                className: "mx-auto max-h-[36rem] w-auto max-w-full rounded-card object-contain",
                onError: ()=>setError("Image preview expired or unavailable.")
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 23,
                columnNumber: 23
            }, this),
            !url && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: "text-sm text-muted-foreground",
                children: "Loading image…"
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 25,
                columnNumber: 24
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm",
                children: [
                    error,
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "underline",
                        onClick: ()=>{
                            setError("");
                            setUrl("");
                            setRetry((n)=>n + 1);
                        },
                        children: "Retry image"
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 26,
                        columnNumber: 46
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 26,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/PostCard.tsx",
        lineNumber: 22,
        columnNumber: 10
    }, this);
}
_s(PostImage, "nZHeSj4Lk6EHrSjf8NjRYNuZ0fk=");
_c = PostImage;
function PostCard({ post, profile, onLike }) {
    _s1();
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const inFlight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const mounted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PostCard.useEffect": ()=>{
            mounted.current = true;
            return ({
                "PostCard.useEffect": ()=>{
                    mounted.current = false;
                }
            })["PostCard.useEffect"];
        }
    }["PostCard.useEffect"], []);
    const canLike = !!profile?.email_verified && (post.status === "pending" || post.status === "approved");
    async function toggle() {
        if (!canLike || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setPostLike"])(post.id, !post.liked);
            // Account changes remount cards; don't apply the previous viewer's response.
            if (mounted.current) onLike(post.id, result);
        } catch (cause) {
            if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to update like.");
        } finally{
            inFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
        className: "rounded-card border border-border bg-card p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        size: 16
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 56,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        className: "text-primary",
                        children: "General"
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 56,
                        columnNumber: 28
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Posted by ",
                            post.author
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 57,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                        dateTime: post.created_at,
                        children: dateFormat.format(new Date(post.created_at))
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 57,
                        columnNumber: 43
                    }, this),
                    post.status !== "approved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-full bg-accent/10 px-2 py-1 font-semibold text-primary",
                        children: post.status === "pending" ? "Pending review · Only you" : post.status
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 58,
                        columnNumber: 38
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 55,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "mb-2 break-words text-base font-semibold",
                children: post.title
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 60,
                columnNumber: 5
            }, this),
            post.body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mb-3 whitespace-pre-wrap break-words text-sm",
                children: post.body
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 61,
                columnNumber: 19
            }, this),
            post.url && /^https?:\/\//i.test(post.url) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: post.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "mb-3 block break-all text-sm text-primary underline",
                children: post.url
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 62,
                columnNumber: 52
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: post.media.map((media)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PostImage, {
                        postId: post.id,
                        media: media
                    }, media.position, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 63,
                        columnNumber: 59
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 63,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3 flex flex-wrap items-center gap-3 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>void toggle(),
                        disabled: !canLike || busy,
                        "aria-pressed": post.liked,
                        "aria-label": post.liked ? "Unlike post" : "Like post",
                        className: `rounded-full bg-muted px-3 py-2 font-bold disabled:opacity-50 ${post.liked ? "text-primary" : "text-muted-foreground"}`,
                        children: [
                            "▲ ",
                            post.like_count,
                            " ",
                            post.liked ? "Liked" : "Like"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 65,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-muted-foreground",
                        children: [
                            post.comment_count,
                            " comments"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 70,
                        columnNumber: 7
                    }, this),
                    !profile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "/login",
                        className: "text-primary underline",
                        children: "Sign in to like"
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 71,
                        columnNumber: 20
                    }, this),
                    profile && !profile.email_verified && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Verify your email to like posts."
                    }, void 0, false, {
                        fileName: "[project]/src/components/PostCard.tsx",
                        lineNumber: 72,
                        columnNumber: 46
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 64,
                columnNumber: 5
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "mt-2 text-sm text-red-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/src/components/PostCard.tsx",
                lineNumber: 74,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/PostCard.tsx",
        lineNumber: 54,
        columnNumber: 10
    }, this);
}
_s1(PostCard, "MSpeCFntAgFGiNPD9VVT0DRmS+E=");
_c1 = PostCard;
var _c, _c1;
__turbopack_context__.k.register(_c, "PostImage");
__turbopack_context__.k.register(_c1, "PostCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

var e = new Error("Could not parse module '[project]/src/lib/api.ts'\n\nExpression expected");
e.code = 'MODULE_UNPARSABLE';
throw e;
}),
"[project]/src/lib/posts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createPost",
    ()=>createPost,
    "fetchPosts",
    ()=>fetchPosts,
    "getPostImage",
    ()=>getPostImage,
    "setPostLike",
    ()=>setPostLike
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
const fetchPosts = (cursor, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
        signal
    }, true);
const createPost = (payload)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])("/posts", {
        method: "POST",
        body: JSON.stringify(payload)
    });
const setPostLike = (id, liked)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/like`, {
        method: liked ? "PUT" : "DELETE"
    });
const getPostImage = (id, position, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/media/${position}/preview`, {
        signal
    }, true);
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/supabase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabase",
    ()=>getSupabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-client] (ecmascript) <locals>");
;
let client;
function getSupabase() {
    const url = ("TURBOPACK compile-time value", "https://owanzsbfjzogitabmydg.supabase.co");
    const key = ("TURBOPACK compile-time value", "sb_publishable_VRMK_0-2QcculTaNwwvTJg_XUJUSE87");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    client ??= (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(url, key);
    return client;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_1hufe_z._.js.map