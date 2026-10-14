import { type ArcadeAvatarProps, useArcadeHost } from '../host.js';

export function ArcadeAvatar(props: ArcadeAvatarProps) {
  const { Avatar } = useArcadeHost();
  return <Avatar {...props} />;
}
