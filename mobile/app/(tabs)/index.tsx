import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography } from '@/constants/theme';
export default function HomeTab() {
  return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><Text style={typography.heading}>Home</Text></View>;
}
