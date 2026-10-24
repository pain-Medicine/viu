import { createContext, useContext } from 'react';

// What a component sits on: the screen's ground (dark in every theme) or the
// feature panel (light in some). Panels set it, so focus and text colours can
// follow without every caller passing a flag.
export type Surface = 'ground' | 'feature';

export const SurfaceContext = createContext<Surface>('ground');
export const useSurface = () => useContext(SurfaceContext);
