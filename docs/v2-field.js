import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const stage=document.querySelector('#gardenStage');
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,.1,100);
camera.position.set(0,6.5,10.5);
camera.lookAt(0,0,-.5);
scene.add(new THREE.HemisphereLight(0xffd79b,0x40240d,2.4));
const sun=new THREE.DirectionalLight(0xfff1ca,4.2);sun.position.set(-4,9,5);sun.castShadow=true;scene.add(sun);
const crop=new THREE.Group(),pieces=new THREE.Group();scene.add(crop,pieces);
let pumpkinGeometry=null,pendingCount=0,pendingState={};
const pieceLoader=new GLTFLoader(),pieceCache=new Map();
const pieceFiles={boar:'cinghiale.glb',farmer:'contadino-2.glb',shotgun:'contadino.glb',crow:'corvo.glb',raccoon:'procione.glb',fence:'recinto.glb',scarecrow:'spaventapasseri.glb'};

function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}}
function clearCrop(){while(crop.children.length){const child=crop.children.pop();child.material?.dispose()}}
function loadPiece(kind){if(pieceCache.has(kind))return pieceCache.get(kind);const promise=new Promise((resolve,reject)=>pieceLoader.load(`assets/pieces/${pieceFiles[kind]}`,gltf=>{const model=gltf.scene;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const color={boar:0xa75b2d,farmer:0x779d42,shotgun:0xa16b38,crow:0x3f4752,raccoon:0x9a8072,fence:0x9a642f,scarecrow:0xe1ad42}[kind],emissive=new THREE.Color(color).multiplyScalar(.18);o.material=new THREE.MeshStandardMaterial({color,emissive,roughness:.72,side:THREE.DoubleSide})}});if(!['fence','crow'].includes(kind)){model.rotation.x=-Math.PI/2;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);model.position.y=-box.min.y}resolve(model)},undefined,reject));pieceCache.set(kind,promise);return promise}
function clearPieces(){while(pieces.children.length)pieces.remove(pieces.children[0])}
function addPiece(kind,position,scale=.8,rotation=0){loadPiece(kind).then(source=>{if(pendingState._version!==position.version)return;const model=source.clone(true);model.position.set(position.x,position.y||0,position.z);model.rotation.y=rotation;model.scale.setScalar(scale);pieces.add(model)}).catch(()=>{})}
function showPieces(state){pendingState={...state,_version:(pendingState._version||0)+1};const version=pendingState._version;clearPieces();for(let i=0;i<Math.min(6,state.fence||0);i++)addPiece('fence',{x:-3.25+i*1.3,z:3.05,version},.48,Math.PI/2);if(state.scarecrow)addPiece('scarecrow',{x:3.35,z:.1,version},.72,-.25);if(state.farmer)addPiece('farmer',{x:3.15,z:3.2,version},.62,-.45);if(state.shotgun)addPiece('shotgun',{x:-3.2,z:3.2,version},.68,.45);for(let i=0;i<Math.min(4,state.crows||0);i++)addPiece('crow',{x:-2.5+i*1.6,y:.55,z:-2.75,version},.42,i%2?.4:-.3);for(let i=0;i<Math.min(4,state.raccoons||0);i++)addPiece('raccoon',{x:-3.1+i*1.15,z:2.8,version},.42,.2);for(let i=0;i<Math.min(2,state.boars||0);i++)addPiece('boar',{x:-1.8+i*3.5,z:2.3,version},.62,i?.5:-.5)}
function fillField(count,state={}){pendingCount=Math.max(0,Math.floor(count||0));showPieces(state);if(!pumpkinGeometry)return;clearCrop();const visible=Math.min(pendingCount,30);for(let i=0;i<visible;i++){const rowFromBottom=Math.floor(i/6),row=4-rowFromBottom,col=i%6,z=-3.2+row*1.2,spacing=1.2-row*.0375;const mesh=new THREE.Mesh(pumpkinGeometry,new THREE.MeshStandardMaterial({color:row%2?0xf28a20:0xffa126,roughness:.72,metalness:0}));mesh.position.set((col-2.5)*spacing,.02,z);mesh.rotation.y=((i*137.5)%360)*Math.PI/180;mesh.scale.setScalar(.44+row*.035);mesh.castShadow=true;mesh.receiveShadow=true;crop.add(mesh)}}
window.showPumpkinField=fillField;

new STLLoader().load('assets/cute-little-pumpkin.stl',geometry=>{geometry.computeVertexNormals();geometry.center();geometry.rotateX(-Math.PI/2);const box=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position),size=new THREE.Vector3();box.getSize(size);geometry.scale(1/Math.max(size.x,size.z),1/Math.max(size.x,size.z),1/Math.max(size.x,size.z));geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox.min.y,0);pumpkinGeometry=geometry;fillField(pendingCount,pendingState)},undefined,()=>{document.querySelector('.garden-note').textContent='Modello 3D non disponibile'});
new ResizeObserver(resize).observe(stage);
function animate(){resize();renderer.render(scene,camera);requestAnimationFrame(animate)}animate();
