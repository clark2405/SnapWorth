import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View, type ImageSourcePropType } from 'react-native';

import {
  Avatar,
  BottomBar,
  Button,
  Field,
  NavHeader,
  PressableScale,
  Reveal,
  Screen,
  SWText,
  TextField,
  hideWebFocusOutline,
  typeStyle,
  useToast,
} from '../../components';
import { themedStyles, tokens, useTheme, useThemedStyles } from '../../design';
import { previewProfile } from '../preview/sample-data';

export interface EditProfileViewProps {
  readonly onBack?: () => void;
  /** Called once the changes are saved. */
  readonly onSaved?: () => void;
  /** Opens the photo picker for a new profile picture; resolves with nothing if cancelled. */
  readonly onPickPhoto?: () => Promise<ImageSourcePropType | null>;
}

const bioMaxLength = 160;
const handlePattern = /^[a-z0-9_]{3,20}$/;

/**
 * What buyers and voters see of you: your picture, name, handle, where you are and a line
 * about what you sell. Save is only offered once something has changed and it all checks out.
 */
export function EditProfileView({ onBack, onSaved, onPickPhoto }: EditProfileViewProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(stylesFor);
  const toast = useToast();
  const [avatar, setAvatar] = useState<ImageSourcePropType>(previewProfile.user.avatar);
  const [name, setName] = useState<string>(previewProfile.displayName);
  const [handle, setHandle] = useState<string>(previewProfile.user.handle);
  const [location, setLocation] = useState<string>(previewProfile.location);
  const [bio, setBio] = useState<string>(previewProfile.bio);
  const [saving, setSaving] = useState(false);

  const handleOk = handlePattern.test(handle);
  const changed =
    avatar !== previewProfile.user.avatar ||
    name.trim() !== previewProfile.displayName ||
    handle !== previewProfile.user.handle ||
    location.trim() !== previewProfile.location ||
    bio.trim() !== previewProfile.bio;
  const canSave = changed && name.trim().length > 0 && handleOk && !saving;

  const pickPhoto = async () => {
    if (!onPickPhoto) return;
    try {
      const picked = await onPickPhoto();
      if (picked) setAvatar(picked);
    } catch {
      // Backing out of the picker keeps the current picture.
    }
  };

  // Preview wiring: there is no profile service yet, so saving confirms and goes back.
  const save = () => {
    if (!canSave) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.show({ title: 'Profile updated' });
      onSaved?.();
    }, 600);
  };

  return (
    <Screen
      header={<NavHeader title="Edit profile" onBack={onBack} banded />}
      footer={
        <BottomBar>
          <Button label="Save" disabled={!canSave} loading={saving} onPress={save} />
        </BottomBar>
      }
      contentStyle={styles.content}
    >
      <Reveal index={0} style={styles.photoBlock}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          haptic="select"
          disabled={!onPickPhoto}
          onPress={() => void pickPhoto()}
          style={styles.photoButton}
        >
          <Avatar source={avatar} name={handle} size={96} ring />
          <View style={styles.camera}>
            <Camera size={15} strokeWidth={2.2} color={colors.onAccent} />
          </View>
        </PressableScale>
        <SWText variant="labelSmall" tone="accent">
          Change photo
        </SWText>
      </Reveal>

      <Reveal index={1} style={styles.fields}>
        <Field label="Name">
          <TextField
            value={name}
            onChangeText={setName}
            autoComplete="name"
            textContentType="name"
            maxLength={40}
            accessibilityLabel="Name"
          />
        </Field>
        <Field
          label="Username"
          helper={
            handleOk
              ? 'Shown on your posts, listings and votes.'
              : '3 to 20 lowercase letters, numbers or underscores.'
          }
        >
          <TextField
            prefix="@"
            value={handle}
            onChangeText={(text) => setHandle(text.toLowerCase().replace(/\s/g, ''))}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            maxLength={20}
            accessibilityLabel="Username"
          />
        </Field>
        <Field label="Location" helper="Helps buyers nearby find your listings.">
          <TextField
            value={location}
            onChangeText={setLocation}
            textContentType="addressCity"
            maxLength={60}
            accessibilityLabel="Location"
          />
        </Field>
        <Field label="About you" helper={`${bio.trim().length}/${bioMaxLength}`}>
          <TextInput
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={bioMaxLength}
            placeholder="What you collect, what you sell"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            accessibilityLabel="About you"
            style={[
              styles.bio,
              typeStyle('bodyLarge'),
              { color: colors.textPrimary, lineHeight: undefined },
              hideWebFocusOutline,
            ]}
          />
        </Field>
      </Reveal>
    </Screen>
  );
}

const stylesFor = themedStyles((colors) => ({
  content: {
    paddingTop: tokens.spacing[4],
    gap: tokens.spacing[8],
  },
  photoBlock: {
    alignItems: 'center',
    gap: tokens.spacing[2],
  },
  photoButton: {
    borderRadius: tokens.radius.full,
  },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: tokens.border.focus,
    borderColor: colors.canvas,
  },
  fields: {
    gap: tokens.spacing[5],
  },
  bio: {
    minHeight: 96,
    padding: tokens.spacing[4],
    borderRadius: tokens.radius.large,
    backgroundColor: colors.surface,
    borderWidth: tokens.border.hairline,
    borderColor: colors.borderSubtle,
    textAlignVertical: 'top',
  },
}));
