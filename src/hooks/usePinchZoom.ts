import { useEffect } from 'react';

export const clampZoom = (value: number) => Math.max(1, Math.min(4, value));
// Preview with a compositor transform; render sharper PDF pages once fingers lift.
export function usePinchZoom(container: HTMLElement | null, zoom: number, setZoom: (zoom: number) => void) {
  useEffect(() => {
    if (!container) return;
    let initial = 0, target = zoom, anchorX = 0, anchorY = 0;
    let content: HTMLElement | null = null;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault(); initial = distance(event.touches); target = zoom;
      const box = container.getBoundingClientRect();
      anchorX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - box.left;
      anchorY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - box.top;
      content = container.querySelector<HTMLElement>('.react-pdf__Document');
    };
    const move = (event: TouchEvent) => {
      if (!initial || event.touches.length !== 2) return;
      event.preventDefault(); target = clampZoom(zoom * distance(event.touches) / initial);
      if (content) { content.style.transformOrigin = '0 0'; content.style.transform = `scale(${target / zoom})`; }
    };
    const finish = () => {
      if (!initial) return;
      initial = 0;
      if (content) content.style.transform = '';
      const left = (container.scrollLeft + anchorX) * target / zoom - anchorX;
      const top = (container.scrollTop + anchorY) * target / zoom - anchorY;
      setZoom(target);
      requestAnimationFrame(() => { container.scrollLeft = left; container.scrollTop = top; });
    };
    container.addEventListener('touchstart', start, { passive: false });
    container.addEventListener('touchmove', move, { passive: false });
    container.addEventListener('touchend', finish); container.addEventListener('touchcancel', finish);
    return () => {
      if (content) content.style.transform = '';
      container.removeEventListener('touchstart', start); container.removeEventListener('touchmove', move);
      container.removeEventListener('touchend', finish); container.removeEventListener('touchcancel', finish);
    };
  }, [container, zoom, setZoom]);
}
