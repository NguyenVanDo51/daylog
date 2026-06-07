import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { CameraPage } from '@/components/tabs/CameraPage';
import { AlbumsPage } from '@/components/tabs/AlbumsPage';

export default function MainScreen() {
  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(1);

  const goToPage = (i: number) => pagerRef.current?.setPage(i);

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={1}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        <View key="0" style={styles.page}>
          <CameraPage onTabPress={goToPage} />
        </View>
        <View key="1" style={styles.page}>
          <AlbumsPage onCameraPress={() => goToPage(0)} />
        </View>
      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  pager: { flex: 1 },
  page:  { flex: 1 },
});
