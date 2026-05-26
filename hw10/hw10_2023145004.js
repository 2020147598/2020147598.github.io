import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { initStats, initRenderer, initCamera, initOrbitControls } from './util.js';

const scene = new THREE.Scene();
const renderer = initRenderer();
const camera = initCamera();
const stats = initStats();
const orbitControls = initOrbitControls(camera, renderer);

camera.position.set(0, 60, 120);
camera.lookAt(0, 0, 0);

const aspect = window.innerWidth / window.innerHeight;
const orthoCamera = new THREE.OrthographicCamera(
  -80 * aspect, 80 * aspect, 80, -80, 0.1, 1000
);
orthoCamera.position.set(0, 60, 120);
orthoCamera.lookAt(0, 0, 0);

let activeCamera = camera;

const textureLoader = new THREE.TextureLoader();
scene.background = new THREE.Color(0x000000);

const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

const pointLight = new THREE.PointLight(0xffffff, 800, 0);
scene.add(pointLight);

const ambientLight = new THREE.AmbientLight(0x888888);
scene.add(ambientLight);

const planetData = [
  { name: 'Mercury', radius: 1.5, distance: 20, color: '#a6a6a6', rotationSpeed: 0.02,  orbitSpeed: 0.02  },
  { name: 'Venus',   radius: 3,   distance: 35, color: '#e39e1c', rotationSpeed: 0.015, orbitSpeed: 0.015 },
  { name: 'Earth',   radius: 3.5, distance: 50, color: '#3498db', rotationSpeed: 0.01,  orbitSpeed: 0.01  },
  { name: 'Mars',    radius: 2.5, distance: 65, color: '#c0392b', rotationSpeed: 0.008, orbitSpeed: 0.008 },
];

const textureFiles = {
  Mercury: 'Mercury.jpg',
  Venus:   'Venus.jpg',
  Earth:   'Earth.jpg',
  Mars:    'Mars.jpg',
};

const planets = planetData.map(data => {
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
  const material = new THREE.MeshPhongMaterial({ color: data.color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = data.distance;
  pivot.add(mesh);

  textureLoader.load(textureFiles[data.name], (tex) => {
    mesh.material.map = tex;
    mesh.material.color.set(0xffffff);
    mesh.material.needsUpdate = true;
  });

  return { name: data.name, mesh, pivot, rotationSpeed: data.rotationSpeed, orbitSpeed: data.orbitSpeed };
});

const gui = new GUI();

const cameraFolder = gui.addFolder('Camera');
const camState = { 'Current Camera': 'Perspective' };
cameraFolder.add({
  'Switch Camera Type': function () {
    activeCamera = (activeCamera === camera) ? orthoCamera : camera;
    camState['Current Camera'] = (activeCamera === camera) ? 'Perspective' : 'Orthographic';
    cameraFolder.controllers.forEach(c => c.updateDisplay());
  }
}, 'Switch Camera Type');
cameraFolder.add(camState, 'Current Camera').listen().disable();
cameraFolder.open();

planets.forEach(planet => {
  const folder = gui.addFolder(planet.name);
  folder.add(planet, 'rotationSpeed', 0, 0.1).name('Rotation Speed');
  folder.add(planet, 'orbitSpeed', 0, 0.1).name('Orbit Speed');
  folder.open();
});

function render() {
  stats.update();
  orbitControls.update();
  planets.forEach(planet => {
    planet.mesh.rotation.y += planet.rotationSpeed;
    planet.pivot.rotation.y += planet.orbitSpeed;
  });
  requestAnimationFrame(render);
  renderer.render(scene, activeCamera);
}

render();