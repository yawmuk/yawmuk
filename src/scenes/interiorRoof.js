// Closed interior envelope: a solid roof visible from both sides, with warm ceiling details.
// The slab is also a cheap camera occluder, keeping the follow camera below the roof.
export function addInteriorRoof(THREE, group, { x0, x1, z0, z1, height, name, beams = false }) {
  group.userData.cameraRooms ||= [];
  group.userData.cameraRooms.push({ x0, x1, z0, z1, height });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(x1 - x0 + 0.16, 0.18, z1 - z0 + 0.16),
    new THREE.MeshStandardMaterial({ color: '#eee7d9', roughness: 0.9, side: THREE.DoubleSide })
  );
  roof.position.set((x0 + x1) / 2, height + 0.09, (z0 + z1) / 2);
  roof.name = `${name}:roof`;
  roof.castShadow = true;
  roof.receiveShadow = true;
  roof.userData.cameraCollide = true;
  group.add(roof);
  const material = new THREE.MeshStandardMaterial({ color: beams ? '#795b40' : '#d9cdb6', roughness: 0.85 });
  const geometry = new THREE.BoxGeometry(x1 - x0, 0.10, 0.12);
  const count = Math.max(2, Math.round((z1 - z0) / 3));
  const trims = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    matrix.makeTranslation((x0 + x1) / 2, height - 0.05, z0 + (i + 0.5) * (z1 - z0) / count);
    trims.setMatrixAt(i, matrix);
  }
  trims.instanceMatrix.needsUpdate = true;
  trims.computeBoundingSphere();
  trims.name = `${name}:ceiling-trim`;
  trims.userData.noCameraCollide = true;
  group.add(trims);
  return roof;
}
