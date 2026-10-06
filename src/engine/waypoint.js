// Journey waypoint in the hub: a glowing chevron on the ground in front of Adam that points at the planned next door.
import * as THREE from 'three';

export function createWaypoint(scene) {
  const shape = new THREE.Shape();
  // arrow in the XY plane pointing +Y (rotated flat below so it points -Z = yaw 0)
  shape.moveTo(0, 0.55); shape.lineTo(0.42, -0.05); shape.lineTo(0.17, -0.05); shape.lineTo(0.17, -0.45);
  shape.lineTo(-0.17, -0.45); shape.lineTo(-0.17, -0.05); shape.lineTo(-0.42, -0.05); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const arrow = new THREE.Mesh(geo, mat);
  arrow.name = 'waypoint';
  arrow.renderOrder = 5;
  arrow.userData.noCameraCollide = true;
  arrow.visible = false;
  scene.add(arrow);
  let target = null;

  return {
    /** target: [x, y, z] | null */
    set(pos) { target = Array.isArray(pos) ? pos : null; if (!target) arrow.visible = false; },
    get target() { return target; },
    update(playerPos, t) {
      if (!target) return;
      const dx = target[0] - playerPos.x, dz = target[2] - playerPos.z;
      const d = Math.hypot(dx, dz);
      arrow.visible = d > 3;
      if (!arrow.visible) return;
      const k = 1.25 + Math.sin(t * 3) * 0.12;
      arrow.position.set(playerPos.x + (dx / d) * k, 0.07, playerPos.z + (dz / d) * k);
      arrow.rotation.y = Math.atan2(-dx, -dz);
      mat.opacity = 0.65 + Math.sin(t * 3) * 0.2;
    },
    dispose() { scene.remove(arrow); geo.dispose(); mat.dispose(); }
  };
}
