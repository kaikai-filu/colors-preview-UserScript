// ==UserScript==
// @name         Color Preview Swatch
// @namespace    https://github.com/nicepkg/color-preview-swatch
// @version      1.1.0
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

    // Build the named-color regex once (longest names first to avoid partial matches)
    const NAMED_COLOR_NAMES = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length);
    const NAMED_COLOR_RE = new RegExp(
        '\\b(' + NAMED_COLOR_NAMES.join('|') + ')\\b',
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

    /** Parse a hex string (e.g. "#ff0044" or "#f04") into {r,g,b,a} */
    function hexToRgb(hex) {
        let r, g, b, a = 1;
        const h = hex.slice(1); // drop '#'
        if (h.length === 3 || h.length === 4) {
            // #RGB / #RGBA
            r = parseInt(h[0] + h[0], 16);
            g = parseInt(h[1] + h[1], 16);
            b = parseInt(h[2] + h[2], 16);
            if (h.length === 4) a = parseInt(h[3] + h[3], 16) / 255;
        } else {
            // #RRGGBB / #RRGGBBAA
            r = parseInt(h.slice(0, 2), 16);
            g = parseInt(h.slice(2, 4), 16);
            b = parseInt(h.slice(4, 6), 16);
            if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
        }
        return { r, g, b, a: Math.round(a * 1000) / 1000 };
    }

    /** Parse alpha from a CSS alpha string (number or percentage) */
    function parseAlpha(raw) {
        if (raw === undefined) return 1;
        if (raw.endsWith('%')) return Math.min(1, Math.max(0, parseFloat(raw) / 100));
        return Math.min(1, Math.max(0, parseFloat(raw)));
    }

    /** Convert HSL to RGB.  h: 0-360, s: 0-100, l: 0-100 */
    function hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        if (s === 0) {
            const v = Math.round(l * 255);
            return { r: v, g: v, b: v };
        }
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = l - c / 2;
        let r, g, b;
        if (h < 60)      { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else              { r = c; g = 0; b = x; }
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255),
        };
    }

    /** Convert an HSL hue angle + optional unit to degrees */
    function hueToDegrees(value, unit) {
        const v = parseFloat(value);
        if (!unit || unit.toLowerCase() === 'deg') return v % 360;
        if (unit.toLowerCase() === 'rad') return (v * 180 / Math.PI) % 360;
        if (unit.toLowerCase() === 'grad') return (v * 0.9) % 360;
        if (unit.toLowerCase() === 'turn') return (v * 360) % 360;
        return v % 360;
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

    /** Build a CSS color string for the swatch background. */
    function toCssColor(r, g, b, a) {
        if (a < 1) return `rgba(${r},${g},${b},${a})`;
        return `rgb(${r},${g},${b})`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Color Pattern Definitions
    //    Each entry: { pattern: RegExp, handler: (match) => {r,g,b,a} | null }
    // ─────────────────────────────────────────────────────────────────────────
    const COLOR_PATTERNS = [
        // --- Hex: #RGB, #RRGGBB, #RGBA, #RRGGBBAA ---
        {
            pattern: /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g,
            handler: (m) => hexToRgb(m[0]),
        },
        // --- RGB / RGBA — legacy comma syntax ---
        {
            pattern: /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => ({
                r: Math.min(255, Math.max(0, parseInt(m[1], 10))),
                g: Math.min(255, Math.max(0, parseInt(m[2], 10))),
                b: Math.min(255, Math.max(0, parseInt(m[3], 10))),
                a: parseAlpha(m[4]),
            }),
        },
        // --- RGB / RGBA — modern space syntax (e.g. rgb(255 0 0 / 0.5)) ---
        {
            pattern: /rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*(?:\/\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => ({
                r: Math.min(255, Math.max(0, parseInt(m[1], 10))),
                g: Math.min(255, Math.max(0, parseInt(m[2], 10))),
                b: Math.min(255, Math.max(0, parseInt(m[3], 10))),
                a: parseAlpha(m[4]),
            }),
        },
        // --- HSL / HSLA — legacy comma syntax ---
        {
            pattern: /hsla?\(\s*([\d.]+)\s*(deg|rad|grad|turn)?\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*(?:,\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => {
                const h = hueToDegrees(m[1], m[2]);
                const s = Math.min(100, Math.max(0, parseInt(m[3], 10)));
                const l = Math.min(100, Math.max(0, parseInt(m[4], 10)));
                const rgb = hslToRgb(h, s, l);
                return { ...rgb, a: parseAlpha(m[5]) };
            },
        },
        // --- HSL / HSLA — modern space syntax (e.g. hsl(200 80% 60% / 0.7)) ---
        {
            pattern: /hsla?\(\s*([\d.]+)(deg|rad|grad|turn)?\s+(\d{1,3})%?\s+(\d{1,3})%?\s*(?:\/\s*([\d.]+%?)\s*)?\)/gi,
            handler: (m) => {
                const h = hueToDegrees(m[1], m[2]);
                const s = Math.min(100, Math.max(0, parseInt(m[3], 10)));
                const l = Math.min(100, Math.max(0, parseInt(m[4], 10)));
                const rgb = hslToRgb(h, s, l);
                return { ...rgb, a: parseAlpha(m[5]) };
            },
        },
        // --- Named CSS colors ---
        {
            pattern: NAMED_COLOR_RE,
            handler: (m) => {
                const name = m[1].toLowerCase();
                const hex = NAMED_COLORS[name];
                if (!hex) return null;
                if (name === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
                return hexToRgb(hex);
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
    function createSwatchWrapper(originalText, color) {
        const wrap = document.createElement('span');
        wrap.className = 'cs-color-wrap';

        // Original text
        wrap.appendChild(document.createTextNode(originalText));

        // Swatch
        const swatch = document.createElement('span');
        swatch.className = 'cs-color-swatch';
        swatch.title = originalText + ' — Click to copy';
        swatch.setAttribute('data-cs-color', originalText);

        // Background
        swatch.style.backgroundColor = toCssColor(color.r, color.g, color.b, color.a);

        // Alpha checkerboard
        if (color.a < 1) {
            swatch.classList.add('cs-has-alpha');
        }

        // Adaptive border
        const lum = luminance(color.r, color.g, color.b);
        swatch.style.borderColor = lum > 0.45 ? CONFIG.DARK_BORDER : CONFIG.LIGHT_BORDER;

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
     * Returns an array of { index, length, text, color:{r,g,b,a} },
     * sorted by position, with overlaps removed (first match wins).
     */
    function findAllMatches(text) {
        const raw = [];

        for (const { pattern, handler } of COLOR_PATTERNS) {
            pattern.lastIndex = 0;
            let m;
            while ((m = pattern.exec(text)) !== null) {
                const color = handler(m);
                if (!color) continue;
                raw.push({
                    index: m.index,
                    length: m[0].length,
                    text: m[0],
                    color,
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
            // Swatch wrapper for the matched color
            fragments.push(createSwatchWrapper(m.text, m.color));
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
