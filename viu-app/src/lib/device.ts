import { Dimensions, Platform } from 'react-native';

// What to call the thing Viu runs on, for copy like "saved on this TV".
export type DeviceKind = 'TV' | 'phone' | 'tablet' | 'browser';

export function deviceKind(): DeviceKind {
  if (Platform.isTV) return 'TV';
  if (Platform.OS === 'web') return 'browser';
  // Android and iOS both call 600 dp on the short side a tablet.
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= 600 ? 'tablet' : 'phone';
}
