"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ShadowRootPortal({ children }: { children: React.ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    // Create a shadow root to isolate from DOM mutations by extensions
    const root = hostRef.current.attachShadow({ mode: 'open' });
    // Adopt base styles by cloning existing stylesheets into the shadow root
    const styleSheets = Array.from(document.styleSheets) as CSSStyleSheet[];
    const frag = document.createDocumentFragment();
    for (const sheet of styleSheets) {
      try {
        // For same-origin stylesheets, re-create a <style> tag with the rules
        const cssRules = (sheet.cssRules || []) as any;
        const cssText = Array.from(cssRules).map((r: CSSRule) => r.cssText).join('\n');
        if (cssText) {
          const styleEl = document.createElement('style');
          styleEl.textContent = cssText;
          frag.appendChild(styleEl);
        }
      } catch {
        // Cross-origin sheets: fall back to link clone where possible
        const ownerNode = sheet && (sheet.ownerNode as HTMLLinkElement | HTMLStyleElement | null);
        if (ownerNode && ownerNode.tagName === 'LINK') {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = (ownerNode as HTMLLinkElement).href;
          frag.appendChild(link);
        }
      }
    }
    root.appendChild(frag);
    setShadowRoot(root);
    return () => setShadowRoot(null);
  }, []);

  return (
    <div ref={hostRef}>
      {shadowRoot ? createPortal(children, shadowRoot as unknown as Element) : null}
    </div>
  );
}

