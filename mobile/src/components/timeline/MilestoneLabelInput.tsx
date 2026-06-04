import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { TextInput } from '@/components/ui/TextInput';
import { colors, spacing, typography, radii } from '@/constants/theme';

interface Props {
  visible: boolean;
  date: string; // YYYY-MM-DD
  initialLabel: string;
  onSave: (label: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function MilestoneLabelInput({
  visible, date, initialLabel, onSave, onClear, onClose,
}: Props) {
  const [value, setValue] = useState(initialLabel);

  useEffect(() => { setValue(initialLabel); }, [initialLabel, visible]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0;

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Cột mốc ngày {date}</Text>
      <TextInput
        testID="label-input"
        value={value}
        onChangeText={setValue}
        placeholder="Ví dụ: 1 tháng tuổi, Sinh nhật…"
        maxLength={60}
      />
      <View style={styles.row}>
        {initialLabel.length > 0 && (
          <TouchableOpacity testID="label-clear" onPress={onClear} style={styles.clear}>
            <Text style={styles.clearText}>Xóa</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          testID="label-save"
          onPress={() => canSave && onSave(trimmed)}
          disabled={!canSave}
          style={[styles.save, !canSave && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>Lưu</Text>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  title:       { ...typography.title, color: colors.ink },
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  clear:       { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  clearText:   { ...typography.body, color: colors.pinkDeep },
  save:        { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'], backgroundColor: colors.pink, borderRadius: radii.md },
  saveDisabled:{ opacity: 0.5 },
  saveText:    { ...typography.body, color: colors.white, fontWeight: '700' },
});
