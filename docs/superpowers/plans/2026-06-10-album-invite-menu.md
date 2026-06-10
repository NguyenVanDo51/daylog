# Album Detail Invite Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DotsThree menu button to the album detail header that opens a bottom sheet with three options: view members, invite via link, and scan QR — wiring up the already-built `InviteSheet`, `QRSheet`, and `MemberList` components.

**Architecture:** A new `AlbumMenuSheet` component lists the three actions; tapping any item closes the menu and opens the relevant sheet. A new `MembersSheet` wraps `MemberList` in a `SheetModal`. `AlbumScreen` holds four boolean state flags (menu, invite, qr, members) and renders all four sheets.

**Tech Stack:** React Native, Expo Router, TypeScript, phosphor-react-native, @lodev09/react-native-true-sheet, @tanstack/react-query, i18n-js, Jest + @testing-library/react-native

---

### Task 1: Add i18n keys

**Files:**
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Add `album_menu` block to `vi.ts`**

  In `mobile/src/locales/vi.ts`, add after the `manage` block (before the closing `};`):

  ```ts
  album_menu: {
    members:       'Thành viên',
    invite:        'Mời thành viên',
    scan_qr:       'Quét mã QR',
    members_title: 'Thành viên',
  },
  ```

- [ ] **Step 2: Add `album_menu` block to `en.ts`**

  In `mobile/src/locales/en.ts`, add after the `manage` block (before the closing `};`):

  ```ts
  album_menu: {
    members:       'Members',
    invite:        'Invite members',
    scan_qr:       'Scan QR code',
    members_title: 'Members',
  },
  ```

- [ ] **Step 3: Verify i18n test still passes**

  ```bash
  cd mobile && npx jest src/lib/__tests__/i18n.test.ts --no-coverage
  ```

  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add mobile/src/locales/vi.ts mobile/src/locales/en.ts
  git commit -m "feat: add album_menu i18n keys"
  ```

---

### Task 2: Create MembersSheet

**Files:**
- Create: `mobile/src/components/family/MembersSheet.tsx`
- Create: `mobile/src/components/family/MembersSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

  Create `mobile/src/components/family/MembersSheet.test.tsx`:

  ```tsx
  jest.mock('@/hooks/useMembers', () => ({
    useMembers: jest.fn(),
  }));
  jest.mock('@/stores/albumStore', () => ({
    useAlbumStore: jest.fn(),
  }));

  import React from 'react';
  import { render } from '@testing-library/react-native';
  import { MembersSheet } from '@/components/family/MembersSheet';
  import { useMembers } from '@/hooks/useMembers';
  import type { Member } from '@/hooks/useMembers';

  const mockUseMembers = useMembers as jest.MockedFunction<typeof useMembers>;

  const members: Member[] = [
    { id: 'm-1', display_name: 'Alice Admin', avatar_url: null, role: 'admin', joined_at: '2025-01-15T00:00:00.000Z' },
    { id: 'm-2', display_name: 'Bob Member', avatar_url: null, role: 'member', joined_at: '2025-02-20T00:00:00.000Z' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMembers.mockReturnValue({ data: members } as ReturnType<typeof useMembers>);
  });

  describe('MembersSheet', () => {
    it('renders a heading and all member display names when visible', () => {
      const { getByText } = render(<MembersSheet visible={true} onClose={jest.fn()} />);
      expect(getByText('Thành viên')).toBeTruthy();
      expect(getByText('Alice Admin')).toBeTruthy();
      expect(getByText('Bob Member')).toBeTruthy();
    });

    it('renders no members when data is undefined', () => {
      mockUseMembers.mockReturnValue({ data: undefined } as ReturnType<typeof useMembers>);
      const { queryByText } = render(<MembersSheet visible={true} onClose={jest.fn()} />);
      expect(queryByText('Alice Admin')).toBeNull();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd mobile && npx jest src/components/family/MembersSheet.test.tsx --no-coverage
  ```

  Expected: FAIL with "Cannot find module '@/components/family/MembersSheet'"

- [ ] **Step 3: Create MembersSheet component**

  Create `mobile/src/components/family/MembersSheet.tsx`:

  ```tsx
  import React from 'react';
  import { Text, StyleSheet } from 'react-native';
  import { SheetModal } from '@/components/ui/SheetModal';
  import { MemberList } from '@/components/family/MemberList';
  import { useMembers } from '@/hooks/useMembers';
  import { colors, typography } from '@/constants/theme';
  import { t } from '@/lib/i18n';

  interface MembersSheetProps {
    visible: boolean;
    onClose: () => void;
  }

  export function MembersSheet({ visible, onClose }: MembersSheetProps) {
    const { data: members = [] } = useMembers();
    return (
      <SheetModal visible={visible} onClose={onClose} size="large">
        <Text style={styles.heading}>{t('album_menu.members_title')}</Text>
        <MemberList members={members} />
      </SheetModal>
    );
  }

  const styles = StyleSheet.create({
    heading: { ...typography.heading, color: colors.ink },
  });
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd mobile && npx jest src/components/family/MembersSheet.test.tsx --no-coverage
  ```

  Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add mobile/src/components/family/MembersSheet.tsx mobile/src/components/family/MembersSheet.test.tsx
  git commit -m "feat: add MembersSheet component"
  ```

---

### Task 3: Create AlbumMenuSheet

**Files:**
- Create: `mobile/src/components/family/AlbumMenuSheet.tsx`
- Create: `mobile/src/components/family/AlbumMenuSheet.test.tsx`

- [ ] **Step 1: Write the failing test**

  Create `mobile/src/components/family/AlbumMenuSheet.test.tsx`:

  ```tsx
  import React from 'react';
  import { fireEvent, render } from '@testing-library/react-native';
  import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onOpenMembers: jest.fn(),
    onOpenInvite: jest.fn(),
    onOpenQR: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  describe('AlbumMenuSheet', () => {
    it('renders all three menu row labels', () => {
      const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
      expect(getByText('Thành viên')).toBeTruthy();
      expect(getByText('Mời thành viên')).toBeTruthy();
      expect(getByText('Quét mã QR')).toBeTruthy();
    });

    it('calls onOpenMembers when Thành viên row is pressed', () => {
      const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
      fireEvent.press(getByText('Thành viên'));
      expect(defaultProps.onOpenMembers).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenInvite when Mời thành viên row is pressed', () => {
      const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
      fireEvent.press(getByText('Mời thành viên'));
      expect(defaultProps.onOpenInvite).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenQR when Quét mã QR row is pressed', () => {
      const { getByText } = render(<AlbumMenuSheet {...defaultProps} />);
      fireEvent.press(getByText('Quét mã QR'));
      expect(defaultProps.onOpenQR).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd mobile && npx jest src/components/family/AlbumMenuSheet.test.tsx --no-coverage
  ```

  Expected: FAIL with "Cannot find module '@/components/family/AlbumMenuSheet'"

- [ ] **Step 3: Create AlbumMenuSheet component**

  Create `mobile/src/components/family/AlbumMenuSheet.tsx`:

  ```tsx
  import React from 'react';
  import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
  import { UsersThree, UserPlus, QrCode } from 'phosphor-react-native';
  import { SheetModal } from '@/components/ui/SheetModal';
  import { colors, spacing, typography } from '@/constants/theme';
  import { t } from '@/lib/i18n';

  interface AlbumMenuSheetProps {
    visible: boolean;
    onClose: () => void;
    onOpenMembers: () => void;
    onOpenInvite: () => void;
    onOpenQR: () => void;
  }

  export function AlbumMenuSheet({ visible, onClose, onOpenMembers, onOpenInvite, onOpenQR }: AlbumMenuSheetProps) {
    return (
      <SheetModal visible={visible} onClose={onClose}>
        <MenuItem icon={<UsersThree size={22} color={colors.ink} />} label={t('album_menu.members')} onPress={onOpenMembers} />
        <MenuItem icon={<UserPlus size={22} color={colors.ink} />} label={t('album_menu.invite')}   onPress={onOpenInvite} />
        <MenuItem icon={<QrCode    size={22} color={colors.ink} />} label={t('album_menu.scan_qr')} onPress={onOpenQR} />
      </SheetModal>
    );
  }

  function MenuItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        {icon}
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    );
  }

  const styles = StyleSheet.create({
    row:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    label: { ...typography.body, color: colors.ink },
  });
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  cd mobile && npx jest src/components/family/AlbumMenuSheet.test.tsx --no-coverage
  ```

  Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add mobile/src/components/family/AlbumMenuSheet.tsx mobile/src/components/family/AlbumMenuSheet.test.tsx
  git commit -m "feat: add AlbumMenuSheet component"
  ```

---

### Task 4: Wire menu into AlbumScreen

**Files:**
- Modify: `mobile/app/albums/[id].tsx`

- [ ] **Step 1: Update imports**

  Replace the import block at the top of `mobile/app/albums/[id].tsx` with:

  ```tsx
  import React, { useState } from 'react';
  import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { CaretLeft, DotsThree } from 'phosphor-react-native';
  import { router } from 'expo-router';
  import { DayCell } from '@/components/album/DayCell';
  import { useAlbumDays, AlbumDay } from '@/hooks/useAlbumDays';
  import { useAlbumStore } from '@/stores/albumStore';
  import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
  import { InviteSheet } from '@/components/family/InviteSheet';
  import { QRSheet } from '@/components/family/QRSheet';
  import { MembersSheet } from '@/components/family/MembersSheet';
  import { colors, spacing, typography } from '@/constants/theme';
  ```

- [ ] **Step 2: Add state flags**

  Inside `AlbumScreen`, after the existing `const { data: days, isLoading }` line, add:

  ```tsx
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [qrOpen,      setQrOpen]      = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  ```

- [ ] **Step 3: Replace right-side spacer with DotsThree button**

  In the header, replace:

  ```tsx
  <View style={styles.backBtn} />
  ```

  with:

  ```tsx
  <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.backBtn}>
    <DotsThree size={24} color={colors.ink} />
  </TouchableOpacity>
  ```

- [ ] **Step 4: Render sheets before the closing `</View>`**

  Add these four components just before the closing `</View>` of the outermost container (after the `FlatList` / loading / empty block):

  ```tsx
  <AlbumMenuSheet
    visible={menuOpen}
    onClose={() => setMenuOpen(false)}
    onOpenMembers={() => { setMenuOpen(false); setMembersOpen(true); }}
    onOpenInvite={() =>  { setMenuOpen(false); setInviteOpen(true); }}
    onOpenQR={() =>      { setMenuOpen(false); setQrOpen(true); }}
  />
  <InviteSheet  visible={inviteOpen}  onClose={() => setInviteOpen(false)} />
  <QRSheet      visible={qrOpen}      onClose={() => setQrOpen(false)} />
  <MembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} />
  ```

- [ ] **Step 5: Run the full family component test suite**

  ```bash
  cd mobile && npx jest src/components/family/ --no-coverage
  ```

  Expected: All tests PASS (existing InviteSheet, QRSheet, MemberList tests plus new AlbumMenuSheet and MembersSheet tests)

- [ ] **Step 6: Commit**

  ```bash
  git add mobile/app/albums/[id].tsx
  git commit -m "feat: wire invite menu into album detail screen"
  ```
