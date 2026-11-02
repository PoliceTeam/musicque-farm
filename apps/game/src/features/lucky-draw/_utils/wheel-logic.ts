/** Place the winning sector's center under the fixed pointer after six full revolutions. */
export function nextWheelRotation(current: number, prizeIndex: number, count: number) {
  const target = (360 - (prizeIndex + 0.5) * (360 / count)) % 360;
  return current + 2160 + ((target - (current % 360) + 360) % 360);
}

/** Vẽ đúng số ô thưởng, giữ nguyên viền ảnh vòng quay. */
export function wheelSectorBackground(count: number) {
  const colors = ['#20d5e9', '#a6bafa', '#a4ed73', '#cc6bee', '#78d497', '#fa929b', '#f7e55f', '#f785d0'];
  const step = 360 / count;
  return `conic-gradient(${Array.from({ length: count }, (_, index) => {
    const start = index * step;
    const end = (index + 1) * step;
    return `#fff ${start}deg ${start + 0.6}deg, ${colors[index % colors.length]} ${start + 0.6}deg ${end - 0.6}deg, #fff ${end - 0.6}deg ${end}deg`;
  }).join(', ')})`;
}
