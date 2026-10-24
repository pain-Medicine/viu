import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme } from '../state/settings';

type Variant = 'display' | 'title' | 'body' | 'bodyMedium' | 'bodyBold' | 'label' | 'labelBold';

interface Props extends TextProps {
  variant?: Variant;
  size?: number;
  color?: string;
  children?: React.ReactNode;
}

// Theme-aware text. Display and label roles pick up the theme's casing and
// tracking, so screens never need to know which theme is active.
export function Text({ variant = 'body', size, color, style, children, ...rest }: Props) {
  const theme = useTheme();
  const base: TextStyle = { color: color ?? theme.colors.text };
  switch (variant) {
    case 'display': {
      const fontSize = size ?? 92;
      Object.assign(base, {
        fontFamily: theme.fonts.display,
        fontSize,
        lineHeight: Math.round(fontSize * theme.type.displayLineHeight),
        letterSpacing: theme.type.displayTracking * (fontSize / 92),
        textTransform: theme.type.displayUppercase ? 'uppercase' : 'none',
      });
      break;
    }
    case 'title':
      Object.assign(base, {
        fontFamily: theme.fonts.title,
        fontSize: size ?? 30,
        letterSpacing: theme.type.displayUppercase ? 1 : -0.4,
        textTransform: theme.type.displayUppercase ? 'uppercase' : 'none',
      });
      break;
    case 'label':
    case 'labelBold':
      Object.assign(base, {
        fontFamily: variant === 'label' ? theme.fonts.label : theme.fonts.labelBold,
        fontSize: size ?? 18,
        letterSpacing: theme.type.labelTracking,
        textTransform: theme.type.labelUppercase ? 'uppercase' : 'none',
      });
      break;
    default:
      Object.assign(base, {
        fontFamily: theme.fonts[variant],
        fontSize: size ?? 22,
        lineHeight: Math.round((size ?? 22) * 1.45),
      });
  }
  return (
    <RNText {...rest} style={[base, style]}>
      {children}
    </RNText>
  );
}
