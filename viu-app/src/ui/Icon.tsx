import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../state/settings';

export type IconName =
  | 'search'
  | 'home'
  | 'settings'
  | 'play'
  | 'pause'
  | 'back10'
  | 'forward10'
  | 'next'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'list'
  | 'mic'
  | 'grid'
  | 'calendar'
  | 'bookmark'
  | 'plus'
  | 'refresh';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  // Square caps and joins; defaults to the active theme's.
  square?: boolean;
}

export function Icon({ name, size = 24, color, square: squareProp }: Props) {
  const theme = useTheme();
  const square = squareProp ?? theme.shape.squareIcons;
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: square ? ('square' as const) : ('round' as const),
    strokeLinejoin: square ? ('miter' as const) : ('round' as const),
  };
  // The View keeps the icon above absolutely positioned backgrounds (glass
  // tint, chamfer shapes): on web a bare <svg> paints beneath them.
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        {name === 'search' && (
          <>
            <Circle cx={11} cy={11} r={7} {...stroke} />
            <Path d="M20 20l-4-4" {...stroke} />
          </>
        )}
        {name === 'home' && <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill={color} />}
        {name === 'settings' && (
          <>
            <Path
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              {...stroke}
            />
            <Circle cx={12} cy={12} r={3} {...stroke} />
          </>
        )}
        {name === 'play' && <Path d="M7 4l13 8-13 8z" fill={color} />}
        {name === 'pause' && (
          <>
            <Rect x={6} y={4} width={4} height={16} rx={square ? 0 : 1} fill={color} />
            <Rect x={14} y={4} width={4} height={16} rx={square ? 0 : 1} fill={color} />
          </>
        )}
        {name === 'back10' && (
          <>
            <Path d="M4 12a8 8 0 1 0 2.4-5.7" {...stroke} />
            <Path d="M4 4v4h4" {...stroke} />
          </>
        )}
        {name === 'forward10' && (
          <>
            <Path d="M20 12a8 8 0 1 1-2.4-5.7" {...stroke} />
            <Path d="M20 4v4h-4" {...stroke} />
          </>
        )}
        {name === 'next' && <Path d="M5 5l9 7-9 7zM15 5h3v14h-3z" fill={color} />}
        {name === 'check' && <Path d="M5 12l5 5 9-10" {...stroke} strokeWidth={2.6} />}
        {name === 'chevronLeft' && <Path d="M15 5l-7 7 7 7" {...stroke} />}
        {name === 'chevronRight' && <Path d="M9 5l7 7-7 7" {...stroke} />}
        {name === 'list' && <Path d="M4 7h16M4 12h10M4 17h7" {...stroke} />}
        {name === 'mic' && (
          <>
            <Rect x={9} y={3} width={6} height={11} rx={3} {...stroke} />
            <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...stroke} />
          </>
        )}
        {name === 'grid' && (
          <>
            <Rect x={4} y={4} width={6.5} height={6.5} rx={square ? 0 : 1.5} {...stroke} />
            <Rect x={13.5} y={4} width={6.5} height={6.5} rx={square ? 0 : 1.5} {...stroke} />
            <Rect x={4} y={13.5} width={6.5} height={6.5} rx={square ? 0 : 1.5} {...stroke} />
            <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={square ? 0 : 1.5} {...stroke} />
          </>
        )}
        {name === 'calendar' && (
          <>
            <Rect x={4} y={5} width={16} height={15} rx={square ? 0 : 2} {...stroke} />
            <Path d="M4 10h16M9 3v4M15 3v4" {...stroke} />
          </>
        )}
        {name === 'bookmark' && <Path d="M6 4h12v16l-6-4-6 4z" {...stroke} />}
        {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
        {name === 'refresh' && (
          <>
            <Path d="M20 12a8 8 0 1 1-2.4-5.7" {...stroke} />
            <Path d="M20 4v4h-4" {...stroke} />
          </>
        )}
      </Svg>
    </View>
  );
}
