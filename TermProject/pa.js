import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ─── 렌더러 ───────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ─── 씬 ──────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a2a4a);
scene.fog = new THREE.FogExp2(0x0a2a4a, 0.003);

// ─── 카메라 ───────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 80, 300);

// ─── 오비트 컨트롤 (개발용) ───────────────────────────
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enabled = false;
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;

// ─── 모드 ────────────────────────────────────────────
let isOrbitMode = false;

// ─── 플레이어 상태 ────────────────────────────────────
let yaw = Math.PI, pitch = 0;
const playerPos = new THREE.Vector3(0, 50, 0);

// 관성 속도 벡터 (서브나우티카 스타일 부드러운 가속/감속)
const playerVel = new THREE.Vector3();
const ACCEL     = 0.18;  // 가속도 lerp 계수
const FRICTION  = 0.88;  // 프레임당 감속 계수

// ─── 단계별 카메라 거리/높이 ──────────────────────────
const CAM_CONFIG = {
    2: { dist: 40,  height: 12 },
    3: { dist: 50,  height: 15 },
    4: { dist: 65,  height: 18 },
    5: { dist: 80,  height: 22 },
    6: { dist: 95,  height: 26 },
    7: { dist: 110, height: 30 },
    8: { dist: 200, height: 55 },
};
const getCamDist   = () => CAM_CONFIG[playerStage]?.dist   ?? 40;
const getCamHeight = () => CAM_CONFIG[playerStage]?.height ?? 12;

// ─── 키 입력 ─────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'KeyR' && isDead) respawn();

    // ── 개발용 키 (주석 처리) ──────────────────────────
    // if (e.code === 'KeyH') {
    //     helpersVisible = !helpersVisible;
    //     helpers.forEach(h => h.visible = helpersVisible);
    // }
    // if (e.code === 'Space') { pitch = 0; yaw = Math.PI; }
    // if (e.code === 'KeyP') {
    //     isOrbitMode = !isOrbitMode;
    //     if (isOrbitMode) {
    //         document.exitPointerLock();
    //         orbitControls.enabled = true;
    //         orbitControls.target.copy(playerPos);
    //         camera.position.set(playerPos.x, playerPos.y + 200, playerPos.z + 200);
    //         orbitControls.update();
    //     } else {
    //         orbitControls.enabled = false;
    //     }
    // }

    // ─── 개발용: 2~8 키로 단계 즉시 변경 (주석 처리) ──
    // const stageKey = { 'Digit2':2, 'Digit3':3, 'Digit4':4, 'Digit5':5, 'Digit6':6, 'Digit7':7, 'Digit8':8 };
    // if (stageKey[e.code] !== undefined) {
    //     playerStage = stageKey[e.code];
    //     gauge = 0;
    //     loadPlayerModel(playerStage);
    //     document.getElementById('hud-stage').textContent =
    //         playerStage >= 8 ? 'Stage 8 (MAX)' : `Stage ${playerStage}`;
    //     updateGaugeUI();
    //     if (playerStage >= 5 && !flockedStages.has(playerStage)) {
    //         flockedStages.add(playerStage);
    //         if (flockActive) removeFlock();
    //         spawnFlock();
    //     }
    // }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ─── 마우스 시점 ──────────────────────────────────────
renderer.domElement.addEventListener('click', () => {
    if (!isOrbitMode) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onPointerMove);
    } else {
        document.removeEventListener('mousemove', onPointerMove);
    }
});
function onPointerMove(e) {
    if (isOrbitMode) return;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
}

// ─── 조명 ────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x1a4a7a, 3.0));

const dirLight = new THREE.DirectionalLight(0xfff5cc, 3.0);
dirLight.position.set(0, 800, 0);
dirLight.castShadow = true;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 2000;
dirLight.shadow.camera.left = -800;
dirLight.shadow.camera.right = 800;
dirLight.shadow.camera.top = 800;
dirLight.shadow.camera.bottom = -800;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

const fillLight = new THREE.PointLight(0x2266aa, 1.5, 600);
fillLight.position.set(0, 150, 200);
scene.add(fillLight);

// ─── 태양 구 ──────────────────────────────────────────
const sunGeo = new THREE.SphereGeometry(40, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffaaa });
const sun = new THREE.Mesh(sunGeo, sunMat);
sun.position.set(0, 800, 0);
scene.add(sun);

const glowGeo = new THREE.SphereGeometry(70, 32, 32);
const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffffcc, transparent: true, opacity: 0.15, side: THREE.BackSide,
});
const sunGlow = new THREE.Mesh(glowGeo, glowMat);
sunGlow.position.copy(sun.position);
scene.add(sunGlow);

// ─── 헬퍼 (개발용 — 주석 처리) ───────────────────────
// const axesHelper = new THREE.AxesHelper(200);
// scene.add(axesHelper);
// const gridHelper = new THREE.GridHelper(3000, 30, 0x004466, 0x002233);
// scene.add(gridHelper);
const helpers = []; // axesHelper, gridHelper
let helpersVisible = false;

// ─── 갓레이 ───────────────────────────────────────────
for (let i = 0; i < 10; i++) {
    const coneGeo = new THREE.ConeGeometry(15 + Math.random() * 25, 500, 5, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
        color: 0x88bbff, transparent: true,
        opacity: 0.05 + Math.random() * 0.07,
        side: THREE.DoubleSide, depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set((Math.random() - 0.5) * 600, 350, (Math.random() - 0.5) * 400);
    cone.rotation.x = Math.PI;
    scene.add(cone);
}

// ─── 해저 지형 ────────────────────────────────────────
const noise = new ImprovedNoise();
const terrainGeo = new THREE.PlaneGeometry(3000, 3000, 150, 150);
terrainGeo.rotateX(-Math.PI / 2);
const tPos = terrainGeo.attributes.position;
for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i), z = tPos.getZ(i);
    const y = noise.noise(x / 700, z / 700, 0.3) * 60
            + noise.noise(x / 200, z / 200, 0.6) * 20
            + noise.noise(x / 60,  z / 60,  0.9) * 6;
    tPos.setY(i, y);
}
tPos.needsUpdate = true;
terrainGeo.computeVertexNormals();

const terrainColors = [];
for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    const c = new THREE.Color();
    if (y < 10)      c.setHex(0xc8b88a);
    else if (y < 25) c.setHex(0xb0a070);
    else if (y < 45) c.setHex(0x7a6a45);
    else              c.setHex(0x554433);
    terrainColors.push(c.r, c.g, c.b);
}
terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0.0 });
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

// ─── 지형 높이 감지 ───────────────────────────────────
const raycaster = new THREE.Raycaster();
const downDir   = new THREE.Vector3(0, -1, 0);
function getGroundY(x, z) {
    raycaster.set(new THREE.Vector3(x, 300, z), downDir);
    const hits = raycaster.intersectObject(terrain, false);
    return hits.length > 0 ? hits[0].point.y : 0;
}

// ─── 기포 파티클 ─────────────────────────────────────
const BUBBLE_COUNT = 1000;
const bubbleGeo = new THREE.BufferGeometry();
const bPos = new Float32Array(BUBBLE_COUNT * 3);
for (let i = 0; i < BUBBLE_COUNT; i++) {
    bPos[i * 3]     = (Math.random() - 0.5) * 1500;
    bPos[i * 3 + 1] = Math.random() * 180;
    bPos[i * 3 + 2] = (Math.random() - 0.5) * 1500;
}
bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
const bubbleMat = new THREE.PointsMaterial({ color: 0xaaccff, size: 1.5, transparent: true, opacity: 0.5 });
const bubbles = new THREE.Points(bubbleGeo, bubbleMat);
scene.add(bubbles);

// ─── 리사이즈 ─────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   환경 모델 로드
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const loader = new GLTFLoader();
const seaweedList = [];

function loadEnvModel(path) {
    return new Promise((resolve, reject) => {
        loader.load(path, (gltf) => resolve(gltf.scene), null, reject);
    });
}

function placeOnTerrain(model, count, scaleMin, scaleMax, sway = true) {
    for (let i = 0; i < count; i++) {
        const clone = model.clone();
        const x = (Math.random() - 0.5) * 2400;
        const z = (Math.random() - 0.5) * 2400;
        clone.position.set(x, getGroundY(x, z), z);
        clone.rotation.y = Math.random() * Math.PI * 2;
        clone.scale.setScalar(scaleMin + Math.random() * (scaleMax - scaleMin));
        clone.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        if (sway) seaweedList.push({ model: clone, offset: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.4 });
        scene.add(clone);
    }
}

function placeAtPositions(model, positions) {
    positions.forEach(({ x, z, scale, rotY }) => {
        const clone = model.clone();
        clone.position.set(x, getGroundY(x, z), z);
        clone.rotation.y = rotY !== undefined ? rotY : Math.random() * Math.PI * 2;
        clone.scale.setScalar(scale);
        clone.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(clone);
    });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   환경 오브젝트 AABB 콜라이더
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const envColliders = [];

function pushCollider(cx, cy, cz, sx, sy, sz, color = 0xff6600) {
    const center = new THREE.Vector3(cx, cy, cz);
    const box    = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(sx, sy, sz));
    envColliders.push({ box, center });

    // 개발용 콜라이더 wireframe (주석 처리)
    // if (color === null) return;
    // const wire = new THREE.Mesh(
    //     new THREE.BoxGeometry(sx, sy, sz),
    //     new THREE.MeshBasicMaterial({ color, wireframe: true })
    // );
    // wire.position.copy(center);
    // wire.visible = helpersVisible;
    // scene.add(wire);
    // helpers.push(wire);
}

const SEA_ROCK_DEF = { hx: 0.9, hy: 0.45, hz: 0.9 };
function addSeaRockCollider(x, z, scale) {
    const groundY = getGroundY(x, z);
    const sx = SEA_ROCK_DEF.hx * scale * 2;
    const sy = SEA_ROCK_DEF.hy * scale * 2;
    const sz = SEA_ROCK_DEF.hz * scale * 2;
    pushCollider(x, groundY + sy / 2, z, sx, sy, sz, 0xff6600);
}

const CORAL_DEF = { hx: 0.30, hy: 0.60, hz: 0.30 };
function addCoralCollider(x, z, scale) {
    const groundY = getGroundY(x, z);
    const sx = CORAL_DEF.hx * scale * 2;
    const sy = CORAL_DEF.hy * scale * 2;
    const sz = CORAL_DEF.hz * scale * 2;
    pushCollider(x, groundY + sy / 2, z, sx, sy, sz, 0x00ffff);
}

const UW_CX       = 751.29 / 70;
const UW_CY       =  92.94 / 70;
const UW_CZ       = 386.56 / 70;
const UW_W        = 729.24 / 70;
const UW_H        = 454.94 / 70;
const UW_D_FULL   = 461.31 / 70;
const UW_PILLAR_W = 0.14;
const UW_PILLAR_H = 0.55;
const UW_TOP_H    = 0.30;
const UW_DEPTH    = 0.50;
const UW_INSET    = 0.22;

function addUnderwaterEnvCollider(x, z, scale) {
    const groundY = getGroundY(x, z);
    const cx   = x    + UW_CX     * scale;
    const cy   = groundY + UW_CY  * scale;
    const cz   = z    + UW_CZ     * scale;
    const W    = UW_W     * scale;
    const H    = UW_H     * scale;
    const D    = UW_D_FULL * scale * UW_DEPTH;
    const pW   = W * UW_PILLAR_W;
    const pH   = H * UW_PILLAR_H;
    const tH   = H * UW_TOP_H;
    const topW = W * (1 - UW_INSET * 2);
    const baseY = cy - H / 2;

    pushCollider(cx - W/2 + pW/2 + W * UW_INSET, baseY + pH/2, cz, pW, pH, D, null);
    pushCollider(cx + W/2 - pW/2 - W * UW_INSET, baseY + pH/2, cz, pW, pH, D, null);
    pushCollider(cx, baseY + pH + tH/2, cz, topW, tH, D, null);
}

function registerSeaRockColliders(positions) {
    positions.forEach(({ x, z, scale }) => addSeaRockCollider(x, z, scale));
}
function registerCoralColliders(positions) {
    positions.forEach(({ x, z, scale }) => addCoralCollider(x, z, scale));
}
function registerUnderwaterEnvColliders(positions) {
    positions.forEach(({ x, z, scale }) => addUnderwaterEnvCollider(x, z, scale));
}

const _envPlayerBox = new THREE.Box3();
const _envPushVec   = new THREE.Vector3();

function resolveEnvCollisions() {
    if (!playerHitbox) return;

    const [hx, hy, hz] = FISH_CONFIG[playerStage].hitbox;
    _envPlayerBox.setFromCenterAndSize(
        playerPos,
        new THREE.Vector3(hx, hy, hz)
    );

    for (const col of envColliders) {
        if (!_envPlayerBox.intersectsBox(col.box)) continue;

        const overlapX = Math.min(_envPlayerBox.max.x - col.box.min.x, col.box.max.x - _envPlayerBox.min.x);
        const overlapY = Math.min(_envPlayerBox.max.y - col.box.min.y, col.box.max.y - _envPlayerBox.min.y);
        const overlapZ = Math.min(_envPlayerBox.max.z - col.box.min.z, col.box.max.z - _envPlayerBox.min.z);

        if (overlapX <= overlapY && overlapX <= overlapZ) {
            const sign = playerPos.x < col.center.x ? -1 : 1;
            playerPos.x += sign * overlapX;
            playerVel.x *= -0.1;
        } else if (overlapZ <= overlapX && overlapZ <= overlapY) {
            const sign = playerPos.z < col.center.z ? -1 : 1;
            playerPos.z += sign * overlapZ;
            playerVel.z *= -0.1;
        } else {
            const sign = playerPos.y < col.center.y ? -1 : 1;
            playerPos.y += sign * overlapY;
            playerVel.y *= -0.1;
        }

        _envPlayerBox.setFromCenterAndSize(
            playerPos,
            new THREE.Vector3(hx, hy, hz)
        );
    }
}

const coralPositions = [
    { x:  200, z:  200, scale: 50 }, { x:  120, z:   80, scale: 45 }, { x: -150, z:  -60, scale: 55 },
    { x:  300, z: -400, scale: 50 }, { x: -250, z: -500, scale: 48 }, { x:   80, z: -700, scale: 52 },
    { x:  600, z: -600, scale: 45 }, { x: -700, z: -350, scale: 50 }, { x:  200, z:  450, scale: 50 },
    { x: -300, z:  550, scale: 48 }, { x:  700, z:  300, scale: 55 }, { x: -600, z:  700, scale: 45 },
    { x:   50, z:  900, scale: 50 }, { x:  900, z:  100, scale: 52 }, { x: 1100, z: -200, scale: 48 },
    { x: 1000, z:  500, scale: 50 }, { x: -900, z:  200, scale: 50 }, { x:-1100, z: -300, scale: 48 },
    { x: -800, z:  600, scale: 52 }, { x: 1200, z:-1000, scale: 45 }, { x:-1200, z: 1000, scale: 45 },
    { x: 1000, z: 1100, scale: 48 }, { x:-1000, z:-1100, scale: 48 },
];
const seaRockPositions = [
    { x:  -50, z:  200, scale: 30 }, { x:  180, z: -180, scale: 35 }, { x: -220, z:  -80, scale: 28 },
    { x:  400, z: -300, scale: 40 }, { x: -500, z: -250, scale: 38 }, { x:  150, z: -800, scale: 35 },
    { x: -100, z:-1000, scale: 42 }, { x:  700, z: -700, scale: 30 }, { x: -800, z: -600, scale: 36 },
    { x:  350, z:  600, scale: 38 }, { x: -400, z:  800, scale: 35 }, { x:  100, z: 1100, scale: 40 },
    { x: -700, z:  900, scale: 32 }, { x:  800, z:  800, scale: 36 }, { x: 1000, z:    0, scale: 40 },
    { x: 1200, z:  400, scale: 35 }, { x: 1100, z: -600, scale: 38 }, { x: 1300, z:  900, scale: 30 },
    { x:-1000, z: -100, scale: 38 }, { x:-1200, z:  500, scale: 35 }, { x:-1100, z: -700, scale: 40 },
    { x:-1300, z:  800, scale: 32 }, { x: 1300, z:-1200, scale: 42 }, { x:-1300, z:-1200, scale: 42 },
    { x: 1300, z: 1200, scale: 42 }, { x:-1300, z: 1200, scale: 42 },
];
const underwaterEnvPositions = [
    { x:  400, z:  400, scale: 80 }, { x:  900, z: -900, scale: 70 }, { x: -900, z: -900, scale: 75 },
    { x:  900, z:  900, scale: 70 }, { x: -900, z:  900, scale: 75 },
    { x:    0, z:-1200, scale: 68 }, { x:    0, z: 1200, scale: 68 },
];

Promise.all([
    loadEnvModel('./models/seaweed/scene.gltf'),
    loadEnvModel('./models/claret_tall_seaweed/scene.gltf'),
    loadEnvModel('./models/rock/scene.gltf'),
    loadEnvModel('./models/coral/scene.gltf'),
    loadEnvModel('./models/sea_rock/scene.gltf'),
    loadEnvModel('./models/underwater_environment/scene.gltf'),
]).then(([seaweedModel, tallSeaweedModel, rockModel, coralModel, seaRockModel, underwaterEnvModel]) => {
    placeOnTerrain(seaweedModel,     150, 10, 20, true);
    placeOnTerrain(tallSeaweedModel,  80, 30, 40, true);
    placeOnTerrain(rockModel,         60, 15, 35, false);
    placeAtPositions(coralModel,          coralPositions);
    placeAtPositions(seaRockModel,        seaRockPositions);
    placeAtPositions(underwaterEnvModel,  underwaterEnvPositions);

    registerSeaRockColliders(seaRockPositions);
    registerCoralColliders(coralPositions);
    registerUnderwaterEnvColliders(underwaterEnvPositions);
    console.log(`환경 콜라이더 ${envColliders.length}개 등록 완료`);
    console.log('모든 환경 모델 로드 완료!');
}).catch(err => console.error('환경 모델 로드 실패:', err));

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   단계별 물고기 설정
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FISH_CONFIG = {
    1: { model: '1_gold_fish',           scale: 2,  hitbox: [0.3, 0.8,  2.3], hitboxOffset: [0, 0, 0],       speed: 3.5 },
    2: { model: '2_fish',                scale: 4,  hitbox: [7,   7,    19 ],  hitboxOffset: [0, 0, 0],       speed: 3.0 },
    3: { model: '3_fish',                scale: 3,  hitbox: [6,   13,   25 ],  hitboxOffset: [78, 40, 10],    rotation: [0, -Math.PI/2, 0], speed: 2.7 },
    4: { model: '4_tuna_fish',           scale: 13, hitbox: [6,   8,    23 ],  hitboxOffset: [0, 0, -3],      speed: 2.4 },
    5: { model: '5_shark',               scale: 18, hitbox: [6,   7,    30 ],  hitboxOffset: [0, -10, 0],     speed: 2.8 },
    6: { model: '6_alien_fish_animated', scale: 10, hitbox: [10,  15,   27 ],  hitboxOffset: [0, -11, 0],     speed: 2.1 },
    7: { model: '7_texture_fish',        scale: 8,  hitbox: [10,  35,   30 ],  hitboxOffset: [0, 20, 0],      speed: 1.8 },
    8: { model: '8_whale',               scale: 5,  hitbox: [40,  40,   270],  hitboxOffset: [0, -60, 0],     speed: 1.0 },
};

const FISH_VALUE     = { 1:1, 2:2, 3:4, 4:7, 5:11, 6:16, 7:22, 8:30 };
const GAUGE_REQUIRED = { 2:20, 3:40, 4:70, 5:110, 6:160, 7:220, 8:300 };

const SPAWN_COUNT = {
    2: [12, 14, 8, 3, 2, 1, 0, 0],
    3: [ 9, 10, 9, 6, 3, 2, 1, 0],
    4: [ 7,  8, 8, 8, 4, 3, 2, 0],
    5: [ 5,  7, 7, 7, 7, 4, 2, 1],
    6: [ 4,  6, 6, 6, 7, 6, 3, 2],
    7: [ 4,  5, 5, 5, 6, 7, 6, 2],
    8: [ 3,  4, 4, 5, 6, 6, 6, 6],
};

function buildHitbox(stage, position) {
    const [hx, hy, hz] = FISH_CONFIG[stage].hitbox;
    const geo = new THREE.BoxGeometry(hx, hy, hz);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    const box = new THREE.Mesh(geo, mat);
    box.position.copy(position);
    scene.add(box);

    // 개발용 히트박스 wireframe (주석 처리)
    // const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
    // wire.visible = helpersVisible;
    // box.add(wire);
    // helpers.push(wire);
    const wire = null;

    return { box, wire };
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   플레이어
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let playerStage = 2;
let playerHitbox = null;
let playerWire   = null;
let playerModel  = null;
let gauge        = 0;

function loadPlayerModel(stage) {
    if (playerHitbox) {
        scene.remove(playerHitbox);
        if (playerWire) {
            const idx = helpers.indexOf(playerWire);
            if (idx !== -1) helpers.splice(idx, 1);
        }
    }

    const { box, wire } = buildHitbox(stage, playerPos);
    playerHitbox = box;
    playerWire   = wire;

    const cfg = FISH_CONFIG[stage];
    loader.load(`./models/fishmodels/${cfg.model}/scene.gltf`, (gltf) => {
        playerModel = gltf.scene;
        playerModel.scale.setScalar(cfg.scale);
        const [ox, oy, oz] = cfg.hitboxOffset;
        playerModel.position.set(ox, oy, oz);
        if (cfg.rotation) playerModel.rotation.set(...cfg.rotation);
        playerModel.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        playerHitbox.add(playerModel);
        console.log(`플레이어 ${stage}단계 로드 완료`);
    }, null, (err) => console.error('플레이어 모델 로드 실패:', err));
}

loadPlayerModel(playerStage);

function addGauge(npcStage) {
    if (playerStage >= 8) return;
    const mult = xp2Active ? 2 : 1;
    gauge += FISH_VALUE[npcStage] * mult;
    const required = GAUGE_REQUIRED[playerStage];
    if (gauge >= required) {
        gauge = 0;
        playerStage++;
        loadPlayerModel(playerStage);
        const stageEl = document.getElementById('hud-stage');
        stageEl.textContent = playerStage >= 8 ? `Stage 8 (MAX)` : `Stage ${playerStage}`;
        document.getElementById('gauge-text').textContent =
            playerStage < 8 ? `0 / ${GAUGE_REQUIRED[playerStage]}` : 'MAX';

        if (playerStage >= 5 && !flockedStages.has(playerStage)) {
            flockedStages.add(playerStage);
            if (flockActive) removeFlock();
            spawnFlock();
        }

        if (playerStage >= 8) {
            updateGaugeUI();
            triggerClear();
            return;
        }
    }
    updateGaugeUI();
}

function updateGaugeUI() {
    const required = GAUGE_REQUIRED[playerStage] ?? 1;
    const pct = Math.min(gauge / required * 100, 100);
    document.getElementById('gauge-fill').style.width = pct + '%';
    document.getElementById('gauge-text').textContent =
        playerStage < 8 ? `${gauge} / ${required}` : 'MAX';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NPC 시스템
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const npcList = [];
let NPC_SPEED_SCALE = 0.4;   // ← const → let (난이도 변경용)
const NPC_TURN_SPEED  = 0.04;

function randomHorizontalDir() {
    const angle = Math.random() * Math.PI * 2;
    return new THREE.Vector3(
        Math.sin(angle),
        (Math.random() - 0.5) * 0.3,
        Math.cos(angle)
    ).normalize();
}

function randomSpawnPos(stage) {
    const hy = FISH_CONFIG[stage].hitbox[1];
    const x  = (Math.random() - 0.5) * 2000;
    const z  = (Math.random() - 0.5) * 2000;
    const groundY = getGroundY(x, z);
    return new THREE.Vector3(x, groundY + hy / 2 + 10 + Math.random() * 40, z);
}

function farSpawnPos(stage) {
    const hy = FISH_CONFIG[stage].hitbox[1];
    let bestPos = null, bestDist = 0;
    for (let i = 0; i < 10; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        const groundY = getGroundY(x, z);
        const pos = new THREE.Vector3(x, groundY + hy / 2 + 10 + Math.random() * 40, z);
        const dist = pos.distanceTo(playerPos);
        if (dist > bestDist) { bestDist = dist; bestPos = pos; }
    }
    return bestPos;
}

function spawnNPC(stage, position) {
    const { box, wire } = buildHitbox(stage, position);
    // 개발용 NPC 와이어 색상 (주석 처리)
    // wire.material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });

    const initDir = randomHorizontalDir();
    const npc = {
        box, wire, stage,
        moveDir:   initDir.clone(),
        targetDir: initDir.clone(),
        dirTimer:  2 + Math.random() * 3,
        bobOffset: Math.random() * Math.PI * 2,
    };
    npcList.push(npc);

    const cfg = FISH_CONFIG[stage];
    loader.load(`./models/fishmodels/${cfg.model}/scene.gltf`, (gltf) => {
        const mesh = gltf.scene;
        mesh.scale.setScalar(cfg.scale);
        const [ox, oy, oz] = cfg.hitboxOffset;
        mesh.position.set(ox, oy, oz);
        if (cfg.rotation) mesh.rotation.set(...cfg.rotation);
        mesh.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        box.add(mesh);
    }, null, (err) => console.error(`NPC ${stage}단계 모델 로드 실패:`, err));

    return npc;
}

function removeNPC(npc) {
    scene.remove(npc.box);
    const idx = npcList.indexOf(npc);
    if (idx !== -1) npcList.splice(idx, 1);
    const wi = helpers.indexOf(npc.wire);
    if (wi !== -1) helpers.splice(wi, 1);
}

function spawnAllNPCs(stage) {
    const counts = SPAWN_COUNT[stage] ?? SPAWN_COUNT[2];
    counts.forEach((count, i) => {
        for (let n = 0; n < count; n++) {
            spawnNPC(i + 1, randomSpawnPos(i + 1));
        }
    });
}

spawnAllNPCs(playerStage);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   군집 이벤트
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const FLOCK_RADIUS = 500;
const FLOCK_CENTER = new THREE.Vector3(0, 40, 0);
const FLOCK_COUNT  = 30;
const FLOCK_SPEED  = 1.2;
const FLOCK_Y      = 40;

const BOID_COHESION   = 0.005;
const BOID_SEPARATION = 0.08;
const BOID_ALIGN      = 0.04;
const BOID_SEP_DIST   = 8;

let flockList       = [];
let flockAngle      = 0;
let flockActive     = false;
const flockedStages = new Set();

function spawnFlock() {
    if (flockActive) return;
    flockActive = true;
    flockAngle  = Math.random() * Math.PI * 2;

    for (let i = 0; i < FLOCK_COUNT; i++) {
        const angle = flockAngle + (Math.random() - 0.5) * 0.5;
        const r     = FLOCK_RADIUS + (Math.random() - 0.5) * 30;
        const pos   = new THREE.Vector3(
            Math.cos(angle) * r,
            FLOCK_Y + (Math.random() - 0.5) * 10,
            Math.sin(angle) * r
        );

        const { box, wire } = buildHitbox(1, pos);
        // wire.material = new THREE.MeshBasicMaterial({ color: 0xff88ff, wireframe: true });

        const npc = {
            box, wire, stage: 1,
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5
            ),
            isFlock: true,
        };
        flockList.push(npc);

        const cfg = FISH_CONFIG[1];
        loader.load(`./models/fishmodels/${cfg.model}/scene.gltf`, (gltf) => {
            const mesh = gltf.scene;
            mesh.scale.setScalar(cfg.scale);
            const [ox, oy, oz] = cfg.hitboxOffset;
            mesh.position.set(ox, oy, oz);
            mesh.traverse(c => { if (c.isMesh) c.castShadow = true; });
            box.add(mesh);
        });
    }
}

function removeFlock() {
    for (const npc of [...flockList]) {
        scene.remove(npc.box);
        const wi = helpers.indexOf(npc.wire);
        if (wi !== -1) helpers.splice(wi, 1);
    }
    flockList   = [];
    flockActive = false;
}

function removeFlockNPC(npc) {
    scene.remove(npc.box);
    const wi = helpers.indexOf(npc.wire);
    if (wi !== -1) helpers.splice(wi, 1);
    const idx = flockList.indexOf(npc);
    if (idx !== -1) flockList.splice(idx, 1);
    if (flockList.length === 0) flockActive = false;
}

function updateFlock(delta) {
    if (!flockActive || flockList.length === 0) return;

    flockAngle += FLOCK_SPEED * delta * 0.3;
    const leaderPos = new THREE.Vector3(
        Math.cos(flockAngle) * FLOCK_RADIUS,
        FLOCK_Y,
        Math.sin(flockAngle) * FLOCK_RADIUS
    );
    const leaderDir = new THREE.Vector3(
        -Math.sin(flockAngle), 0, Math.cos(flockAngle)
    ).normalize();

    for (const npc of flockList) {
        const pos = npc.box.position;

        const toLeader = leaderPos.clone().sub(pos).multiplyScalar(BOID_COHESION);
        const align    = leaderDir.clone().multiplyScalar(BOID_ALIGN);

        const sep = new THREE.Vector3();
        for (const other of flockList) {
            if (other === npc) continue;
            const diff = pos.clone().sub(other.box.position);
            const d    = diff.length();
            if (d < BOID_SEP_DIST && d > 0) sep.add(diff.normalize().divideScalar(d));
        }
        sep.multiplyScalar(BOID_SEPARATION);

        npc.vel.add(toLeader).add(align).add(sep);

        const maxSpeed = FISH_CONFIG[1].speed * 0.5;
        if (npc.vel.length() > maxSpeed) npc.vel.normalize().multiplyScalar(maxSpeed);

        pos.x += npc.vel.x * delta * 60;
        pos.z += npc.vel.z * delta * 60;
        pos.y  = FLOCK_Y + Math.sin(Date.now() * 0.001 + npc.box.id) * 2;

        if (npc.vel.length() > 0.01) {
            npc.box.rotation.y = Math.atan2(npc.vel.x, npc.vel.z);
        }
    }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NPC AI UPDATE
   - Easy/Normal: random wander
   - Hard: NPCs higher stage than player chase within HARD_DETECT_RANGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HARD_DETECT_RANGE = 350;
const HARD_CHASE_SPEED  = 1.3;

const _toPlayer = new THREE.Vector3();

function updateNPCs(delta, elapsed) {
    const isHard = diffSettings.difficulty === 'Hard';

    for (const npc of npcList) {
        const speed = FISH_CONFIG[npc.stage].speed * NPC_SPEED_SCALE;

        if (isHard && npc.stage > playerStage) {
            _toPlayer.copy(playerPos).sub(npc.box.position);
            const dist = _toPlayer.length();

            if (dist < HARD_DETECT_RANGE) {
                npc.targetDir.copy(_toPlayer).normalize();
                npc.targetDir.y = 0;
                npc.targetDir.normalize();

                const chaseSpeed = speed * HARD_CHASE_SPEED;
                npc.moveDir.lerp(npc.targetDir, NPC_TURN_SPEED * 2).normalize();
                npc.box.position.x += npc.moveDir.x * chaseSpeed * delta * 60;
                npc.box.position.z += npc.moveDir.z * chaseSpeed * delta * 60;
                npc.box.position.y = playerPos.y + Math.sin(elapsed * 1.2 + npc.bobOffset) * 3;
                npc.box.rotation.y = Math.atan2(npc.moveDir.x, npc.moveDir.z);

                // 개발용 와이어 색상 (주석 처리)
                // npc.wire.material.color.set(0xff2200);
                continue;
            } else {
                // npc.wire.material.color.set(0xffff00);
            }
        }

        npc.dirTimer -= delta;
        if (npc.dirTimer <= 0) {
            npc.targetDir = randomHorizontalDir();
            npc.dirTimer  = 2 + Math.random() * 3;
        }

        npc.moveDir.lerp(npc.targetDir, NPC_TURN_SPEED).normalize();

        npc.box.position.x += npc.moveDir.x * speed * delta * 60;
        npc.box.position.z += npc.moveDir.z * speed * delta * 60;

        const baseY = FISH_CONFIG[npc.stage].hitbox[1] / 2 + 20;
        npc.box.position.y = baseY + Math.sin(elapsed * 1.2 + npc.bobOffset) * 3;

        const limit = 1400;
        if (Math.abs(npc.box.position.x) > limit) {
            npc.targetDir.x *= -1;
            npc.box.position.x = Math.sign(npc.box.position.x) * limit;
        }
        if (Math.abs(npc.box.position.z) > limit) {
            npc.targetDir.z *= -1;
            npc.box.position.z = Math.sign(npc.box.position.z) * limit;
        }

        npc.box.rotation.y = Math.atan2(npc.moveDir.x, npc.moveDir.z);
    }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   충돌 감지
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const _center   = new THREE.Vector3();
const _size     = new THREE.Vector3();
const playerBox = new THREE.Box3();
const npcBox    = new THREE.Box3();

function makeBox3(mesh, stage, target) {
    const [hx, hy, hz] = FISH_CONFIG[stage].hitbox;
    mesh.getWorldPosition(_center);
    target.setFromCenterAndSize(_center, _size.set(hx, hy, hz));
}

const collidingNPCs = new Set();

function checkCollisions() {
    if (!playerHitbox || isDead) return;
    makeBox3(playerHitbox, playerStage, playerBox);

    // 개발용 wire 색상 초기화 (주석 처리)
    // collidingNPCs.forEach(npc => npc.wire.material.color.set(0xffff00));
    collidingNPCs.clear();

    let danger = false;

    for (let i = npcList.length - 1; i >= 0; i--) {
        const npc = npcList[i];
        makeBox3(npc.box, npc.stage, npcBox);
        if (!playerBox.intersectsBox(npcBox)) continue;

        collidingNPCs.add(npc);

        if (npc.stage <= playerStage) {
            // npc.wire.material.color.set(0x00aaff);
            setHudStatus(`Stage ${npc.stage} contact → Eaten!`, '#00aaff');
            addGauge(npc.stage);
            const respawnStage = npc.stage;
            removeNPC(npc);
            spawnNPC(respawnStage, farSpawnPos(respawnStage));
        } else {
            // npc.wire.material.color.set(0xff3300);
            danger = true;

            if (diffSettings.difficulty === 'Normal' || diffSettings.difficulty === 'Hard') {
                triggerDeath();
                return;
            } else if (diffSettings.difficulty === 'Easy') {
                triggerEasyDamage();
                setHudStatus(`Stage ${npc.stage} contact → Danger!`, '#ff3300');
            } else {
                setHudStatus(`Stage ${npc.stage} contact → Danger!`, '#ff3300');
            }
        }
    }

    if (collidingNPCs.size === 0) {
        // if (playerWire) playerWire.material.color.set(0x00ff00);
        if (!xp2Active && !speedActive) setHudStatus('');
    } else if (danger) {
        // if (playerWire) playerWire.material.color.set(0xff3300);
    } else {
        // if (playerWire) playerWire.material.color.set(0x00aaff);
    }

    if (flockActive) {
        makeBox3(playerHitbox, playerStage, playerBox);
        for (let i = flockList.length - 1; i >= 0; i--) {
            const npc = flockList[i];
            makeBox3(npc.box, 1, npcBox);
            if (!playerBox.intersectsBox(npcBox)) continue;
            if (playerStage >= 1) {
                addGauge(1);
                removeFlockNPC(npc);
            }
        }
    }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   UI (HUD)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const style = document.createElement('style');
style.textContent = `
    body { margin: 0; overflow: hidden; font-family: sans-serif; }
    #hud {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center; gap: 8px;
        pointer-events: none; min-width: 320px;
    }
    #hud-stage { color: #fff; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px #000; }
    #gauge-wrap { width: 320px; display: flex; flex-direction: column; gap: 4px; }
    #gauge-label {
        display: flex; justify-content: space-between;
        font-size: 12px; color: rgba(255,255,255,0.7); text-shadow: 0 0 4px #000;
    }
    #gauge-track {
        width: 100%; height: 14px;
        background: rgba(0,0,0,0.45);
        border-radius: 99px;
        border: 1px solid rgba(255,255,255,0.2);
        overflow: hidden;
    }
    #gauge-fill {
        height: 100%; width: 0%;
        background: linear-gradient(90deg, #00c6ff, #00ff99);
        border-radius: 99px;
        transition: width 0.2s ease;
        box-shadow: 0 0 8px #00ffaa88;
    }
    #hud-status { font-size: 14px; font-weight: bold; text-shadow: 0 0 6px #000; }
    #hud-keys   { font-size: 11px; color: rgba(255,255,255,0.45); text-shadow: 0 0 4px #000; }

    #damage-flash {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(255,0,0,0); transition: background 0.1s;
        z-index: 50;
    }
    #damage-flash.active { background: rgba(255,0,0,0.35); }

    #death-screen {
        display: none;
        position: fixed; inset: 0; z-index: 100;
        background: rgba(0,0,0,0.75);
        flex-direction: column; align-items: center; justify-content: center;
        gap: 20px;
    }
    #death-screen.show { display: flex; }
    #death-title {
        font-size: 64px; font-weight: 900; color: #ff2222;
        text-shadow: 0 0 30px #ff0000, 0 0 60px #ff000066;
        letter-spacing: 6px;
    }
    #death-sub {
        font-size: 22px; color: rgba(255,255,255,0.8);
        text-shadow: 0 0 8px #000;
    }
    #death-hint {
        font-size: 15px; color: rgba(255,255,255,0.45);
        animation: blink 1.2s infinite;
    }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }

    #clear-screen {
        display: none;
        position: fixed; inset: 0; z-index: 100;
        background: radial-gradient(ellipse at center, rgba(0,40,80,0.92) 0%, rgba(0,10,30,0.97) 100%);
        flex-direction: column; align-items: center; justify-content: center;
        gap: 28px;
    }
    #clear-screen.show { display: flex; }
    #clear-title {
        font-size: 72px; font-weight: 900; color: #00ffcc;
        text-shadow: 0 0 30px #00ffcc, 0 0 80px #00ffcc88;
        letter-spacing: 8px;
        animation: pulse-glow 2s ease-in-out infinite;
    }
    @keyframes pulse-glow {
        0%,100% { text-shadow: 0 0 30px #00ffcc, 0 0 80px #00ffcc88; }
        50%      { text-shadow: 0 0 60px #00ffcc, 0 0 120px #00ffcccc; }
    }
    #clear-sub {
        font-size: 20px; color: rgba(255,255,255,0.75);
        text-shadow: 0 0 8px #000; text-align: center; line-height: 1.6;
    }
    .clear-btn {
        padding: 14px 40px; border-radius: 99px; border: 2px solid #00ffcc;
        background: rgba(0,255,204,0.12); color: #00ffcc;
        font-size: 18px; font-weight: bold; cursor: pointer;
        letter-spacing: 2px; transition: all 0.2s;
        text-shadow: 0 0 8px #00ffcc88;
    }
    .clear-btn:hover {
        background: rgba(0,255,204,0.28);
        box-shadow: 0 0 20px #00ffcc88;
        transform: scale(1.05);
    }
    .clear-btn-row { display: flex; gap: 20px; }
`;
document.head.appendChild(style);

const hud = document.createElement('div');
hud.id = 'hud';
hud.innerHTML = `
    <div id="hud-stage">Stage ${playerStage}</div>
    <div id="gauge-wrap">
        <div id="gauge-label">
            <span>XP</span>
            <span id="gauge-text">0 / ${GAUGE_REQUIRED[playerStage]}</span>
        </div>
        <div id="gauge-track"><div id="gauge-fill"></div></div>
    </div>
    <div id="hud-status"></div>
    <div id="hud-keys">W Forward / S Back / AD Turn / QE Up-Down / Mouse Look</div>
`;
document.body.appendChild(hud);

const damageFlash = document.createElement('div');
damageFlash.id = 'damage-flash';
document.body.appendChild(damageFlash);

const deathScreen = document.createElement('div');
deathScreen.id = 'death-screen';
deathScreen.innerHTML = `
    <div id="death-title">YOU DIED</div>
    <div id="death-sub">You were eaten by a bigger fish.</div>
    <div id="death-hint">Press R to respawn</div>
`;
document.body.appendChild(deathScreen);

const clearScreen = document.createElement('div');
clearScreen.id = 'clear-screen';
clearScreen.innerHTML = `
    <div id="clear-title">🐳 OCEAN MASTER</div>
    <div id="clear-sub">
        You have reached the top of the food chain!<br>
        You are now the ruler of the ocean.
    </div>
    <div class="clear-btn-row">
        <button class="clear-btn" id="btn-keep-swimming">🌊 Keep Swimming</button>
        <button class="clear-btn" id="btn-restart">🔄 Start Over</button>
    </div>
`;
document.body.appendChild(clearScreen);

document.getElementById('btn-keep-swimming').addEventListener('click', () => {
    clearScreen.classList.remove('show');
    renderer.domElement.requestPointerLock();
});
document.getElementById('btn-restart').addEventListener('click', () => {
    clearScreen.classList.remove('show');
    restartGame();
});

function setHudStatus(text, color = '#fff') {
    const el = document.getElementById('hud-status');
    el.textContent = text;
    el.style.color = color;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DEATH & RESPAWN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let isDead = false;

function triggerDeath() {
    if (isDead) return;
    isDead = true;
    document.exitPointerLock();
    deathScreen.classList.add('show');
}

function respawn() {
    isDead = false;
    deathScreen.classList.remove('show');
    restartGame();
}

function restartGame() {
    playerStage = 2;
    gauge       = 0;
    playerPos.set(0, 50, 0);
    playerVel.set(0, 0, 0);
    yaw   = Math.PI;
    pitch = 0;

    loadPlayerModel(playerStage);
    document.getElementById('hud-stage').textContent = `Stage ${playerStage}`;
    updateGaugeUI();

    for (const npc of [...npcList]) removeNPC(npc);
    if (flockActive) removeFlock();
    flockedStages.clear();
    spawnAllNPCs(playerStage);

    setHudStatus('');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GAME CLEAR
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function triggerClear() {
    document.exitPointerLock();
    clearScreen.classList.add('show');
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   EASY MODE DAMAGE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let easyDamageCooldown = 0;

function triggerEasyDamage() {
    if (easyDamageCooldown > 0) return;
    easyDamageCooldown = 1.0;
    gauge = Math.max(0, gauge - 2);
    updateGaugeUI();
    damageFlash.classList.add('active');
    setTimeout(() => damageFlash.classList.remove('active'), 200);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚙️ lil-gui 설정 패널
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const gui = new GUI({ title: '⚙️ Settings' });

const diffSettings = { difficulty: 'Easy' };
const diffFolder = gui.addFolder('🎮 Difficulty');
diffFolder.add(diffSettings, 'difficulty', ['Easy', 'Normal', 'Hard'])
    .name('Select Difficulty')
    .onChange((value) => {
        switch (value) {
            case 'Easy':   NPC_SPEED_SCALE = 0.4; break;
            case 'Normal': NPC_SPEED_SCALE = 0.4; break;
            case 'Hard':   NPC_SPEED_SCALE = 0.4; break;
        }
    });
diffFolder.open();

const itemSettings = { itemEnabled: true };
const itemFolder = gui.addFolder('🎁 Items');
itemFolder.add(itemSettings, 'itemEnabled')
    .name('Items ON/OFF')
    .onChange((value) => {
        if (!value) clearAllItems();
        console.log('Items:', value ? 'ON' : 'OFF');
    });
itemFolder.open();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ITEM SYSTEM
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ITEM_SINK_SPEED      = 8;
const ITEM_SPAWN_INTERVAL  = 20;
const ITEM_EFFECT_DURATION = 10;
const ITEM_COLLIDE_RADIUS  = 18;

const itemList = [];
let itemSpawnTimer = 0;

let xp2Active   = false;
let xp2Timer    = 0;
let speedActive = false;
let speedTimer  = 0;
let speedMult   = 1.0;

// ─── 공통 3D 텍스트 빌더 ─────────────────────────────
let _itemFont = null;
const _fontLoader = new FontLoader();
_fontLoader.load(
    'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
    (f) => { _itemFont = f; }
);

function build3DTextMesh(text, color) {
    const group = new THREE.Group();
    group.add(new THREE.PointLight(color, 2, 60));

    const makeMesh = (font) => {
        const geo = new TextGeometry(text, {
            font,
            size: 6,
            height: 2,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.4,
            bevelSize: 0.3,
            bevelSegments: 5,
        });
        geo.computeBoundingBox();
        const offsetX = -(geo.boundingBox.max.x - geo.boundingBox.min.x) / 2;
        const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.25 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.x = offsetX;
        mesh.position.y = -3;
        group.add(mesh);
    };

    if (_itemFont) {
        makeMesh(_itemFont);
    } else {
        _fontLoader.load(
            'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
            (f) => { _itemFont = f; makeMesh(f); }
        );
    }
    return group;
}

// ─── XP2 mesh: 3D "X2" 텍스트 (노란색) ──────────────
function buildXP2Mesh() {
    return build3DTextMesh('X2', 0xffdd00);
}

// ─── Speed mesh: 3D "SPEED" 텍스트 (파란색) ──────────
function buildSpeedMesh() {
    return build3DTextMesh('SPEED', 0x00ccff);
}

function spawnItem() {
    if (!itemSettings.itemEnabled) return;
    const type = Math.random() < 0.5 ? 'xp2' : 'speed';
    const x = (Math.random() - 0.5) * 2000;
    const z = (Math.random() - 0.5) * 2000;
    const mesh = type === 'xp2' ? buildXP2Mesh() : buildSpeedMesh();
    mesh.position.set(x, 200, z);
    scene.add(mesh);
    itemList.push({ mesh, type, groundY: getGroundY(x, z) });
}

function clearAllItems() {
    for (const item of itemList) scene.remove(item.mesh);
    itemList.length = 0;
}

const _itemPlayerVec = new THREE.Vector3();

function updateItems(delta) {
    itemSpawnTimer += delta;
    if (itemSpawnTimer >= ITEM_SPAWN_INTERVAL) {
        itemSpawnTimer = 0;
        spawnItem();
    }

    for (let i = itemList.length - 1; i >= 0; i--) {
        const item = itemList[i];
        item.mesh.position.y -= ITEM_SINK_SPEED * delta;
        item.mesh.rotation.y += delta * 1.5;

        if (item.mesh.position.y <= item.groundY) {
            scene.remove(item.mesh);
            itemList.splice(i, 1);
            continue;
        }

        _itemPlayerVec.copy(item.mesh.position).sub(playerPos);
        if (_itemPlayerVec.length() < ITEM_COLLIDE_RADIUS) {
            applyItemEffect(item.type);
            scene.remove(item.mesh);
            itemList.splice(i, 1);
        }
    }

    if (xp2Active) {
        xp2Timer -= delta;
        if (xp2Timer <= 0) { xp2Active = false; updateItemHUD(); setHudStatus(''); }
        else updateItemHUD();
    }
    if (speedActive) {
        speedTimer -= delta;
        if (speedTimer <= 0) { speedActive = false; speedMult = 1.0; updateItemHUD(); setHudStatus(''); }
        else updateItemHUD();
    }
}

function applyItemEffect(type) {
    if (type === 'xp2') {
        xp2Active = true;
        xp2Timer  = ITEM_EFFECT_DURATION;
        setHudStatus('✨ 2x XP Active!', '#ffdd00');
    } else {
        speedActive = true;
        speedTimer  = ITEM_EFFECT_DURATION;
        speedMult   = 1.5;
        setHudStatus('⚡ Speed Up!', '#00ccff');
    }
    updateItemHUD();
}

const itemHudStyle = document.createElement('style');
itemHudStyle.textContent = `
    #item-hud {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        display: flex; gap: 12px; pointer-events: none;
    }
    .item-badge {
        padding: 5px 14px; border-radius: 99px; font-size: 13px; font-weight: bold;
        color: #fff; text-shadow: 0 0 6px #000;
        background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.25);
    }
    .item-badge.xp2   { border-color: #ffdd00; color: #ffdd00; }
    .item-badge.speed { border-color: #00ccff; color: #00ccff; }
`;
document.head.appendChild(itemHudStyle);

const itemHud = document.createElement('div');
itemHud.id = 'item-hud';
document.body.appendChild(itemHud);

function updateItemHUD() {
    itemHud.innerHTML = '';
    if (xp2Active) {
        const el = document.createElement('div');
        el.className = 'item-badge xp2';
        el.textContent = `✨ 2x XP  ${Math.ceil(xp2Timer)}s`;
        itemHud.appendChild(el);
    }
    if (speedActive) {
        const el = document.createElement('div');
        el.className = 'item-badge speed';
        el.textContent = `⚡ Speed Up  ${Math.ceil(speedTimer)}s`;
        itemHud.appendChild(el);
    }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   애니메이션 루프
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta   = clock.getDelta();
    const elapsed = clock.elapsedTime;

    if (isOrbitMode) {
        orbitControls.update();
    } else {
        const baseSpeed  = FISH_CONFIG[playerStage].speed * speedMult;
        const TURN_SPEED = 0.035;

        if (keys['KeyA'] || keys['ArrowLeft'])  yaw += TURN_SPEED;
        if (keys['KeyD'] || keys['ArrowRight']) yaw -= TURN_SPEED;

        const forward = new THREE.Vector3(
            Math.sin(yaw) * Math.cos(-pitch),
            -Math.sin(-pitch),
            Math.cos(yaw) * Math.cos(-pitch)
        ).normalize();
        const up = new THREE.Vector3(0, 1, 0);

        const targetVel = new THREE.Vector3();
        if (keys['KeyW'] || keys['ArrowUp'])   targetVel.addScaledVector(forward,  baseSpeed);
        if (keys['KeyS'] || keys['ArrowDown']) targetVel.addScaledVector(forward, -baseSpeed * 0.6);
        if (keys['KeyQ']) targetVel.addScaledVector(up, -baseSpeed);
        if (keys['KeyE']) targetVel.addScaledVector(up,  baseSpeed);

        if (targetVel.lengthSq() > 0) {
            playerVel.lerp(targetVel, ACCEL);
        } else {
            playerVel.multiplyScalar(FRICTION);
        }

        playerPos.addScaledVector(playerVel, delta * 60);

        playerPos.x = Math.max(-1400, Math.min(1400, playerPos.x));
        playerPos.z = Math.max(-1400, Math.min(1400, playerPos.z));

        const groundY = getGroundY(playerPos.x, playerPos.z);
        playerPos.y = Math.max(groundY + 5, Math.min(170, playerPos.y));

        resolveEnvCollisions();

        if (playerHitbox) {
            playerHitbox.position.copy(playerPos);
            playerHitbox.rotation.y = yaw;
            playerHitbox.rotation.x = pitch;
        }

        const camTarget = new THREE.Vector3(
            playerPos.x - Math.sin(yaw) * getCamDist(),
            playerPos.y + getCamHeight(),
            playerPos.z - Math.cos(yaw) * getCamDist()
        );
        camera.position.lerp(camTarget, 0.1);
        camera.lookAt(playerPos);

        if (easyDamageCooldown > 0) easyDamageCooldown -= delta;

        updateNPCs(delta, elapsed);
        updateFlock(delta);
        updateItems(delta);
        checkCollisions();
    }

    seaweedList.forEach(({ model, speed, offset }) => {
        model.rotation.z = Math.sin(elapsed * speed + offset) * 0.08;
        model.rotation.x = Math.cos(elapsed * speed * 0.7 + offset) * 0.04;
    });

    const bp = bubbles.geometry.attributes.position;
    for (let i = 0; i < BUBBLE_COUNT; i++) {
        bp.setY(i, bp.getY(i) + 0.12);
        if (bp.getY(i) > 180) bp.setY(i, getGroundY(bp.getX(i), bp.getZ(i)));
    }
    bp.needsUpdate = true;

    renderer.render(scene, camera);
}

animate();