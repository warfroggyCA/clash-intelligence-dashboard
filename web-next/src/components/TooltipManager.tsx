'use client';

import { useEffect } from 'react';

const TOOLTIP_CLASS = 'tooltip-trigger';

function applyTooltip(element: Element) {
  if (!element || !(element instanceof HTMLElement)) return;
  const title = element.getAttribute('title');
  if (!title) return;

  element.setAttribute('data-tooltip', title);
  element.removeAttribute('title');

  if (typeof window !== 'undefined') {
    const computedPosition = window.getComputedStyle(element).position;
    if (computedPosition !== 'static' && !element.style.position) {
      element.style.position = computedPosition;
    }
  }

  if (!element.classList.contains(TOOLTIP_CLASS)) {
    element.classList.add(TOOLTIP_CLASS);
  }

  if (!element.hasAttribute('aria-label')) {
    element.setAttribute('aria-label', title);
  }
}

export function TooltipManager(): null {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const migrate = () => {
      const nodes = document.querySelectorAll('[title]');
      nodes.forEach(applyTooltip);
    };

    migrate();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'title' && mutation.target) {
          applyTooltip(mutation.target as Element);
        }
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.hasAttribute('title')) {
              applyTooltip(node);
            }
            node.querySelectorAll?.('[title]').forEach(applyTooltip);
          });
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['title'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

export default TooltipManager;
