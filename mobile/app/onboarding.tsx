import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import PagerView from 'react-native-pager-view';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { useOnboardingStore } from '@/stores/onboardingStore';

const ONBOARDING_KEY = 'onboarding.seen';
const PAGES = 4;

interface PageProps {
  index: number;
  total: number;
  title: string;
  body: string;
  hero: React.ReactNode;
}

function Page({ title, body, hero }: PageProps) {
  return (
    <View style={styles.page}>
      <View style={styles.heroArea}>{hero}</View>
      <View style={styles.textArea}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<PagerView>(null);
  const [active, setActive] = useState(0);
  const setSeen = useOnboardingStore((s) => s.setSeen);

  async function finish() {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    setSeen(true);
    router.replace('/(auth)');
  }

  function goNext() {
    if (active >= PAGES - 1) {
      finish();
      return;
    }
    pagerRef.current?.setPage(active + 1);
  }

  const isLast = active === PAGES - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <TouchableOpacity
        testID="onboarding-skip"
        onPress={finish}
        style={[styles.skip, { top: insets.top + spacing.md }]}
        hitSlop={12}
      >
        <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
      </TouchableOpacity>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActive(e.nativeEvent.position)}
      >
        <View key="0" style={styles.pageWrap}>
          <Page
            index={0}
            total={PAGES}
            title={t('onboarding.p1_title')}
            body={t('onboarding.p1_body')}
            hero={<HeroWelcome />}
          />
        </View>
        <View key="1" style={styles.pageWrap}>
          <Page
            index={1}
            total={PAGES}
            title={t('onboarding.p2_title')}
            body={t('onboarding.p2_body')}
            hero={<HeroCapture />}
          />
        </View>
        <View key="2" style={styles.pageWrap}>
          <Page
            index={2}
            total={PAGES}
            title={t('onboarding.p3_title')}
            body={t('onboarding.p3_body')}
            hero={<HeroStory />}
          />
        </View>
        <View key="3" style={styles.pageWrap}>
          <Page
            index={3}
            total={PAGES}
            title={t('onboarding.p4_title')}
            body={t('onboarding.p4_body')}
            hero={<HeroFamily />}
          />
        </View>
      </PagerView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {Array.from({ length: PAGES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === active && styles.dotActive,
              ]}
            />
          ))}
        </View>
        <StickerButton
          testID={isLast ? 'onboarding-start' : 'onboarding-next'}
          label={isLast ? t('onboarding.start') : t('onboarding.next')}
          variant="primary"
          shadow="heavy"
          fullWidth={isLast}
          onPress={goNext}
        />
      </View>
    </View>
  );
}

// Hero illustrations ---------------------------------------------------------

function HeroWelcome() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.speechWrap}>
        <StickerCard style={styles.speech}>
          <Text style={styles.speechText}>{t('onboarding.p1_speech')}</Text>
        </StickerCard>
      </View>
      <Mascot size={130} tilt="playful" flip />
    </View>
  );
}

function HeroCapture() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.captureScene}>
        <Mascot size={90} tilt="default" />
        <View style={styles.miniCamera} />
      </View>
      <View style={styles.captureChips}>
        <StickerChip label={t('onboarding.p2_chip_tap')} variant="white" tilt="default" flip />
        <StickerChip label={t('onboarding.p2_chip_hold')} variant="mint" tilt="default" />
      </View>
    </View>
  );
}

function HeroStory() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.storyScene}>
        <View style={styles.miniPhone}>
          <View style={styles.miniProgress}>
            <View style={styles.miniProgressFill} />
          </View>
        </View>
        <View style={styles.playArrow}>
          <Text style={styles.playArrowText}>▶</Text>
        </View>
        <Mascot size={70} tilt="playful" flip />
      </View>
    </View>
  );
}

function HeroFamily() {
  return (
    <View style={styles.heroBox}>
      <View style={styles.familyScene}>
        <View style={styles.heartFloat}><Text style={styles.heartText}>💛</Text></View>
        <View style={styles.heartFloat2}><Text style={styles.heartText}>💖</Text></View>
        <Mascot size={80} tilt="default" flip />
        <View style={styles.smallMascot}><Mascot size={70} tilt="subtle" /></View>
        <View style={styles.smallerMascot}><Mascot size={60} tilt="default" flip /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  pager:        { flex: 1 },
  pageWrap:     { flex: 1 },
  page:         { flex: 1, alignItems: 'center', paddingHorizontal: spacing['2xl'], paddingTop: spacing['4xl'] },
  heroArea:     { height: 260, justifyContent: 'center', alignItems: 'center', marginTop: spacing['2xl'] },
  textArea:     { marginTop: spacing['3xl'], alignItems: 'center', gap: spacing.md },
  title:        { ...typography.displayCute, textAlign: 'center' },
  body:         { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 22 },

  skip:         { position: 'absolute', right: spacing.xl, zIndex: 10 },
  skipText:     { ...typography.body, color: theme.colors.textMuted, fontFamily: theme.fonts.semiBold },

  bottom:       { paddingHorizontal: spacing['2xl'], gap: spacing.lg, alignItems: 'center' },
  dots:         { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot:          { width: 8, height: 8, borderRadius: 4, borderWidth: theme.border.thin, borderColor: theme.colors.border, opacity: 0.4 },
  dotActive:    { width: 22, opacity: 1, backgroundColor: theme.colors.primary },

  // Hero shared
  heroBox:      { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },

  // Page 1 (Welcome)
  speechWrap:   { position: 'absolute', top: 30, left: 24 },
  speech:       { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: theme.radii.lg },
  speechText:   { ...typography.body, fontFamily: theme.fonts.bold, color: theme.colors.textPrimary },

  // Page 2 (Capture)
  captureScene: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  miniCamera:   { width: 56, height: 72, borderRadius: theme.radii.md, backgroundColor: theme.colors.textPrimary, borderWidth: theme.border.thick, borderColor: theme.colors.border, ...theme.shadows.sticker, transform: [{ rotate: '8deg' }] },
  captureChips: { position: 'absolute', bottom: 0, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  // Page 3 (Story)
  storyScene:   { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, position: 'relative' },
  miniPhone:    { width: 100, height: 160, backgroundColor: theme.colors.primary, borderWidth: theme.border.thick, borderColor: theme.colors.border, borderRadius: theme.radii.md, ...theme.shadows.stickerHeavy, padding: spacing.sm },
  miniProgress: { height: 4, backgroundColor: theme.overlays.scrim, borderRadius: theme.radii.pill, overflow: 'hidden' },
  miniProgressFill: { width: '60%', height: '100%', backgroundColor: theme.colors.accent1, borderRadius: theme.radii.pill },
  playArrow:    { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.accent1, borderWidth: theme.border.medium, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', ...theme.shadows.sticker },
  playArrowText:{ ...typography.body, color: theme.colors.textPrimary, fontFamily: theme.fonts.bold },

  // Page 4 (Family)
  familyScene:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, position: 'relative' },
  smallMascot:  { marginBottom: spacing.sm },
  smallerMascot:{ marginBottom: spacing.md },
  heartFloat:   { position: 'absolute', top: -20, left: 20 },
  heartFloat2:  { position: 'absolute', top: -10, right: 20 },
  heartText:    { fontSize: 22 },
});
