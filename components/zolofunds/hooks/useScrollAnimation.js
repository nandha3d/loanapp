import { useEffect, useRef } from 'react';

/**
 * Custom hook for scroll-triggered animations using IntersectionObserver.
 * Adds a `.visible` class when elements with `.animate-on-scroll` enter the viewport.
 * One-shot: triggers once, never re-triggers.
 */
export function useScrollAnimation(threshold = 0.15, rootMargin = '0px 0px -40px 0px') {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = container.querySelectorAll('.animate-on-scroll');
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return containerRef;
}
