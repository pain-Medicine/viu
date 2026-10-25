import { Platform, Text as RNText, TextProps, TextStyle } from 'react-native';

import { useTheme } from '../state/settings';
import type { TextRole, Theme } from '../theme/types';

// Nothing smaller than this reaches the screen: below it (11 sp on an Android
// TV), text at sofa distance stops being readable.
export const MIN_TEXT = 22;

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

// Headings and card titles balance their lines, so a long title doesn't leave one word alone
// on the last line. Android has its own setting for it; browsers take CSS.
const BALANCED: TextRole[] = ['hero', 'page', 'headline', 'section', 'cardTitle'];
const balancedWeb = { textWrap: 'balance' } as TextStyle;

// Theme-aware text. Screens name what the text is for; the theme decides how
// that looks, so screens never need to know which theme is active.
export function Text({ variant = 'body', size, color, theme: override, style, children, ...rest }: Props) {
  const active = useTheme();
  const theme = override ?? active;
  const balanced = BALANCED.includes(variant);
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      textBreakStrategy={balanced ? 'balanced' : undefined}
      {...rest}
      style={[
        textStyle(theme, variant, size),
        { color: color ?? theme.colors.text },
        balanced && Platform.OS === 'web' && balancedWeb,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
