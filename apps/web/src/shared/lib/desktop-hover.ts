import { useEffect, useState } from 'react';

export const desktopHover = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

export function useDesktopHover() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(desktopHover);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
}
