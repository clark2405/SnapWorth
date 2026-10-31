import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
import { avatarSourceFor, updateUserProfile, useUserProfile } from './userProfile';

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
  const { profile, refresh } = useUserProfile();

  const [avatar, setAvatar] = useState<ImageSourcePropType>(() =>
    avatarSourceFor(profile.avatarUrl),
  );
  const [name, setName] = useState<string>(profile.displayName);
  const [handle, setHandle] = useState<string>(profile.handle);
  const [location, setLocation] = useState<string>(profile.location);
  const [bio, setBio] = useState<string>(profile.bio);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && profile) {
      setName(profile.displayName);
      setHandle(profile.handle);
      setLocation(profile.location);
      setBio(profile.bio);
      setAvatar(avatarSourceFor(profile.avatarUrl));
    }
  }, [profile, touched]);

  const handleOk = handlePattern.test(handle);
  const initialAvatar = avatarSourceFor(profile.avatarUrl);
  const changed =
    avatar !== initialAvatar ||
    name.trim() !== profile.displayName ||
    handle !== profile.handle ||
    location.trim() !== profile.location ||
    bio.trim() !== profile.bio;
  const canSave = changed && name.trim().length > 0 && handleOk && !saving;

  const pickPhoto = async () => {
    if (!onPickPhoto) return;
    try {
      const picked = await onPickPhoto();
      if (picked) {
        setAvatar(picked);
        setTouched(true);
      }
    } catch {
      // Backing out of the picker keeps the current picture.
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const avatarUrl =
        typeof avatar === 'object' && avatar !== null && 'uri' in avatar
          ? (avatar as { uri: string }).uri
          : undefined;

      const res = await updateUserProfile({
        displayName: name.trim(),
        handle: handle.trim(),
        location: location.trim(),
        bio: bio.trim(),
        avatarUrl,
      });

      if (!res.success) {
        setSaving(false);
        toast.show({ title: 'Update failed', body: res.error || 'Failed to update profile' });
        return;
      }

      await refresh();
      setSaving(false);
      toast.show({ title: 'Profile updated' });
      onSaved?.();
    } catch (err) {
      setSaving(false);
      toast.show({
        title: 'Update failed',
        body: err instanceof Error ? err.message : 'Failed to update profile',
      });
    }
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
            onChangeText={(text) => {
              setTouched(true);
              setName(text);
            }}
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
            onChangeText={(text) => {
              setTouched(true);
              setHandle(text.toLowerCase().replace(/\s/g, ''));
            }}
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
            onChangeText={(text) => {
              setTouched(true);
              setLocation(text);
            }}
            textContentType="addressCity"
            maxLength={60}
            accessibilityLabel="Location"
          />
        </Field>
        <Field label="About you" helper={`${bio.trim().length}/${bioMaxLength}`}>
          <TextInput
            value={bio}
            onChangeText={(text) => {
              setTouched(true);
              setBio(text);
            }}
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
