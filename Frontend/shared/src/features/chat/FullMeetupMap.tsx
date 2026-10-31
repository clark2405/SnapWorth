import { Modal, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SWText, TextField } from '../../components';
import { themedStyles, tokens, useThemedStyles } from '../../design';
import type { Camera } from './meetup-map-geo';
import { MeetupPicker, placingZoom } from './MeetupPicker';
import type { FoundPlace } from './place-search';
import { PlaceSearch } from './PlaceSearch';

/**
 * The meetup map, full screen, for when the sheet's map is too small to find the spot. It's the
 * same map: the pin, the name and the search carry over both ways, and "Use this spot" goes back
 * to the sheet with them.
 */
export function FullMeetupMap({
  visible,
  camera,
  name,
  onCameraChange,
  onNameChange,
  onPick,
  onClose,
}: {
  readonly visible: boolean;
  readonly camera: Camera;
  readonly name: string;
  readonly onCameraChange: (camera: Camera) => void;
  readonly onNameChange: (name: string) => void;
  readonly onPick: (place: FoundPlace) => void;
  readonly onClose: () => void;
}) {
  const styles = useThemedStyles(stylesFor);
  const insets = useSafeAreaInsets();
  const placed = camera.zoom >= placingZoom;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A modal is a window of its own, so it needs its own root for the map's gestures. */}
      <GestureHandlerRootView style={styles.root}>
        <View
          style={[
            styles.page,
            {
              paddingTop: insets.top + tokens.spacing[2],
              paddingBottom: insets.bottom + tokens.spacing[3],
            },
          ]}
        >
          <SWText variant="headingLarge" accessibilityRole="header">
            Where to meet
          </SWText>
          <PlaceSearch onPick={onPick} />
          <MeetupPicker
            camera={camera}
            onCameraChange={onCameraChange}
            label={name.trim() || undefined}
            accessibilityLabel="Map for choosing where to meet, full screen"
            onToggleSize={onClose}
            expanded
          />
          <TextField
            value={name}
            onChangeText={onNameChange}
            placeholder="Name the spot, e.g. Jollibee by the main entrance"
            accessibilityLabel="Name the spot"
            maxLength={120}
            returnKeyType="done"
          />
          <Button
            label={placed ? 'Use this spot' : 'Zoom in to place the pin'}
            haptic="pop"
            disabled={!placed}
            onPress={onClose}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const stylesFor = themedStyles((colors) => ({
  root: {
    flex: 1,
  },
  page: {
    flex: 1,
    gap: tokens.spacing[3],
    paddingHorizontal: tokens.layout.pageGutterCompact,
    backgroundColor: colors.canvas,
  },
}));
