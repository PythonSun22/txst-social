(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/frontend/node_modules/next/dist/client/app-dir/form.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/frontend/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return Form;
    }
});
const _jsxruntime = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const _addbasepath = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/client/add-base-path.js [app-client] (ecmascript)");
const _usemergedref = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/client/use-merged-ref.js [app-client] (ecmascript)");
const _approutercontextsharedruntime = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.js [app-client] (ecmascript)");
const _formshared = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/client/form-shared.js [app-client] (ecmascript)");
const _links = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/client/components/links.js [app-client] (ecmascript)");
const _types = __turbopack_context__.r("[project]/frontend/node_modules/next/dist/client/components/segment-cache/types.js [app-client] (ecmascript)");
function Form({ replace, scroll, prefetch: prefetchProp, ref: externalRef, ...props }) {
    const router = (0, _react.useContext)(_approutercontextsharedruntime.AppRouterContext);
    const actionProp = props.action;
    const isNavigatingForm = typeof actionProp === 'string';
    // Validate `action`
    if ("TURBOPACK compile-time truthy", 1) {
        if (isNavigatingForm) {
            (0, _formshared.checkFormActionUrl)(actionProp, 'action');
        }
    }
    // Validate `prefetch`
    if ("TURBOPACK compile-time truthy", 1) {
        if (!(prefetchProp === undefined || prefetchProp === false || prefetchProp === null)) {
            console.error('The `prefetch` prop of <Form> must be `false` or `null`');
        }
        if (prefetchProp !== undefined && !isNavigatingForm) {
            console.error('Passing `prefetch` to a <Form> whose `action` is a function has no effect.');
        }
    }
    // TODO(runtime-ppr): allow runtime prefetches in Form
    const prefetch = prefetchProp === false || prefetchProp === null ? prefetchProp : null;
    // Validate `scroll` and `replace`
    if ("TURBOPACK compile-time truthy", 1) {
        if (!isNavigatingForm && (replace !== undefined || scroll !== undefined)) {
            console.error('Passing `replace` or `scroll` to a <Form> whose `action` is a function has no effect.\n' + 'See the relevant docs to learn how to control this behavior for navigations triggered from actions:\n' + '  `redirect()`       - https://nextjs.org/docs/app/api-reference/functions/redirect#parameters\n' + '  `router.replace()` - https://nextjs.org/docs/app/api-reference/functions/use-router#userouter\n');
        }
    }
    // Clean up any unsupported form props (and warn if present)
    for (const key of _formshared.DISALLOWED_FORM_PROPS){
        if (key in props) {
            if ("TURBOPACK compile-time truthy", 1) {
                console.error(`<Form> does not support changing \`${key}\`. ` + (isNavigatingForm ? `If you'd like to use it to perform a mutation, consider making \`action\` a function instead.\n` + `Learn more: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations` : ''));
            }
            delete props[key];
        }
    }
    const isPrefetchEnabled = !!router && isNavigatingForm && prefetch === null;
    const observeFormVisibilityOnMount = (0, _react.useCallback)((element)=>{
        if (isPrefetchEnabled && router !== null) {
            (0, _links.mountFormInstance)(element, actionProp, router, _types.FetchStrategy.PPR);
        }
        return ()=>{
            (0, _links.unmountPrefetchableInstance)(element);
        };
    }, [
        isPrefetchEnabled,
        actionProp,
        router
    ]);
    const mergedRef = (0, _usemergedref.useMergedRef)(observeFormVisibilityOnMount, externalRef ?? null);
    if (!isNavigatingForm) {
        return /*#__PURE__*/ (0, _jsxruntime.jsx)("form", {
            ...props,
            ref: mergedRef
        });
    }
    const actionHref = (0, _addbasepath.addBasePath)(actionProp);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("form", {
        ...props,
        ref: mergedRef,
        action: actionHref,
        onSubmit: (event)=>onFormSubmit(event, {
                router,
                actionHref,
                replace,
                scroll,
                onSubmit: props.onSubmit
            })
    });
}
function onFormSubmit(event, { actionHref, onSubmit, replace, scroll, router }) {
    if (typeof onSubmit === 'function') {
        onSubmit(event);
        // if the user called event.preventDefault(), do nothing.
        // (this matches what Link does for `onClick`)
        if (event.defaultPrevented) {
            return;
        }
    }
    if (!router) {
        // Form was somehow used outside of the router (but not in pages, the implementation is forked!).
        // We can't perform a soft navigation, so let the native submit handling do its thing.
        return;
    }
    const formElement = event.currentTarget;
    const submitter = event.nativeEvent.submitter;
    let action = actionHref;
    if (submitter) {
        if ("TURBOPACK compile-time truthy", 1) {
            // the way server actions are encoded (e.g. `formMethod="post")
            // causes some unnecessary dev-mode warnings from `hasUnsupportedSubmitterAttributes`.
            // we'd bail out anyway, but we just do it silently.
            if (hasReactServerActionAttributes(submitter)) {
                return;
            }
        }
        if ((0, _formshared.hasUnsupportedSubmitterAttributes)(submitter)) {
            return;
        }
        // client actions have `formAction="javascript:..."`. We obviously can't prefetch/navigate to that.
        if ((0, _formshared.hasReactClientActionAttributes)(submitter)) {
            return;
        }
        // If the submitter specified an alternate formAction,
        // use that URL instead -- this is what a native form would do.
        // NOTE: `submitter.formAction` is unreliable, because it will give us `location.href` if it *wasn't* set
        // NOTE: this should not have `basePath` added, because we can't add it before hydration
        const submitterFormAction = submitter.getAttribute('formAction');
        if (submitterFormAction !== null) {
            if ("TURBOPACK compile-time truthy", 1) {
                (0, _formshared.checkFormActionUrl)(submitterFormAction, 'formAction');
            }
            action = submitterFormAction;
        }
    }
    const targetUrl = (0, _formshared.createFormSubmitDestinationUrl)(action, formElement);
    // Finally, no more reasons for bailing out.
    event.preventDefault();
    const method = replace ? 'replace' : 'push';
    const targetHref = targetUrl.href;
    router[method](targetHref, {
        scroll
    });
}
function hasReactServerActionAttributes(submitter) {
    // https://github.com/facebook/react/blob/942eb80381b96f8410eab1bef1c539bed1ab0eb1/packages/react-client/src/ReactFlightReplyClient.js#L931-L934
    const name = submitter.getAttribute('name');
    return name && (name.startsWith('$ACTION_ID_') || name.startsWith('$ACTION_REF_'));
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
}
}),
"[project]/frontend/node_modules/next/dist/client/form-shared.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/frontend/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    DISALLOWED_FORM_PROPS: null,
    checkFormActionUrl: null,
    createFormSubmitDestinationUrl: null,
    hasReactClientActionAttributes: null,
    hasUnsupportedSubmitterAttributes: null,
    isSupportedFormEncType: null,
    isSupportedFormMethod: null,
    isSupportedFormTarget: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    DISALLOWED_FORM_PROPS: function() {
        return DISALLOWED_FORM_PROPS;
    },
    checkFormActionUrl: function() {
        return checkFormActionUrl;
    },
    createFormSubmitDestinationUrl: function() {
        return createFormSubmitDestinationUrl;
    },
    hasReactClientActionAttributes: function() {
        return hasReactClientActionAttributes;
    },
    hasUnsupportedSubmitterAttributes: function() {
        return hasUnsupportedSubmitterAttributes;
    },
    isSupportedFormEncType: function() {
        return isSupportedFormEncType;
    },
    isSupportedFormMethod: function() {
        return isSupportedFormMethod;
    },
    isSupportedFormTarget: function() {
        return isSupportedFormTarget;
    }
});
const DISALLOWED_FORM_PROPS = [
    'method',
    'encType',
    'target'
];
function createFormSubmitDestinationUrl(action, formElement) {
    let targetUrl;
    try {
        // NOTE: It might be more correct to resolve URLs relative to `document.baseURI`,
        // but we already do it relative to `location.href` elsewhere:
        //  (see e.g. https://github.com/vercel/next.js/blob/bb0e6722f87ceb2d43015f5b8a413d0072f2badf/packages/next/src/client/components/app-router.tsx#L146)
        // so it's better to stay consistent.
        const base = window.location.href;
        targetUrl = new URL(action, base);
    } catch (err) {
        throw Object.defineProperty(new Error(`Cannot parse form action "${action}" as a URL`, {
            cause: err
        }), "__NEXT_ERROR_CODE", {
            value: "E152",
            enumerable: false,
            configurable: true
        });
    }
    if (targetUrl.searchParams.size) {
        // url-encoded HTML forms *overwrite* any search params in the `action` url:
        //
        //  "Let `query` be the result of running the application/x-www-form-urlencoded serializer [...]"
        //  "Set parsed action's query component to `query`."
        //   https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#submit-mutate-action
        //
        // We need to match that.
        // (note that all other parts of the URL, like `hash`, are preserved)
        targetUrl.search = '';
    }
    const formData = new FormData(formElement);
    for (let [name, value] of formData){
        if (typeof value !== 'string') {
            // For file inputs, the native browser behavior is to use the filename as the value instead:
            //
            //   "If entry's value is a File object, then let value be entry's value's name. Otherwise, let value be entry's value."
            //   https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#converting-an-entry-list-to-a-list-of-name-value-pairs
            //
            if ("TURBOPACK compile-time truthy", 1) {
                console.warn(`<Form> only supports file inputs if \`action\` is a function. File inputs cannot be used if \`action\` is a string, ` + `because files cannot be encoded as search params.`);
            }
            value = value.name;
        }
        targetUrl.searchParams.append(name, value);
    }
    return targetUrl;
}
function checkFormActionUrl(action, source) {
    const aPropName = source === 'action' ? `an \`action\`` : `a \`formAction\``;
    let testUrl;
    try {
        testUrl = new URL(action, 'http://n');
    } catch (err) {
        console.error(`<Form> received ${aPropName} that cannot be parsed as a URL: "${action}".`);
        return;
    }
    // url-encoded HTML forms ignore any queryparams in the `action` url. We need to match that.
    if (testUrl.searchParams.size) {
        console.warn(`<Form> received ${aPropName} that contains search params: "${action}". This is not supported, and they will be ignored. ` + `If you need to pass in additional search params, use an \`<input type="hidden" />\` instead.`);
    }
}
const isSupportedFormEncType = (value)=>value === 'application/x-www-form-urlencoded';
const isSupportedFormMethod = (value)=>value === 'get';
const isSupportedFormTarget = (value)=>value === '_self';
function hasUnsupportedSubmitterAttributes(submitter) {
    // A submitter can override `encType` for the form.
    const formEncType = submitter.getAttribute('formEncType');
    if (formEncType !== null && !isSupportedFormEncType(formEncType)) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.error(`<Form>'s \`encType\` was set to an unsupported value via \`formEncType="${formEncType}"\`. ` + `This will disable <Form>'s navigation functionality. If you need this, use a native <form> element instead.`);
        }
        return true;
    }
    // A submitter can override `method` for the form.
    const formMethod = submitter.getAttribute('formMethod');
    if (formMethod !== null && !isSupportedFormMethod(formMethod)) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.error(`<Form>'s \`method\` was set to an unsupported value via \`formMethod="${formMethod}"\`. ` + `This will disable <Form>'s navigation functionality. If you need this, use a native <form> element instead.`);
        }
        return true;
    }
    // A submitter can override `target` for the form.
    const formTarget = submitter.getAttribute('formTarget');
    if (formTarget !== null && !isSupportedFormTarget(formTarget)) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.error(`<Form>'s \`target\` was set to an unsupported value via \`formTarget="${formTarget}"\`. ` + `This will disable <Form>'s navigation functionality. If you need this, use a native <form> element instead.`);
        }
        return true;
    }
    return false;
}
function hasReactClientActionAttributes(submitter) {
    // CSR: https://github.com/facebook/react/blob/942eb80381b96f8410eab1bef1c539bed1ab0eb1/packages/react-dom-bindings/src/client/ReactDOMComponent.js#L482-L487
    // SSR: https://github.com/facebook/react/blob/942eb80381b96f8410eab1bef1c539bed1ab0eb1/packages/react-dom-bindings/src/client/ReactDOMComponent.js#L2401
    const action = submitter.getAttribute('formAction');
    return action && /\s*javascript:/i.test(action);
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
}
}),
"[project]/frontend/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$posts$2f$PostCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/posts/PostCard.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$posts$2f$PostSearch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/posts/PostSearch.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/profiles.ts [app-client] (ecmascript)");
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
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentProfile"])(request.signal),
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "feed-intro",
                "aria-labelledby": "feed-heading",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f2d492]",
                        children: "Texas State · Campus-wide"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 71,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap items-end justify-between gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                id: "feed-heading",
                                className: "font-serif text-5xl font-bold tracking-tight",
                                children: [
                                    "ForAll",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[#f2d492]",
                                        children: "."
                                    }, void 0, false, {
                                        fileName: "[project]/frontend/src/app/page.tsx",
                                        lineNumber: 73,
                                        columnNumber: 96
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/frontend/src/app/page.tsx",
                                lineNumber: 73,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rounded-full border border-white/30 px-3 py-1 text-xs text-white/90",
                                children: "Newest first"
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/app/page.tsx",
                                lineNumber: 74,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-sm text-white/85",
                        children: "Your campus. Your conversations."
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/app/page.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 70,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$posts$2f$PostSearch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 78,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: "/submit",
                className: "mb-5 block rounded-card border border-primary bg-primary px-5 py-4 text-sm font-bold text-white",
                children: "+ Create Post"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this),
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Loading posts…"
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 80,
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
                        lineNumber: 81,
                        columnNumber: 84
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 81,
                columnNumber: 18
            }, this),
            !loading && !error && !posts.length && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-card border border-border bg-card p-6 text-sm text-muted-foreground",
                children: " No posts to show yet. New posts appear here for their author while awaiting automatic screening."
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 82,
                columnNumber: 48
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: posts.map((post)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$posts$2f$PostCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
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
                        lineNumber: 84,
                        columnNumber: 29
                    }, this))
            }, void 0, false, {
                fileName: "[project]/frontend/src/app/page.tsx",
                lineNumber: 83,
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
                lineNumber: 86,
                columnNumber: 19
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/app/page.tsx",
        lineNumber: 69,
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
"[project]/frontend/src/components/images/ImageViewer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ImageViewer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
/* eslint-disable @next/next/no-img-element -- Authorized, expiring Storage URLs. */ var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function ImageViewer({ resource, title, onClose, onPrevious, onNext }) {
    _s();
    const dialog = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [retry, setRetry] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ImageViewer.useEffect": ()=>{
            const element = dialog.current;
            element.showModal();
            return ({
                "ImageViewer.useEffect": ()=>element.close()
            })["ImageViewer.useEffect"];
        }
    }["ImageViewer.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ImageViewer.useEffect": ()=>{
            const controller = new AbortController();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(resource, {
                signal: controller.signal
            }, true).then({
                "ImageViewer.useEffect": ({ url })=>{
                    if (!controller.signal.aborted) setResult({
                        resource,
                        url
                    });
                }
            }["ImageViewer.useEffect"]).catch({
                "ImageViewer.useEffect": (cause)=>{
                    if (!controller.signal.aborted) setResult({
                        resource,
                        error: cause instanceof Error ? cause.message : "Unable to load image."
                    });
                }
            }["ImageViewer.useEffect"]);
            return ({
                "ImageViewer.useEffect": ()=>controller.abort()
            })["ImageViewer.useEffect"];
        }
    }["ImageViewer.useEffect"], [
        resource,
        retry
    ]);
    const current = result?.resource === resource ? result : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dialog", {
        ref: dialog,
        "aria-label": title,
        onCancel: (event)=>{
            event.preventDefault();
            onClose();
        },
        onClose: (event)=>{
            // Strict Mode replays the effect: close() queues an event, then showModal()
            // reopens the dialog. Ignore that stale event rather than unmounting it.
            if (!event.currentTarget.open) onClose();
        },
        className: "fixed inset-0 m-auto max-h-[95dvh] w-[min(96vw,80rem)] rounded-xl bg-black p-4 text-white backdrop:bg-black/80",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 flex items-center justify-between gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                        lineNumber: 38,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        autoFocus: true,
                        onClick: onClose,
                        className: "rounded border px-3 py-1",
                        children: "Close"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                        lineNumber: 39,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                lineNumber: 37,
                columnNumber: 5
            }, this),
            !current && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                children: "Loading larger image…"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                lineNumber: 41,
                columnNumber: 18
            }, this),
            current?.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                children: [
                    current.error,
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "underline",
                        onClick: ()=>{
                            setResult(null);
                            setRetry((n)=>n + 1);
                        },
                        children: "Retry"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                        lineNumber: 42,
                        columnNumber: 56
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                lineNumber: 42,
                columnNumber: 24
            }, this),
            current?.url && !current.error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                src: current.url,
                alt: title,
                className: "mx-auto max-h-[75dvh] max-w-full object-contain",
                onError: ()=>setResult({
                        resource,
                        error: "Image expired or unavailable."
                    })
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                lineNumber: 43,
                columnNumber: 40
            }, this),
            (onPrevious || onNext) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3 flex justify-between gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: !onPrevious,
                        onClick: onPrevious,
                        className: "rounded border px-3 py-1 disabled:opacity-40",
                        children: "Previous"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                        lineNumber: 46,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: !onNext,
                        onClick: onNext,
                        className: "rounded border px-3 py-1 disabled:opacity-40",
                        children: "Next"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                        lineNumber: 47,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
                lineNumber: 45,
                columnNumber: 32
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/images/ImageViewer.tsx",
        lineNumber: 29,
        columnNumber: 10
    }, this);
}
_s(ImageViewer, "fxmR6Irok2kNhory6Vifam9Gd5g=");
_c = ImageViewer;
var _c;
__turbopack_context__.k.register(_c, "ImageViewer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/posts/PostCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PostCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
/* eslint-disable @next/next/no-img-element -- Expiring, authorized Storage URLs are fetched directly. */ var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$ui$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/ui/PawIcon.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$images$2f$ImageViewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/components/images/ImageViewer.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/posts.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
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
function AuthorAvatar({ id }) {
    _s();
    const [image, setImage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthorAvatar.useEffect": ()=>{
            const controller = new AbortController();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/images/${id}/published-preview?variant=avatar_small`, {
                signal: controller.signal
            }, true).then({
                "AuthorAvatar.useEffect": ({ url })=>{
                    if (!controller.signal.aborted) setImage({
                        id,
                        url
                    });
                }
            }["AuthorAvatar.useEffect"]).catch({
                "AuthorAvatar.useEffect": ()=>{}
            }["AuthorAvatar.useEffect"]);
            return ({
                "AuthorAvatar.useEffect": ()=>controller.abort()
            })["AuthorAvatar.useEffect"];
        }
    }["AuthorAvatar.useEffect"], [
        id
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "flex h-12 w-12 shrink-0 items-center justify-center",
        children: image?.id === id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
            src: image.url,
            alt: "",
            width: 48,
            height: 48,
            loading: "lazy",
            className: "h-full w-full rounded-full object-cover"
        }, void 0, false, {
            fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
            lineNumber: 22,
            columnNumber: 25
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$ui$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            size: 24
        }, void 0, false, {
            fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
            lineNumber: 22,
            columnNumber: 148
        }, this)
    }, void 0, false, {
        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
_s(AuthorAvatar, "dGVwJEArO+c3odeDsBUMrBRJ/DQ=");
_c = AuthorAvatar;
function PostImage({ postId, media, status, onOpen }) {
    _s1();
    const [url, setUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [retry, setRetry] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PostImage.useEffect": ()=>{
            const controller = new AbortController();
            let timer;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPostImage"])(postId, media.position, controller.signal).then({
                "PostImage.useEffect": (result)=>{
                    if (!controller.signal.aborted) {
                        setUrl(result.url);
                        setError("");
                    }
                }
            }["PostImage.useEffect"]).catch({
                "PostImage.useEffect": ()=>{
                    if (!controller.signal.aborted) {
                        setError(status === "pending" ? "Image processing is pending." : "Image unavailable.");
                        if (status === "pending") timer = setTimeout({
                            "PostImage.useEffect": ()=>setRetry({
                                    "PostImage.useEffect": (n)=>n + 1
                                }["PostImage.useEffect"])
                        }["PostImage.useEffect"], 5000);
                    }
                }
            }["PostImage.useEffect"]);
            return ({
                "PostImage.useEffect": ()=>{
                    controller.abort();
                    clearTimeout(timer);
                }
            })["PostImage.useEffect"];
        }
    }["PostImage.useEffect"], [
        postId,
        media.position,
        retry,
        status
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            url && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: onOpen,
                "aria-label": `Open image ${media.position + 1}`,
                className: "block w-full rounded-card focus-visible:outline-2 focus-visible:outline-primary",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    src: url,
                    loading: "lazy",
                    alt: `Post image ${media.position + 1}`,
                    width: media.width ?? undefined,
                    height: media.height ?? undefined,
                    className: "mx-auto max-h-96 w-auto max-w-full rounded-card object-contain",
                    onError: ()=>setError("Image is processing, expired or unavailable.")
                }, void 0, false, {
                    fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                    lineNumber: 43,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 42,
                columnNumber: 23
            }, this),
            !url && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: "text-sm text-muted-foreground",
                children: "Loading image…"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 46,
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
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 47,
                        columnNumber: 46
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 47,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
        lineNumber: 41,
        columnNumber: 10
    }, this);
}
_s1(PostImage, "nZHeSj4Lk6EHrSjf8NjRYNuZ0fk=");
_c1 = PostImage;
function PostCard({ post, profile, onLike, onDelete, onStatus }) {
    _s2();
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const inFlight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const [confirmDelete, setConfirmDelete] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [viewing, setViewing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [screening, setScreening] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const screeningView = screening?.id === post.id ? screening : post;
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
            if (post.status !== "pending" || post.moderation_failed || !onStatus) return;
            const controller = new AbortController();
            let timer;
            async function refresh() {
                try {
                    const updated = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchPost"])(post.id, controller.signal);
                    if (controller.signal.aborted) return;
                    setScreening(updated);
                    onStatus?.(updated.id, updated.status, updated.moderation_failed);
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
        className: "post-card rounded-card border border-border bg-card p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
                children: [
                    post.author_avatar_upload_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthorAvatar, {
                        id: post.author_avatar_upload_id
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 113,
                        columnNumber: 39
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$ui$2f$PawIcon$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        size: 16
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 113,
                        columnNumber: 92
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        className: "text-primary",
                        children: post.space_name
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 113,
                        columnNumber: 114
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Posted by ",
                            post.author_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                href: `/profile/${post.author_id}`,
                                className: "font-semibold text-primary underline-offset-2 hover:underline",
                                children: post.author
                            }, void 0, false, {
                                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                                lineNumber: 114,
                                columnNumber: 41
                            }, this) : post.author
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 114,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                        dateTime: post.created_at,
                        children: dateFormat.format(new Date(post.created_at))
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 114,
                        columnNumber: 199
                    }, this),
                    post.status !== "approved" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-full bg-accent/10 px-2 py-1 font-semibold text-primary",
                        children: post.status === "pending" ? post.moderation_failed ? "Screening unavailable · Only you" : "Screening pending · Only you" : post.status
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 115,
                        columnNumber: 38
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 112,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                className: "mb-2 break-words text-base font-semibold",
                children: post.title
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 117,
                columnNumber: 5
            }, this),
            post.status === "pending" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "status",
                className: "mb-3 text-sm text-muted-foreground",
                children: screeningView.processing_state === "service_unavailable" ? "Processing service unavailable. Your post stays private; recoverable image inputs are preserved." : screeningView.processing_state === "image_rejected" ? "An image was rejected by automatic screening." : screeningView.processing_state === "failed" ? "An image could not be processed. Select another image." : post.moderation_failed ? "Screening could not finish. Your post stays private." : screeningView.processing_state === "waiting_images" ? "Waiting for image processing and moderation." : "Waiting for post moderation."
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 118,
                columnNumber: 35
            }, this),
            screeningView.can_retry && post.can_delete && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                disabled: busy,
                className: "mb-3 text-sm underline",
                onClick: async ()=>{
                    setBusy(true);
                    setError("");
                    try {
                        const updated = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$posts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["retryPostScreening"])(post.id);
                        if (mounted.current) {
                            setScreening(updated);
                            onStatus?.(updated.id, updated.status, updated.moderation_failed);
                        }
                    } catch (cause) {
                        if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to retry screening.");
                    } finally{
                        if (mounted.current) setBusy(false);
                    }
                },
                children: "Retry processing and screening"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 125,
                columnNumber: 52
            }, this),
            post.status === "blocked" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mb-3 text-sm text-muted-foreground",
                children: "Automatic screening flagged this post, so it has not been published."
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 133,
                columnNumber: 35
            }, this),
            post.body && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mb-3 whitespace-pre-wrap break-words text-sm",
                children: post.body
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 134,
                columnNumber: 19
            }, this),
            post.url && /^https?:\/\//i.test(post.url) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: post.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "mb-3 block break-all text-sm text-primary underline",
                children: post.url
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 135,
                columnNumber: 52
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `grid gap-3 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`,
                children: post.media.map((media, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PostImage, {
                        postId: post.id,
                        media: media,
                        status: post.moderation_failed || screeningView.processing_state === "service_unavailable" || screeningView.processing_state === "failed" ? "failed" : post.status,
                        onOpen: ()=>setViewing(index)
                    }, media.position, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 137,
                        columnNumber: 41
                    }, this))
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 136,
                columnNumber: 5
            }, this),
            viewing !== null && post.media[viewing] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$components$2f$images$2f$ImageViewer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                resource: `/posts/${post.id}/media/${post.media[viewing].position}/preview?variant=expanded`,
                title: `${post.title} — image ${viewing + 1} of ${post.media.length}`,
                onClose: ()=>setViewing(null),
                onPrevious: viewing > 0 ? ()=>setViewing(viewing - 1) : undefined,
                onNext: viewing < post.media.length - 1 ? ()=>setViewing(viewing + 1) : undefined
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 139,
                columnNumber: 49
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
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 145,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: `/posts/${post.id}`,
                        className: "text-muted-foreground underline",
                        children: [
                            post.comment_count,
                            " comments"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 150,
                        columnNumber: 7
                    }, this),
                    canDelete && !confirmDelete && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: busy,
                        onClick: ()=>setConfirmDelete(true),
                        className: "ml-auto rounded-full px-3 py-2 text-red-700 disabled:opacity-50",
                        children: "Delete post"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 151,
                        columnNumber: 39
                    }, this),
                    !profile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "/login",
                        className: "text-primary underline",
                        children: "Sign in to like"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 153,
                        columnNumber: 20
                    }, this),
                    profile && !profile.email_verified && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Verify your email to like posts."
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 154,
                        columnNumber: 46
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 144,
                columnNumber: 5
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                role: "alert",
                className: "mt-2 text-sm text-red-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 156,
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
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 158,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: busy,
                        onClick: ()=>void remove(),
                        className: "rounded-full bg-red-700 px-3 py-2 text-white disabled:opacity-50",
                        children: busy ? "Deleting…" : "Confirm delete"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 159,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        disabled: busy,
                        onClick: ()=>setConfirmDelete(false),
                        className: "rounded-full border border-border px-3 py-2 disabled:opacity-50",
                        children: "Cancel"
                    }, void 0, false, {
                        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                        lineNumber: 161,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
                lineNumber: 157,
                columnNumber: 36
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/posts/PostCard.tsx",
        lineNumber: 111,
        columnNumber: 10
    }, this);
}
_s2(PostCard, "vwqg6hpRau5UvTB2ZmhOKC37cMI=");
_c2 = PostCard;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "AuthorAvatar");
__turbopack_context__.k.register(_c1, "PostImage");
__turbopack_context__.k.register(_c2, "PostCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/frontend/src/components/posts/PostSearch.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PostSearch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$form$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/node_modules/next/dist/client/app-dir/form.js [app-client] (ecmascript)");
;
;
function PostSearch({ defaultValue = "" }) {
    return(// next/form turns this GET form into a client-side navigation to /search/posts?q=….
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$form$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
        action: "/search/posts",
        role: "search",
        className: "mb-3 flex gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "search",
                name: "q",
                // Not `required`: an empty submit must reach /search/posts?q= so old results clear.
                maxLength: 100,
                defaultValue: defaultValue,
                placeholder: "Search posts by title",
                "aria-label": "Search posts by title",
                className: "min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm focus:border-primary focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostSearch.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "submit",
                className: "rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90",
                children: "Search"
            }, void 0, false, {
                fileName: "[project]/frontend/src/components/posts/PostSearch.tsx",
                lineNumber: 23,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/frontend/src/components/posts/PostSearch.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this));
}
_c = PostSearch;
var _c;
__turbopack_context__.k.register(_c, "PostSearch");
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
    "getUserPosts",
    ()=>getUserPosts,
    "retryPostScreening",
    ()=>retryPostScreening,
    "setPostLike",
    ()=>setPostLike
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/frontend/src/lib/api.ts [app-client] (ecmascript)");
;
const fetchPosts = (cursor, signal, space = "general")=>{
    const params = new URLSearchParams({
        space
    });
    if (cursor) params.set("cursor", cursor);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts?${params}`, {
        signal
    }, true);
};
const getMyPosts = (signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])("/posts/me", {
        signal
    });
const createPost = (payload)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])("/posts", {
        method: "POST",
        body: JSON.stringify(payload)
    });
const getUserPosts = (authorId, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/user/${encodeURIComponent(authorId)}`, {
        signal
    }, true);
const fetchPost = (id, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}`, {
        signal
    }, true);
const setPostLike = (id, liked)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/like`, {
        method: liked ? "PUT" : "DELETE"
    });
const getPostImage = (id, position, signal)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/media/${position}/preview?variant=preview`, {
        signal
    }, true);
const deletePost = (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}`, {
        method: "DELETE"
    });
const retryPostScreening = (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$frontend$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiRequest"])(`/posts/${id}/retry-screening`, {
        method: "POST"
    });
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=frontend_0x5i836._.js.map