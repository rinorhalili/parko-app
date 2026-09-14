import { useEffect, useRef, useState } from "react";

export function useInfiniteScroll<T extends Element>(onLoadMore: () => void | Promise<void>, enabled = true) {
  const ref = useRef<T | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target || !enabled) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setIsLoadingMore(true);
      void Promise.resolve(onLoadMore()).finally(() => setIsLoadingMore(false));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  return { ref, isLoadingMore };
}
