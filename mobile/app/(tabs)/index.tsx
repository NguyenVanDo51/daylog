import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { CameraPage } from '@/components/tabs/CameraPage';
import { AlbumsPage } from '@/components/tabs/AlbumsPage';
import { CustomTabBar } from '@/components/tabs/CustomTabBar';

export default function MainScreen() {
  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(1);

  const handleTabPress = (i: number) => pagerRef.current?.setPage(i);

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={1}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        <View key="0" style={styles.page}>
          <CameraPage onTabPress={handleTabPress} />
        </View>
        <View key="1" style={styles.page}>
          <AlbumsPage />
        </View>
      </PagerView>
      {activePage !== 0 && (
        <CustomTabBar activePage={activePage} onTabPress={handleTabPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  pager: { flex: 1 },
  page:  { flex: 1 },
});
