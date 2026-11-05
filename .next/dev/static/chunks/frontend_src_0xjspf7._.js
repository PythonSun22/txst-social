(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/frontend/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$PostCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/PostCard.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/posts.ts [app-client] (ecmascript)");
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
    const [posts, setPosts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [profile, setProfile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [cursor, setCursor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [more, setMore] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [reload, setReload] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const generation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])({
        value: 0
    });
    const paging = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const updateStatus = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Home.useCallback[updateStatus]": (id, status, failed)=>{
            setPosts({
                "Home.useCallback[updateStatus]": (items)=>items.map({
                        "Home.useCallback[updateStatus]": (post)=>post.id === id ? {
                                ...post,
                                status,
                                moderation_failed: failed
                            } : post
                    }["Home.useCallback[updateStatus]"])
            }["Home.useCallback[updateStatus]"]);
        }
    }["Home.useCallback[updateStatus]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
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
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])(request.signal),
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPosts"])(undefined, request.signal)
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
                const { data } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSupabase"])().auth.onAuthStateChange({
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
            const page = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPosts"])(cursor);
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 flex items-center justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "font-serif text-xl font-bold text-primary",
                        children: "ForAll"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 69,
                        columnNumber: 63
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs text-muted-foreground",
                        children: "Newest first"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 69,
                        columnNumber: 132
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: "/submit",
                className: "mb-4 block rounded-card border border-border bg-card px-4 py-3 text-sm font-semibold text-primary",
                children: "+ Create Post"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 70,
                columnNumber: 7
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Loading posts…"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 71,
                columnNumber: 19
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "mb-3 text-sm text-red-700",
                children: [
                    error,
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "underline",
                        onClick: ()=>setReload((n)=>n + 1),
                        children: "Reload feed"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 72,
                        columnNumber: 84
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 72,
                columnNumber: 18
            }, this),
            !loading && !error && !posts.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-card border border-border bg-card p-6 text-sm text-muted-foreground",
                children: " No posts to show yet. New posts appear here for their author while awaiting automatic screening."
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 73,
                columnNumber: 48
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: posts.map((post)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$PostCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        post: post,
                        profile: profile,
                        onStatus: updateStatus,
                        onDelete: (id)=>setPosts((items)=>items.filter((item)=>item.id !== id)),
                        onLike: (id, value)=>setPosts((items)=>items.map((item)=>item.id === id ? {
                                        ...item,
                                        ...value
                                    } : item))
                    }, `${profile?.id ?? "guest"}:${post.id}`, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 75,
                        columnNumber: 29
                    }, this))
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 74,
                columnNumber: 7
            }, this),
            cursor && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                disabled: more,
                onClick: ()=>void loadMore(),
                className: "mt-4 rounded-full border border-primary px-4 py-2 text-sm text-primary disabled:opacity-40",
                children: more ? "Loading…" : "Load more"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 77,
                columnNumber: 19
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/app/page.tsx",
        lineNumber: 68,
        columnNumber: 5
    }, this);
}
_s(Home, "9q611m5hmQn0184073UQc9A936Y=");
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/PostCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PostCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
/* eslint-disable @next/next/no-img-element -- Expiring, authorized Storage URLs are fetched directly. */ var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/PawIcon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/posts.ts [app-client] (ecmascript)");
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
    const [url, setUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [retry, setRetry] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PostImage.useEffect": ()=>{
            const controller = new AbortController();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPostImage"])(postId, media.position, controller.signal).then({
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            url && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                src: url,
                alt: `Post image ${media.position + 1}`,
                width: media.width ?? undefined,
                height: media.height ?? undefined,
                className: "mx-auto max-h-[36rem] w-auto max-w-full rounded-card object-contain",
                onError: ()=>setError("Image preview expired or unavailable.")
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 23,
                columnNumber: 23
            }, this),
            !url && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: "text-sm text-muted-foreground",
                children: "Loading image…"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 25,
                columnNumber: 24
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm",
                children: [
                    error,
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "underline",
                        onClick: ()=>{
                            setError("");
                            setUrl("");
                            setRetry((n)=>n + 1);
                        },
                        children: "Retry image"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 26,
                        columnNumber: 46
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 26,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/PostCard.tsx",
        lineNumber: 22,
        columnNumber: 10
    }, this);
}
_s(PostImage, "nZHeSj4Lk6EHrSjf8NjRYNuZ0fk=");
_c = PostImage;
function PostCard({ post, profile, onLike, onDelete, onStatus }) {
    _s1();
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const inFlight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const [confirmDelete, setConfirmDelete] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const mounted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PostCard.useEffect": ()=>{
            mounted.current = true;
            return ({
                "PostCard.useEffect": ()=>{
                    mounted.current = false;
                }
            })["PostCard.useEffect"];
        }
    }["PostCard.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PostCard.useEffect": ()=>{
            if (post.status !== "pending" || post.moderation_failed) return;
            const controller = new AbortController();
            let timer;
            async function refresh() {
                try {
                    const updated = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPost"])(post.id, controller.signal);
                    if (controller.signal.aborted) return;
                    onStatus(updated.id, updated.status, updated.moderation_failed);
                    if (updated.status !== "pending" || updated.moderation_failed) return;
                } catch  {
                    if (controller.signal.aborted) return;
                }
                timer = setTimeout({
                    "PostCard.useEffect.refresh": ()=>void refresh()
                }["PostCard.useEffect.refresh"], 5000);
            }
            timer = setTimeout({
                "PostCard.useEffect": ()=>void refresh()
            }["PostCard.useEffect"], 5000);
            return ({
                "PostCard.useEffect": ()=>{
                    controller.abort();
                    clearTimeout(timer);
                }
            })["PostCard.useEffect"];
        }
    }["PostCard.useEffect"], [
        post.id,
        post.status,
        post.moderation_failed,
        onStatus
    ]);
    const canLike = !!profile?.email_verified && (post.status === "pending" || post.status === "approved");
    const canDelete = !!profile?.email_verified && post.can_delete;
    async function remove() {
        if (!canDelete || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deletePost"])(post.id);
            if (mounted.current) onDelete(post.id);
        } catch (cause) {
            if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to delete post.");
        } finally{
            inFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    }
    async function toggle() {
        if (!canLike || inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["setPostLike"])(post.id, !post.liked);
            // Account changes remount cards; don't apply the previous viewer's response.
            if (mounted.current) onLike(post.id, result);
        } catch (cause) {
            if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to update like.");
        } finally{
            inFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
        className: "rounded-card border border-border bg-card p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        size: 16
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 88,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        className: "text-primary",
                        children: "General"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 88,
                        columnNumber: 28
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Posted by ",
                            post.author
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 89,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                        dateTime: post.created_at,
                        children: dateFormat.format(new Date(post.created_at))
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 89,
                        columnNumber: 43
                    }, this),
                    post.status !== "approved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-full bg-accent/10 px-2 py-1 font-semibold text-primary",
                        children: post.status === "pending" ? post.moderation_failed ? "Screening unavailable · Only you" : "Screening pending · Only you" : post.status
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 90,
                        columnNumber: 38
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 87,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "mb-2 break-words text-base font-semibold",
                children: post.title
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 92,
                columnNumber: 5
            }, this),
            post.moderation_failed && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: "mb-3 text-sm text-muted-foreground",
                children: "Automated review could not be completed. Your post remains private; automatic retries have stopped."
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 93,
                columnNumber: 32
            }, this),
            post.status === "blocked" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mb-3 text-sm text-muted-foreground",
                children: "Automatic screening flagged this post, so it has not been published."
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 94,
                columnNumber: 35
            }, this),
            post.body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mb-3 whitespace-pre-wrap break-words text-sm",
                children: post.body
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 95,
                columnNumber: 19
            }, this),
            post.url && /^https?:\/\//i.test(post.url) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: post.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "mb-3 block break-all text-sm text-primary underline",
                children: post.url
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 96,
                columnNumber: 52
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: post.media.map((media)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PostImage, {
                        postId: post.id,
                        media: media
                    }, media.position, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 97,
                        columnNumber: 59
                    }, this))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 97,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3 flex flex-wrap items-center gap-3 text-xs",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
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
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 99,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-muted-foreground",
                        children: [
                            post.comment_count,
                            " comments"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 104,
                        columnNumber: 7
                    }, this),
                    canDelete && !confirmDelete && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: busy,
                        onClick: ()=>setConfirmDelete(true),
                        className: "ml-auto rounded-full px-3 py-2 text-red-700 disabled:opacity-50",
                        children: "Delete post"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 105,
                        columnNumber: 39
                    }, this),
                    !profile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "/login",
                        className: "text-primary underline",
                        children: "Sign in to like"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 107,
                        columnNumber: 20
                    }, this),
                    profile && !profile.email_verified && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Verify your email to like posts."
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 108,
                        columnNumber: 46
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 98,
                columnNumber: 5
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "mt-2 text-sm text-red-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 110,
                columnNumber: 15
            }, this),
            canDelete && confirmDelete && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3 flex flex-wrap items-center gap-3 text-sm",
                role: "group",
                "aria-label": "Confirm post deletion",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: "Delete this post?"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 112,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: busy,
                        onClick: ()=>void remove(),
                        className: "rounded-full bg-red-700 px-3 py-2 text-white disabled:opacity-50",
                        children: busy ? "Deleting…" : "Confirm delete"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 113,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: busy,
                        onClick: ()=>setConfirmDelete(false),
                        className: "rounded-full border border-border px-3 py-2 disabled:opacity-50",
                        children: "Cancel"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/PostCard.tsx",
                        lineNumber: 115,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/PostCard.tsx",
                lineNumber: 111,
                columnNumber: 36
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/PostCard.tsx",
        lineNumber: 86,
        columnNumber: 10
    }, this);
}
_s1(PostCard, "fmbTAq478q0nwIiigLIJHfoFCOQ=");
_c1 = PostCard;
var _c, _c1;
__turbopack_context__.k.register(_c, "PostImage");
__turbopack_context__.k.register(_c1, "PostCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/lib/posts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createPost",
    ()=>createPost,
    "deletePost",
    ()=>deletePost,
    "fetchPost",
    ()=>fetchPost,
    "fetchPosts",
    ()=>fetchPosts,
    "getMyPosts",
    ()=>getMyPosts,
    "getPostImage",
    ()=>getPostImage,
    "setPostLike",
    ()=>setPostLike
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.ts [app-client] (ecmascript)");
;
const fetchPosts = (cursor, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {
        signal
    }, true);
const getMyPosts = (signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])("/posts/me", {
        signal
    });
const createPost = (payload)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])("/posts", {
        method: "POST",
        body: JSON.stringify(payload)
    });
const fetchPost = (id, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}`, {
        signal
    }, true);
const setPostLike = (id, liked)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/like`, {
        method: liked ? "PUT" : "DELETE"
    });
const getPostImage = (id, position, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/media/${position}/preview`, {
        signal
    }, true);
const deletePost = (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}`, {
        method: "DELETE"
    });
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=frontend_src_0xjspf7._.js.map