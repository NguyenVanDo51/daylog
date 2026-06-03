import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { colors, spacing } from '@/constants/theme';

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'auto' | 'large';
}

export function SheetModal({ visible, onClose, children, size = 'auto' }: SheetModalProps) {
  const ref = useRef<TrueSheet>(null);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  return (
    <TrueSheet
      ref={ref}
      sizes={[size === 'large' ? '92%' : 'auto']}
      cornerRadius={24}
      backgroundColor={colors.background}
      onDismiss={onClose}
    >
      <View style={styles.content}>
        {children}
      </View>
    </TrueSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing['2xl'], gap: spacing.md },
});
