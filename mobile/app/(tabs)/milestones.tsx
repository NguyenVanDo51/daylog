import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';
export default function MilestonesTab() {
  return <View style={styles.c}><Text style={typography.heading}>Moments</Text></View>;
}
const styles = StyleSheet.create({ c: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' } });
