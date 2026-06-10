// ==UserScript==
// @name         Color Preview Swatch
// @namespace    https://github.com/nicepkg/color-preview-swatch
// @version      1.2.0
// @description  Auto-detect color codes (Hex / RGB / RGBA / HSL / HSLA / Named) in any webpage and display clickable color preview swatches. Toggle with Alt+C or Ctrl+Shift+C. Persistent on/off state via Tampermonkey menu.
// @author       Claude
// @match        *://*/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      MIT
// @homepageURL  https://github.com/nicepkg/color-preview-swatch
// @supportURL   https://github.com/nicepkg/color-preview-swatch/issues
// ==/UserScript==

// =============================================================================
// Color Preview Swatch — Tampermonkey / Violentmonkey Userscript
// =============================================================================
// Features:
//   • Detects Hex (#RGB, #RRGGBB, #RRGGBBAA), RGB/RGBA, HSL/HSLA, and 148
//     named CSS colors directly in page text.
//   • Inserts a 14×14 px round-cornered swatch next to each detected color.
//   • Swatch border adapts to color luminance for dark/light backgrounds.
//   • Semi-transparent colors show a checkerboard underneath.
//   • Click a swatch to copy the original color string to clipboard.
//   • Uses MutationObserver + debounce for SPA / dynamic content.
//   • Works inside <pre>, <code>, and syntax-highlighted blocks.
//   • Alt+C / Ctrl+Shift+C toggles all swatches on/off globally.
//   • Persistent on/off state — survives page reloads (GM_getValue/setValue).
//   • Tampermonkey menu command with live status text.
//   • Skips <script>, <style>, <input>, <textarea>, contenteditable areas.
// =============================================================================

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Configuration
    // ─────────────────────────────────────────────────────────────────────────
    const CONFIG = {
        SWATCH_SIZE: 14,          // px – width & height of each swatch
        BORDER_RADIUS: 2,         // px – corner rounding
        BORDER_WIDTH: 1,          // px – border width
        DARK_BORDER: '#333333',   // border used on light-color swatches
        LIGHT_BORDER: '#cccccc',  // border used on dark-color swatches
        DEBOUNCE_MS: 250,         // ms – debounce window for MutationObserver
        TOGGLE_KEY: 'c',          // key for Alt+Key and Ctrl+Shift+Key shortcuts
        STORAGE_KEY: 'cs_enabled',// GM_setValue / GM_getValue key
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1b. Tampermonkey Menu Command (dynamic label reflecting current state)
    // ─────────────────────────────────────────────────────────────────────────
    let menuCommandId = null;

    /** Re-register the menu command so its label always shows current state. */
    function refreshMenuLabel() {
        try {
            if (typeof GM_unregisterMenuCommand !== 'undefined' && menuCommandId !== null) {
                GM_unregisterMenuCommand(menuCommandId);
            }
        } catch (_) { /* ignore */ }
        try {
            if (typeof GM_registerMenuCommand !== 'undefined') {
                const label = enabled
                    ? '颜色预览：已开启 ✓'
                    : '颜色预览：已关闭';
                menuCommandId = GM_registerMenuCommand(label, toggle);
            }
        } catch (_) { /* ignore — script manager may not support menu commands */ }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Named CSS Colors  (148 standard names → hex)
    //    Source: CSS Color Module Level 4
    // ─────────────────────────────────────────────────────────────────────────
    const NAMED_COLORS = {
        // Reds & Pinks
        'aliceblue': '#f0f8ff', 'antiquewhite': '#faebd7', 'aqua': '#00ffff',
        'aquamarine': '#7fffd4', 'azure': '#f0ffff', 'beige': '#f5f5dc',
        'bisque': '#ffe4c4', 'black': '#000000', 'blanchedalmond': '#ffebcd',
        'blue': '#0000ff', 'blueviolet': '#8a2be2', 'brown': '#a52a2a',
        'burlywood': '#deb887', 'cadetblue': '#5f9ea0', 'chartreuse': '#7fff00',
        'chocolate': '#d2691e', 'coral': '#ff7f50', 'cornflowerblue': '#6495ed',
        'cornsilk': '#fff8dc', 'crimson': '#dc143c', 'cyan': '#00ffff',
        'darkblue': '#00008b', 'darkcyan': '#008b8b', 'darkgoldenrod': '#b8860b',
        'darkgray': '#a9a9a9', 'darkgreen': '#006400', 'darkgrey': '#a9a9a9',
        'darkkhaki': '#bdb76b', 'darkmagenta': '#8b008b', 'darkolivegreen': '#556b2f',
        'darkorange': '#ff8c00', 'darkorchid': '#9932cc', 'darkred': '#8b0000',
        'darksalmon': '#e9967a', 'darkseagreen': '#8fbc8f', 'darkslateblue': '#483d8b',
        'darkslategray': '#2f4f4f', 'darkslategrey': '#2f4f4f', 'darkturquoise': '#00ced1',
        'darkviolet': '#9400d3', 'deeppink': '#ff1493', 'deepskyblue': '#00bfff',
        'dimgray': '#696969', 'dimgrey': '#696969', 'dodgerblue': '#1e90ff',
        'firebrick': '#b22222', 'floralwhite': '#fffaf0', 'forestgreen': '#228b22',
        'fuchsia': '#ff00ff', 'gainsboro': '#dcdcdc', 'ghostwhite': '#f8f8ff',
        'gold': '#ffd700', 'goldenrod': '#daa520', 'gray': '#808080',
        'green': '#008000', 'greenyellow': '#adff2f', 'grey': '#808080',
        'honeydew': '#f0fff0', 'hotpink': '#ff69b4', 'indianred': '#cd5c5c',
        'indigo': '#4b0082', 'ivory': '#fffff0', 'khaki': '#f0e68c',
        'lavender': '#e6e6fa', 'lavenderblush': '#fff0f5', 'lawngreen': '#7cfc00',
        'lemonchiffon': '#fffacd', 'lightblue': '#add8e6', 'lightcoral': '#f08080',
        'lightcyan': '#e0ffff', 'lightgoldenrodyellow': '#fafad2', 'lightgray': '#d3d3d3',
        'lightgreen': '#90ee90', 'lightgrey': '#d3d3d3', 'lightpink': '#ffb6c1',
        'lightsalmon': '#ffa07a', 'lightseagreen': '#20b2aa', 'lightskyblue': '#87cefa',
        'lightslategray': '#778899', 'lightslategrey': '#778899', 'lightsteelblue': '#b0c4de',
        'lightyellow': '#ffffe0', 'lime': '#00ff00', 'limegreen': '#32cd32',
        'linen': '#faf0e6', 'magenta': '#ff00ff', 'maroon': '#800000',
        'mediumaquamarine': '#66cdaa', 'mediumblue': '#0000cd', 'mediumorchid': '#ba55d3',
        'mediumpurple': '#9370db', 'mediumseagreen': '#3cb371', 'mediumslateblue': '#7b68ee',
        'mediumspringgreen': '#00fa9a', 'mediumturquoise': '#48d1cc', 'mediumvioletred': '#c71585',
        'midnightblue': '#191970', 'mintcream': '#f5fffa', 'mistyrose': '#ffe4e1',
        'moccasin': '#ffe4b5', 'navajowhite': '#ffdead', 'navy': '#000080',
        'oldlace': '#fdf5e6', 'olive': '#808000', 'olivedrab': '#6b8e23',
        'orange': '#ffa500', 'orangered': '#ff4500', 'orchid': '#da70d6',
        'palegoldenrod': '#eee8aa', 'palegreen': '#98fb98', 'paleturquoise': '#afeeee',
        'palevioletred': '#db7093', 'papayawhip': '#ffefd5', 'peachpuff': '#ffdab9',
        'peru': '#cd853f', 'pink': '#ffc0cb', 'plum': '#dda0dd',
        'powderblue': '#b0e0e6', 'purple': '#800080', 'rebeccapurple': '#663399',
        'red': '#ff0000', 'rosybrown': '#bc8f8f', 'royalblue': '#4169e1',
        'saddlebrown': '#8b4513', 'salmon': '#fa8072', 'sandybrown': '#f4a460',
        'seagreen': '#2e8b57', 'seashell': '#fff5ee', 'sienna': '#a0522d',
        'silver': '#c0c0c0', 'skyblue': '#87ceeb', 'slateblue': '#6a5acd',
        'slategray': '#708090', 'slategrey': '#708090', 'snow': '#fffafa',
        'springgreen': '#00ff7f', 'steelblue': '#4682b4', 'tan': '#d2b48c',
        'teal': '#008080', 'thistle': '#d8bfd8', 'tomato': '#ff6347',
        'transparent': '#000000', // transparent → black with alpha 0
        'turquoise': '#40e0d0', 'violet': '#ee82ee', 'wheat': '#f5deb3',
        'white': '#ffffff', 'whitesmoke': '#f5f5f5', 'yellow': '#ffff00',
        'yellowgreen': '#9acd32',
    };

    // Build the named-color regex once (longest names first so "darkred" is
    // tested before "red", preventing partial matches within compound names).
    //
    // Negative lookbehind (?<![\w-]) ensures the color name is NOT preceded by
    // a word character or hyphen — this excludes CSS-class-like tokens:
    //   ✓ matches  " red ", "darkred", "color:red;"
    //   ✗ skipped  "text-red-500", "--red", "non-red", "reddish"
    // Trailing \b prevents matching inside longer words (e.g. "reddish").
    const NAMED_COLOR_NAMES = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length);
    const NAMED_COLOR_RE = new RegExp(
        '(?<![\\w-])(' + NAMED_COLOR_NAMES.join('|') + ')\\b',
        'gi'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Global Styles  (injected once into <head>)
    // ─────────────────────────────────────────────────────────────────────────
    function injectGlobalStyles() {
        const style = document.createElement('style');
        style.id = 'cs-global-styles';
        style.textContent = `
            /* Wrapper keeps the original text + swatch inline */
            .cs-color-wrap {
                display: inline;
                white-space: normal;
            }

            /* The clickable color swatch */
            .cs-color-swatch {
                display: inline-block;
                width: ${CONFIG.SWATCH_SIZE}px;
                height: ${CONFIG.SWATCH_SIZE}px;
                margin-left: 3px;
                vertical-align: middle;
                border-radius: ${CONFIG.BORDER_RADIUS + 1}px;
                cursor: pointer;
                position: relative;
                box-sizing: border-box;
                border: ${CONFIG.BORDER_WIDTH}px solid;
                flex-shrink: 0;
                transition: transform 0.12s ease;
            }
            .cs-color-swatch:hover {
                transform: scale(1.25);
                z-index: 1;
            }

            /* Checkerboard behind semi-transparent colors */
            .cs-color-swatch.cs-has-alpha::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: ${CONFIG.BORDER_RADIUS}px;
                background-image:
                    linear-gradient(45deg, #bbb 25%, transparent 25%),
                    linear-gradient(-45deg, #bbb 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #bbb 75%),
                    linear-gradient(-45deg, transparent 75%, #bbb 75%);
                background-size: 7px 7px;
                background-position: 0 0, 0 3.5px, 3.5px -3.5px, -3.5px 0;
            }

            /* The actual color sits on top via background-color on the element itself */
            .cs-color-swatch.cs-has-alpha {
                background-clip: content-box;
            }

            /* Copy-feedback flash animation */
            .cs-color-swatch.cs-copied {
                animation: cs-copy-flash 0.55s ease;
            }
            @keyframes cs-copy-flash {
                0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.55); }
                60%  { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
                100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
            }

            /* ---- Toggle: hide swatches when disabled ---- */
            html.cs-swatch-disabled .cs-color-wrap,
            html.cs-swatch-disabled .cs-color-swatch {
                display: none !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Color Utility Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Reusable 1×1 canvas for parsing ANY valid CSS color string into actual
     * RGBA pixel values.  The browserʼs own CSS parser handles every format
     * (hex, rgb, rgba, hsl, hsla, named colors, modern space syntax, …)
     * uniformly — no manual conversion needed.
     */
    const _colorCtx = (() => {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        return c.getContext('2d', { willReadFrequently: true });
    })();

    /** Parse a CSS color string → { r, g, b, a }.  a is 0…1. */
    function getPixelRGBA(colorStr) {
        _colorCtx.fillStyle = colorStr;
        _colorCtx.fillRect(0, 0, 1, 1);
        const d = _colorCtx.getImageData(0, 0, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    }

    /**
     * Relative luminance (sRGB → linear). Used to decide whether the swatch
     * border should be dark or light.
     */
    function luminance(r, g, b) {
        const linearize = (c) => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Color Pattern Definitions
    //    Each entry: { pattern: RegExp, handler: (match) => {r,g,b,a} | null }
    // ─────────────────────────────────────────────────────────────────────────
    const COLOR_PATTERNS = [
        // --- Hex: #RGB, #RRGGBB, #RGBA, #RRGGBBAA ---
        {
            pattern: /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g,
            handler: (m) => m[0],  // return the matched hex string as-is
        },
        // --- RGB / RGBA — legacy comma syntax: rgb(97,95,255), rgba(97,95,255,0.8) ---
        {
            pattern: /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => m[0],
        },
        // --- RGB / RGBA — modern space syntax: rgb(97 95 255), rgba(97 95 255 / 0.8) ---
        {
            pattern: /rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => m[0],
        },
        // --- HSL / HSLA — legacy comma syntax ---
        {
            pattern: /hsla?\(\s*([\d.]+)\s*(deg|rad|grad|turn)?\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*(?:,\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => m[0],
        },
        // --- HSL / HSLA — modern space syntax: hsl(200 80% 60% / 0.7) ---
        {
            pattern: /hsla?\(\s*([\d.]+)(deg|rad|grad|turn)?\s+(\d{1,3})%?\s+(\d{1,3})%?\s*(?:\/\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => m[0],
        },
        // --- Named CSS colors (148 standard names) ---
        {
            pattern: NAMED_COLOR_RE,
            handler: (m) => {
                // Only accept names that are in our map
                const name = m[1].toLowerCase();
                return NAMED_COLORS.hasOwnProperty(name) ? name : null;
            },
        },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // 6. State  (persisted across page loads via GM_getValue)
    // ─────────────────────────────────────────────────────────────────────────
    let enabled;
    {
        let saved = true; // default
        try { saved = GM_getValue(CONFIG.STORAGE_KEY, true); } catch (_) { /* ok */ }
        enabled = saved !== false;
    }
    const processedNodes = new WeakSet(); // text nodes already scanned

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Swatch Creation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create the wrapper DOM fragment that replaces a color-string in text.
     * Returns a DocumentFragment containing a <span.cs-color-wrap> which holds
     * the original text node + the swatch <span>.
     */
    function createSwatchWrapper(originalText) {
        const wrap = document.createElement('span');
        wrap.className = 'cs-color-wrap';

        // Original text preserved verbatim
        wrap.appendChild(document.createTextNode(originalText));

        // Swatch
        const swatch = document.createElement('span');
        swatch.className = 'cs-color-swatch';

        // ── Background: use the original color string directly ──
        // The browser’s CSS parser natively handles hex / rgb() / rgba() /
        // hsl() / hsla() / named colors / modern space-syntax — no conversion
        // needed.  Alpha transparency renders naturally.
        swatch.style.backgroundColor = originalText;

        // ── Parse the actual rendered pixel for border & tooltip ──
        const px = getPixelRGBA(originalText);

        // Alpha checkerboard
        if (px.a < 1) {
            swatch.classList.add('cs-has-alpha');
        }

        // Adaptive border based on luminance
        const lum = luminance(px.r, px.g, px.b);
        swatch.style.borderColor = lum > 0.45 ? CONFIG.DARK_BORDER : CONFIG.LIGHT_BORDER;

        // ── Tooltip: show original + parsed RGBA ──
        swatch.title = originalText
            + '\n→ rgba(' + px.r + ', ' + px.g + ', ' + px.b + ', ' + px.a.toFixed(2) + ')'
            + '\nClick to copy';
        swatch.setAttribute('data-cs-color', originalText);

        // Click → copy
        swatch.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            copyColor(originalText, swatch);
        });

        wrap.appendChild(swatch);
        return wrap;
    }

    /** Copy a color string to clipboard and show brief feedback. */
    function copyColor(text, swatchEl) {
        // Use modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => flashCopied(swatchEl)).catch(() => {
                // Fallback silently
            });
        } else {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try {
                document.execCommand('copy');
                flashCopied(swatchEl);
            } catch (_) { /* ignore */ }
            document.body.removeChild(ta);
        }
    }

    /** Brief green-flash animation on the swatch to confirm copy. */
    function flashCopied(swatchEl) {
        swatchEl.classList.add('cs-copied');
        swatchEl.addEventListener('animationend', function handler() {
            swatchEl.classList.remove('cs-copied');
            swatchEl.removeEventListener('animationend', handler);
        }, { once: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Text Node Processing
    // ─────────────────────────────────────────────────────────────────────────

    /** Return true if a text node is a candidate for color detection. */
    function isValidTextNode(node) {
        if (processedNodes.has(node)) return false;

        const parent = node.parentElement;
        if (!parent) return false;

        // Skip non-rendered / interactive / editable elements
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
            tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
            tag === 'OPTION' || tag === 'SVG') {
            return false;
        }

        // Skip SVG namespace
        if (parent.namespaceURI === 'http://www.w3.org/2000/svg') return false;

        // Skip our own wrappers
        if (parent.closest('.cs-color-wrap')) return false;

        // Skip contenteditable regions (user is typing there)
        if (parent.isContentEditable) return false;

        return true;
    }

    /**
     * Find all color matches in a string.
     * Returns an array of { index, length, text },
     * sorted by position, with overlaps removed (first match wins).
     * `text` is the original CSS color string (e.g. "#ff0000", "rgb(97,95,255)").
     */
    function findAllMatches(text) {
        const raw = [];

        for (const { pattern, handler } of COLOR_PATTERNS) {
            pattern.lastIndex = 0;
            let m;
            while ((m = pattern.exec(text)) !== null) {
                const colorStr = handler(m);
                if (!colorStr) continue;  // handler returns null for invalid matches
                raw.push({
                    index: m.index,
                    length: m[0].length,
                    text: colorStr,  // the validated CSS color string
                });
            }
        }

        if (raw.length === 0) return [];

        // Sort by position ascending
        raw.sort((a, b) => a.index - b.index);

        // Remove overlaps: keep first match, skip any that start inside it
        const filtered = [];
        let boundary = 0;
        for (const item of raw) {
            if (item.index >= boundary) {
                filtered.push(item);
                boundary = item.index + item.length;
            }
        }
        return filtered;
    }

    /**
     * Process a single text node: find color strings, replace the node with
     * text fragments + swatch wrappers.
     */
    function processTextNode(node) {
        // Guard: don't re-process
        if (processedNodes.has(node)) return;

        const text = node.textContent;
        if (!text) {
            processedNodes.add(node);
            return;
        }

        const matches = findAllMatches(text);
        if (matches.length === 0) {
            processedNodes.add(node);
            return;
        }

        const parent = node.parentNode;
        if (!parent) {
            processedNodes.add(node);
            return;
        }

        // Build replacement fragments
        const fragments = [];
        let cursor = 0;
        for (const m of matches) {
            // Text before this match
            if (m.index > cursor) {
                const tn = document.createTextNode(text.slice(cursor, m.index));
                processedNodes.add(tn);
                fragments.push(tn);
            }
            // Swatch wrapper — uses the original color string directly;
            // the canvas pixel reader handles border/tooltip internally.
            fragments.push(createSwatchWrapper(m.text));
            cursor = m.index + m.length;
        }
        // Remaining text after last match
        if (cursor < text.length) {
            const tn = document.createTextNode(text.slice(cursor));
            processedNodes.add(tn);
            fragments.push(tn);
        }

        // Replace original node with fragments (use a DocumentFragment to
        // preserve insertion order — inserting one-by-one before the same ref
        // would reverse them).
        const df = document.createDocumentFragment();
        for (const frag of fragments) {
            df.appendChild(frag);
        }
        parent.insertBefore(df, node);
        parent.removeChild(node);
        processedNodes.add(node);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Tree Walking  (collect text nodes from a subtree)
    // ─────────────────────────────────────────────────────────────────────────

    function collectTextNodes(root, outSet) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    return isValidTextNode(node)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                },
            }
        );
        let node;
        while ((node = walker.nextNode())) {
            outSet.add(node);
        }
    }

    /** Process all valid text nodes under a root element (or entire document). */
    function scanRoot(root) {
        const nodes = new Set();
        collectTextNodes(root, nodes);
        for (const node of nodes) {
            processTextNode(node);
        }
    }

    function scanDocument() {
        if (!enabled) return;
        scanRoot(document.body);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. MutationObserver  (handles dynamic content / SPAs)
    // ─────────────────────────────────────────────────────────────────────────

    let debounceTimer = null;
    let pendingRoots = new Set();

    const observer = new MutationObserver(function (mutations) {
        if (!enabled) return;

        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (isValidTextNode(node)) pendingRoots.add(node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Collect text nodes inside this newly-added element
                    collectTextNodes(node, pendingRoots);
                }
            }
        }

        if (pendingRoots.size === 0) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
            const batch = pendingRoots;
            pendingRoots = new Set();
            for (const node of batch) {
                if (node.nodeType === Node.TEXT_NODE) {
                    processTextNode(node);
                }
                // elements added via collectTextNodes were already filtered;
                // their text nodes are in the set.  But we might also have
                // element nodes directly — skip those here.
            }
        }, CONFIG.DEBOUNCE_MS);
    });

    function startObserver() {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Toggle  (Alt+C / Ctrl+Shift+C / Menu command)
    // ─────────────────────────────────────────────────────────────────────────

    function toggle() {
        enabled = !enabled;

        // Persist across page reloads
        try { GM_setValue(CONFIG.STORAGE_KEY, enabled); } catch (_) { /* ok */ }

        if (enabled) {
            document.documentElement.classList.remove('cs-swatch-disabled');
            // Re-scan — new content may have appeared while disabled
            scanDocument();
        } else {
            document.documentElement.classList.add('cs-swatch-disabled');
        }

        // Update the Tampermonkey menu label
        refreshMenuLabel();
    }

    function setupKeyboardShortcut() {
        document.addEventListener('keydown', function (e) {
            // Alt+C  or  Ctrl+Shift+C  (case-insensitive)
            const isToggleKey = e.key.toLowerCase() === CONFIG.TOGGLE_KEY;
            const isAltC = e.altKey && !e.ctrlKey && !e.metaKey && isToggleKey;
            const isCtrlShiftC = e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && isToggleKey;

            if (isAltC || isCtrlShiftC) {
                // Don't trigger when user is typing inside an input / textarea / contenteditable
                const active = document.activeElement;
                if (active) {
                    const tag = active.tagName;
                    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
                        active.isContentEditable) {
                        return;
                    }
                }
                e.preventDefault();
                e.stopPropagation();
                toggle();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Initialisation
    // ─────────────────────────────────────────────────────────────────────────

    function init() {
        injectGlobalStyles();
        setupKeyboardShortcut();

        // Apply persisted on/off state to the DOM
        if (!enabled) {
            document.documentElement.classList.add('cs-swatch-disabled');
        }

        // Register Tampermonkey menu command with initial label
        refreshMenuLabel();

        startObserver();

        // Initial scan — wait for the body to be ready
        if (document.body) {
            // Use requestIdleCallback for a non-blocking first scan if available
            const doScan = () => scanDocument();
            if (window.requestIdleCallback) {
                requestIdleCallback(doScan, { timeout: 800 });
            } else {
                // Small delay to let the browser finish painting
                setTimeout(doScan, 60);
            }
        } else {
            // Rare edge case: body not yet available at document-end
            document.addEventListener('DOMContentLoaded', function () {
                scanDocument();
            });
        }
    }

    init();
})();
