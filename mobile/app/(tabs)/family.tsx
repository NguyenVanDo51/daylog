import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';
export default function FamilyTab() {
  return <View style={styles.c}><Text style={typography.heading}>Family</Text></View>;
}
const styles = StyleSheet.create({ c: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' } });
