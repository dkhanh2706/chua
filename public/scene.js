// Điểm vào đồ họa 3D của Chùa Online.
// Mô hình nam/nữ và khớp nối: avatar-model.mjs.
// Màn xem xoay 360°: avatar-studio.mjs. Cảnh/camera: scene3d.js.
export { TempleView } from './scene3d.js';
export { createAvatar,poseAvatar,disposeAvatar,drawPortrait } from './avatar-model.mjs';
export { AvatarStudio } from './avatar-studio.mjs';