/** Encode user-provided topic text so braces cannot override the intended Redis Cluster hash tag. */
export function roomKeys(prefix: string, topic: string) {
  const tag = `{${encodeURIComponent(topic)}}`;
  return [
    `${prefix}room:${tag}`,
    `${prefix}presence:${tag}`,
    `${prefix}expiry:${tag}`,
    `${prefix}changes:${tag}`,
    `${prefix}tick:${tag}`,
  ];
}
