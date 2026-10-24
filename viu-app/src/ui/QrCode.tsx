import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// A QR code drawn as one SVG path, dark modules on a light square.
export function QrCode({ value, size, dark = '#000', light = '#fff' }: { value: string; size: number; dark?: string; light?: string }) {
  const { count, d } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) if (qr.isDark(r, col)) path += `M${col} ${r}h1v1h-1z`;
    }
    return { count: n, d: path };
  }, [value]);
  // Four modules of quiet zone, which scanners need.
  const quiet = 4;
  return (
    <View style={{ width: size, height: size, backgroundColor: light }}>
      <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`}>
        <Path d={d} fill={dark} />
      </Svg>
    </View>
  );
}
