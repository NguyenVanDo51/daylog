import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { theme, spacing } from '@/constants/theme';

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'auto' | 'large';
}

export function SheetModal({ visible, onClose, children, size = 'auto' }: SheetModalProps) {
  const ref = useRef<TrueSheet>(null);
  const presented = useRef(false);

  useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present().catch(() => {});
    } else if (presented.current) {
      presented.current = false;
      ref.current?.dismiss().catch(() => {});
    }
  }, [visible]);

  return (
    <TrueSheet
      ref={ref}
      detents={[size === 'large' ? 0.92 : 'auto']}
      cornerRadius={theme.radii.lg}
      backgroundColor={theme.colors.background}
      onDidDismiss={() => {
        presented.current = false;
        onClose();
      }}
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
