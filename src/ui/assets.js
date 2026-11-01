export function loadImages() {
  const cover = new Image();
  const icon = new Image();
  cover.src = "assets/cover.jpg";
  icon.src = "assets/icon.jpg";
  return { cover, icon };
}
