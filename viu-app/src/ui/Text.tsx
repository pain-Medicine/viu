import { Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme } from '../state/settings';
import type { TextRole, Theme } from '../theme/types';

// Nothing smaller than this reaches the screen: below it, text on a TV at
// sofa distance stops being readable.
export const MIN_TEXT = 18;

// Android TV's "large text" setting scales fonts up to 1.3×; boxes around
// text are sized to take that, and anything beyond it would clip.
const MAX_FONT_SCALE = 1.3;

interface Props extends TextProps {
  variant?: TextRole;
  // Overrides the role's size; tracking and line height follow.
  size?: number;
  color?: string;
  // Sets text in another theme, for previews of it.
  theme?: Theme;
  children?: React.ReactNode;
}

export function textStyle(theme: Theme, variant: TextRole, size?: number): TextStyle {
  const token = theme.text[variant];
  const fontSize = Math.max(MIN_TEXT, size ?? token.size);
  return {
    fontFamily: theme.fonts[token.font],
    fontSize,
    lineHeight: Math.round(fontSize * (token.lineHeight ?? 1.3)),
    letterSpacing: (token.tracking ?? 0) * fontSize,
    textTransform: token.upper ? 'uppercase' : 'none',
  };
}

// Theme-aware text. Screens name what the text is for; the theme decides how
// that looks, so screens never need to know which theme is active.
export function Text({ variant = 'body', size, color, theme: override, style, children, ...rest }: Props) {
  const active = useTheme();
  const theme = override ?? active;
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[textStyle(theme, variant, size), { color: color ?? theme.colors.text }, style]}
    >
      {children}
    </RNText>
  );
}
