"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type TooltipTheme = {
  background?: string;
  borderColor?: string;
  color?: string;
  boxShadow?: string;
};

/**
 * Tooltip that works on desktop hover and touch (tap-to-toggle) without iOS "sticky" native tooltips.
 * - Avoid using HTML `title` attributes in the app; use this instead.
 */
export function Tooltip({
  content,
  children,
  maxWidthPx = 280,
  minWidthPx = 0,
  dismissMsTouch = 2200,
  offsetPx = 10,
  theme,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  maxWidthPx?: number;
  minWidthPx?: number;
  /** Auto-dismiss on coarse pointers (touch) so it doesn't hang around. */
  dismissMsTouch?: number;
  /** Gap between the anchor and tooltip (in px). */
  offsetPx?: number;
  theme?: TooltipTheme;
}) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'center' | 'left' | 'right'>('center');
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [anchorRect, setAnchorRect] = useState<{ left: number; right: number; top: number; bottom: number; width: number; height: number } | null>(null);

  const { isCoarsePointer, canHover } = useMemo(() => {
    if (typeof window === 'undefined') return { isCoarsePointer: false, canHover: true };

    const mm = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;

    // Prefer any-* queries; they're more reliable when a device has multiple input types.
    const anyHover = mm ? mm('(any-hover: hover)').matches : true;
    const hover = mm ? mm('(hover: hover)').matches : true;
    const anyCoarse = mm ? mm('(any-pointer: coarse)').matches : false;
    const coarse = mm ? mm('(pointer: coarse)').matches : false;

    const hoverCapable = anyHover || hover;

    // Some Mac Safari setups report maxTouchPoints > 0 even when you have a mouse.
    const touchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0;
    const touchCapable = touchPoints > 0;

    return {
      canHover: hoverCapable,
      isCoarsePointer: coarse || (anyCoarse && !hoverCapable) || (touchCapable && !hoverCapable),
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const themeStyles = useMemo(
    () => ({
      background: theme?.background ?? 'rgba(15, 23, 42, 0.96)',
      borderColor: theme?.borderColor ?? 'rgba(255,255,255,0.10)',
      color: theme?.color ?? 'rgba(255,255,255,0.92)',
      boxShadow: theme?.boxShadow ?? '0 18px 32px -24px rgba(8,15,31,0.65)',
    }),
    [theme?.background, theme?.borderColor, theme?.color, theme?.boxShadow]
  );

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: Event) => {
      const root = wrapperRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      close();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('pointerdown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [close, open]);

  // Auto-dismiss on touch
  useEffect(() => {
    if (!open) return;
    if (!isCoarsePointer) return;
    const t = window.setTimeout(() => close(), dismissMsTouch);
    return () => window.clearTimeout(t);
  }, [close, dismissMsTouch, isCoarsePointer, open]);

  // Capture anchor rect when opening (needed for portal positioning).
  useLayoutEffect(() => {
    if (!open) {
      setAnchorRect(null);
      setAlign('center');
      setPlacement('top');
      return;
    }

    const anchor = wrapperRef.current;
    if (!anchor) return;

    const r = anchor.getBoundingClientRect();
    setAnchorRect({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height });
  }, [open]);

  // Smart-ish placement: if tooltip overflows viewport, pin left/right and flip top/bottom.
  useLayoutEffect(() => {
    if (!open) return;
    const tip = tipRef.current;
    if (!tip) return;

    requestAnimationFrame(() => {
      const rect = tip.getBoundingClientRect();
      const pad = 12;

      // horizontal align
      if (rect.left < pad) setAlign('left');
      else if (rect.right > window.innerWidth - pad) setAlign('right');
      else setAlign('center');

      // vertical flip if needed
      if (rect.top < pad) setPlacement('bottom');
      else setPlacement('top');
    });
  }, [open, anchorRect]);

  const tooltipEl = open && anchorRect
    ? createPortal(
        <span
          ref={tipRef}
          className={'pointer-events-none fixed z-[9999] rounded-xl border px-3 py-2 text-xs leading-relaxed'}
          style={{
            maxWidth: `min(${maxWidthPx}px, calc(100vw - 24px))`,
            minWidth: minWidthPx > 0 ? `min(${minWidthPx}px, calc(100vw - 24px))` : undefined,
            background: themeStyles.background,
            borderColor: themeStyles.borderColor,
            color: themeStyles.color,
            boxShadow: themeStyles.boxShadow,
            top: placement === 'top' ? (anchorRect.top - offsetPx) : (anchorRect.bottom + offsetPx),
            left: align === 'left'
              ? Math.max(12, anchorRect.left)
              : align === 'right'
                ? Math.min(window.innerWidth - 12, anchorRect.right)
                : (anchorRect.left + anchorRect.width / 2),
            transform: placement === 'top'
              ? (align === 'center' ? 'translate(-50%, -100%)' : 'translate(0, -100%)')
              : (align === 'center' ? 'translate(-50%, 0)' : 'translate(0, 0)'),
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </span>,
        document.body
      )
    : null;

  return (
    <span
      ref={wrapperRef}
      className="inline-flex"
      onMouseEnter={() => {
        if (canHover) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHover) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        className="inline-flex"
        onClick={() => {
          // Click-to-toggle on non-hover/coarse devices.
          if (!canHover || isCoarsePointer) setOpen((v) => !v);
        }}
      >
        {children}
      </span>
      {tooltipEl}
    </span>
  );
}
