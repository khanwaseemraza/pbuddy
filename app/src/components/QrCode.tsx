// QR for the hand-off code (shown by the sender, scanned by the traveller).
import QRCode from 'react-native-qrcode-svg';
import { View } from 'react-native';

export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  return (
    <View style={{ alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16 }}>
      <QRCode value={value} size={size} backgroundColor="#FFFFFF" color="#222222" />
    </View>
  );
}
