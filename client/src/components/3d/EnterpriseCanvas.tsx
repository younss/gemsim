// ============================================================================
// GEMSIM: 3D SPATIAL ENTERPRISE TOPOLOGY CANVAS (ARCHITECTURAL EDITION)
// Architectural Stack Visualizer, Fluted Databases, Floating 3D Text Billboards,
// Translucent Glass Podiums, and Particle Telemetry
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TopologyGraph, TopologyNode, EnterpriseLayer } from '../../types/index';
import {
  Layers,
  RotateCcw,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Activity,
  Zap,
} from 'lucide-react';

interface Props {
  topology: TopologyGraph;
  nodeHealthOverrides?: Record<string, { health: number; technicalDebt: number; status: any }>;
  selectedNodeId?: string | null;
  onSelectNode?: (node: TopologyNode | null) => void;
}

// Generates crisp billboard text sprites with shadow for 3D space
function createTextSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 1024;
  canvas.height = 256;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // High-DPI crisp typography
  ctx.font = '600 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow for legibility against dark space & geometries
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillText(text, 512, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(5.2, 1.3, 1);
  return sprite;
}

// Determines architectural mesh type (Tower, Database, or Slab)
function getNodeArchetype(node: TopologyNode): 'TOWER' | 'DATABASE' | 'SLAB' {
  const name = node.name.toLowerCase();
  const desc = (node.description || '').toLowerCase();
  const layer = node.layer;

  if (
    layer === 'DATA' ||
    name.includes('db') ||
    name.includes('data') ||
    name.includes('vault') ||
    name.includes('base') ||
    name.includes('reporting') ||
    desc.includes('database') ||
    desc.includes('storage') ||
    desc.includes('ledger')
  ) {
    return 'DATABASE';
  }

  if (
    name.includes('pipeline') ||
    name.includes('guardrail') ||
    name.includes('center') ||
    name.includes('gateway') ||
    name.includes('monolith') ||
    layer === 'APPLICATION'
  ) {
    return 'TOWER';
  }

  return 'SLAB';
}

// Semantic color grading matching enterprise architecture zones
function getNodeThemeColor(node: TopologyNode): { primary: number; glow: number; ring: number } {
  const name = node.name.toLowerCase();
  const desc = (node.description || '').toLowerCase();

  // 1. Offshore / Delivery / Pipelines / Outsourcing
  if (
    name.includes('offshore') ||
    name.includes('pipeline') ||
    name.includes('esn') ||
    desc.includes('offshore')
  ) {
    return { primary: 0x8b5cf6, glow: 0xa78bfa, ring: 0x7c3aed }; // Electric Violet
  }

  // 2. Onshore / Engineering / Internal Squads
  if (
    name.includes('onshore') ||
    name.includes('intern') ||
    name.includes('engineering') ||
    name.includes('knowledge')
  ) {
    return { primary: 0xd97757, glow: 0xf97316, ring: 0xe06c53 }; // Warm Terracotta / Coral
  }

  // 3. Guardrail / Governance / Gateway / Boundary
  if (
    name.includes('guardrail') ||
    name.includes('gateway') ||
    name.includes('governance') ||
    name.includes('bridge')
  ) {
    return { primary: 0x00f0ff, glow: 0x38bdf8, ring: 0x06b6d4 }; // Luminous Cyan
  }

  // 4. Data Vault / Sensitive / Core Business Logic / Reporting
  if (
    name.includes('vault') ||
    name.includes('core') ||
    name.includes('reporting') ||
    name.includes('database') ||
    node.layer === 'DATA'
  ) {
    return { primary: 0x14b8a6, glow: 0x2dd4bf, ring: 0x0d9488 }; // Deep Teal
  }

  // 5. Layer fallbacks
  if (node.layer === 'BUSINESS') {
    return { primary: 0xd97757, glow: 0xf97316, ring: 0xe06c53 };
  } else if (node.layer === 'APPLICATION') {
    return { primary: 0x8b5cf6, glow: 0xa78bfa, ring: 0x7c3aed };
  } else {
    return { primary: 0x10b981, glow: 0x34d399, ring: 0x059669 };
  }
}

export const EnterpriseCanvas: React.FC<Props> = ({
  topology,
  nodeHealthOverrides,
  selectedNodeId,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLayerFilter, setActiveLayerFilter] = useState<EnterpriseLayer | 'ALL'>('ALL');
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clickableMeshesRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<Array<{ mesh: THREE.Mesh; curve: THREE.Curve<THREE.Vector3>; progress: number; speed: number }>>([]);
  const animFrameRef = useRef<number | null>(null);
  const resetCameraFnRef = useRef<(() => void) | null>(null);

  // Merge node overrides
  const effectiveNodes: TopologyNode[] = topology.nodes.map(n => {
    const override = nodeHealthOverrides?.[n.id];
    if (override) {
      return {
        ...n,
        health: override.health,
        technicalDebt: override.technicalDebt,
        status: override.status,
      };
    }
    return n;
  });

  const selectedNode = effectiveNodes.find(n => n.id === selectedNodeId) || null;

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b13);
    scene.fog = new THREE.FogExp2(0x070b13, 0.025);
    sceneRef.current = scene;

    // 2. Camera setup with isometric tilt
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.4);
    dirLight1.position.set(15, 25, 18);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 1.0);
    dirLight2.position.set(-20, 15, -15);
    scene.add(dirLight2);

    const warmLight = new THREE.DirectionalLight(0xd97757, 0.7);
    warmLight.position.set(10, 5, -10);
    scene.add(warmLight);

    // 5. Perspective Floor Grid
    const mainGrid = new THREE.GridHelper(36, 24, 0x334155, 0x141e2e);
    mainGrid.position.y = 0;
    (mainGrid.material as THREE.Material).opacity = 0.4;
    (mainGrid.material as THREE.Material).transparent = true;
    scene.add(mainGrid);

    // 6. Raycaster & Mouse Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableMeshesRef.current, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitId = hitMesh.userData.nodeId;
        const node = effectiveNodes.find(n => n.id === hitId) || null;
        setHoveredNode(node);
        containerRef.current.style.cursor = 'pointer';
      } else {
        setHoveredNode(null);
        containerRef.current.style.cursor = 'default';
      }
    };

    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableMeshesRef.current, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitId = hitMesh.userData.nodeId;
        const node = effectiveNodes.find(n => n.id === hitId) || null;
        if (onSelectNode) onSelectNode(node);
      }
    };

    // Orbit controls with smooth spherical coordinates
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    const defaultSpherical = { radius: 24, theta: 0.45, phi: Math.PI / 2.7 };
    let spherical = { ...defaultSpherical };

    const updateCameraPosition = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 1.2, 0);
    };
    updateCameraPosition();

    resetCameraFnRef.current = () => {
      spherical = { ...defaultSpherical };
      updateCameraPosition();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = true;
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) {
        onPointerMove(e);
        return;
      }
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      spherical.theta -= dx * 0.006;
      spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi - dy * 0.006));
      updateCameraPosition();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(10, Math.min(48, spherical.radius + e.deltaY * 0.02));
      updateCameraPosition();
    };

    const dom = containerRef.current;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('click', onClick);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Resize handler
    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotate && !isDragging) {
        spherical.theta += delta * 0.12;
        updateCameraPosition();
      }

      // Animate edge telemetry particles
      for (const p of particlesRef.current) {
        p.progress += delta * p.speed;
        if (p.progress > 1) p.progress = 0;
        const point = p.curve.getPoint(p.progress);
        p.mesh.position.copy(point);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement && dom.contains(renderer.domElement)) {
        dom.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Construct 3D Architectural Scene when topology, selection, or filter changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing nodes, edges, labels, particles
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.userData?.isDynamicNode || obj.userData?.isDynamicEdge) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => scene.remove(obj));

    clickableMeshesRef.current = [];
    particlesRef.current = [];

    // Filter nodes
    const filteredNodes = activeLayerFilter === 'ALL'
      ? effectiveNodes
      : effectiveNodes.filter(n => n.layer === activeLayerFilter);

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // Construct each node with Codex-grade architectural meshes
    filteredNodes.forEach(node => {
      const isSelected = node.id === selectedNodeId;
      const archetype = getNodeArchetype(node);
      const colors = getNodeThemeColor(node);

      const nodeGroup = new THREE.Group();
      nodeGroup.userData = { isDynamicNode: true, nodeId: node.id };

      // Base spatial coordinates
      const posX = node.position.x;
      const posY = Math.max(0, node.position.y * 0.4); // ground-anchored isometric elevation
      const posZ = node.position.z;
      nodeGroup.position.set(posX, posY, posZ);

      let topY = 1.0;

      if (archetype === 'TOWER') {
        // --- 1. ARCHITECTURAL TOWER: MULTI-STORY STACKED GLASS SLICES ---
        const numSlabs = 3 + (node.criticalPath ? 1 : 0);
        const w = 1.85;
        const d = 1.85;
        const slabH = 0.38;
        const gap = 0.12;

        // Ground Pedestal (Plinth)
        const podGeom = new THREE.BoxGeometry(w + 0.6, 0.1, d + 0.6);
        const podMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.3,
          metalness: 0.6,
          transparent: true,
          opacity: 0.65,
        });
        const podMesh = new THREE.Mesh(podGeom, podMat);
        podMesh.position.y = 0.05;
        nodeGroup.add(podMesh);

        const podEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(podGeom),
          new THREE.LineBasicMaterial({ color: colors.glow, transparent: true, opacity: 0.35 })
        );
        podMesh.add(podEdges);

        // Stacked Slabs
        for (let s = 0; s < numSlabs; s++) {
          const slabGeom = new THREE.BoxGeometry(w, slabH, d);
          const slabMat = new THREE.MeshPhysicalMaterial({
            color: colors.primary,
            transparent: true,
            opacity: isSelected ? 0.88 : 0.65,
            roughness: 0.15,
            metalness: 0.1,
            transmission: 0.2,
            emissive: colors.primary,
            emissiveIntensity: isSelected ? 0.6 : 0.22,
          });
          const slabMesh = new THREE.Mesh(slabGeom, slabMat);
          const slabY = 0.1 + (slabH / 2) + s * (slabH + gap);
          slabMesh.position.y = slabY;
          slabMesh.userData = { nodeId: node.id };

          const slabEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(slabGeom),
            new THREE.LineBasicMaterial({
              color: isSelected ? 0xffffff : colors.glow,
              transparent: true,
              opacity: isSelected ? 0.95 : 0.75,
            })
          );
          slabMesh.add(slabEdges);

          nodeGroup.add(slabMesh);
          clickableMeshesRef.current.push(slabMesh);

          topY = slabY + slabH / 2;
        }
      } else if (archetype === 'DATABASE') {
        // --- 2. DATABASE BARREL: TRANSLUCENT FLUTED CYLINDER WITH GROUND HALO ---
        const radius = 1.05;
        const height = 1.95;

        // Ground Pedestal
        const podGeom = new THREE.BoxGeometry(radius * 2 + 0.6, 0.1, radius * 2 + 0.6);
        const podMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.3,
          metalness: 0.6,
          transparent: true,
          opacity: 0.65,
        });
        const podMesh = new THREE.Mesh(podGeom, podMat);
        podMesh.position.y = 0.05;
        nodeGroup.add(podMesh);

        // Surrounding ground halo ring
        const ringGeom = new THREE.RingGeometry(radius * 1.35, radius * 1.4, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: colors.ring,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.06;
        nodeGroup.add(ringMesh);

        // Cylinder Body
        const cylGeom = new THREE.CylinderGeometry(radius, radius, height, 24);
        const cylMat = new THREE.MeshPhysicalMaterial({
          color: colors.primary,
          transparent: true,
          opacity: isSelected ? 0.88 : 0.62,
          roughness: 0.15,
          metalness: 0.1,
          transmission: 0.25,
          emissive: colors.primary,
          emissiveIntensity: isSelected ? 0.6 : 0.22,
        });
        const cylMesh = new THREE.Mesh(cylGeom, cylMat);
        cylMesh.position.y = 0.1 + height / 2;
        cylMesh.userData = { nodeId: node.id };

        // Fluted wireframe ribs
        const wireGeom = new THREE.WireframeGeometry(cylGeom);
        const wireMat = new THREE.LineBasicMaterial({
          color: isSelected ? 0xffffff : colors.glow,
          transparent: true,
          opacity: 0.45,
        });
        const wireMesh = new THREE.LineSegments(wireGeom, wireMat);
        cylMesh.add(wireMesh);

        nodeGroup.add(cylMesh);
        clickableMeshesRef.current.push(cylMesh);

        topY = 0.1 + height;
      } else {
        // --- 3. SERVICE SLAB: LOW-PROFILE MICROSERVICE / INTERNAL SQUAD ---
        const w = 2.0;
        const d = 1.6;
        const height = 0.78;

        // Ground Pedestal
        const podGeom = new THREE.BoxGeometry(w + 0.6, 0.1, d + 0.6);
        const podMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.3,
          metalness: 0.6,
          transparent: true,
          opacity: 0.65,
        });
        const podMesh = new THREE.Mesh(podGeom, podMat);
        podMesh.position.y = 0.05;
        nodeGroup.add(podMesh);

        // Halo Ring
        const ringGeom = new THREE.RingGeometry(w * 0.85, w * 0.89, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: colors.ring,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.y = 0.06;
        nodeGroup.add(ringMesh);

        // Slab Body
        const slabGeom = new THREE.BoxGeometry(w, height, d);
        const slabMat = new THREE.MeshPhysicalMaterial({
          color: colors.primary,
          transparent: true,
          opacity: isSelected ? 0.88 : 0.65,
          roughness: 0.15,
          metalness: 0.1,
          transmission: 0.25,
          emissive: colors.primary,
          emissiveIntensity: isSelected ? 0.6 : 0.25,
        });
        const slabMesh = new THREE.Mesh(slabGeom, slabMat);
        slabMesh.position.y = 0.1 + height / 2;
        slabMesh.userData = { nodeId: node.id };

        const slabEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(slabGeom),
          new THREE.LineBasicMaterial({
            color: isSelected ? 0xffffff : colors.glow,
            transparent: true,
            opacity: 0.85,
          })
        );
        slabMesh.add(slabEdges);

        nodeGroup.add(slabMesh);
        clickableMeshesRef.current.push(slabMesh);

        topY = 0.1 + height;
      }

      // --- FLOATING 3D TEXT BILLBOARD ---
      const labelSprite = createTextSprite(node.name, '#ffffff');
      labelSprite.position.set(0, topY + 0.7, 0);
      nodeGroup.add(labelSprite);

      scene.add(nodeGroup);
    });

    // Create Curved Data Flow Pipelines & Telemetry Particles
    topology.edges.forEach(edge => {
      if (!filteredNodeIds.has(edge.fromId) || !filteredNodeIds.has(edge.toId)) return;

      const fromNode = effectiveNodes.find(n => n.id === edge.fromId);
      const toNode = effectiveNodes.find(n => n.id === edge.toId);
      if (!fromNode || !toNode) return;

      const p1 = new THREE.Vector3(fromNode.position.x, Math.max(0, fromNode.position.y * 0.4) + 0.6, fromNode.position.z);
      const p2 = new THREE.Vector3(toNode.position.x, Math.max(0, toNode.position.y * 0.4) + 0.6, toNode.position.z);

      // Create gentle curved connection arc
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid.y += Math.min(1.2, p1.distanceTo(p2) * 0.15); // gentle elevation arch

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const points = curve.getPoints(24);
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);

      const edgeColor = edge.status === 'BOTTLENECK' ? 0xef4444 : edge.status === 'OPTIMIZED' ? 0x00f0ff : 0x64748b;
      const lineMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: edge.status === 'BOTTLENECK' ? 0.8 : 0.35,
      });

      const line = new THREE.Line(lineGeom, lineMat);
      line.userData = { isDynamicEdge: true };
      scene.add(line);

      // Data telemetry particle
      const particleGeom = new THREE.SphereGeometry(0.16, 10, 10);
      const particleMat = new THREE.MeshBasicMaterial({
        color: edge.status === 'BOTTLENECK' ? 0xff4d4f : 0xc084fc,
      });
      const particleMesh = new THREE.Mesh(particleGeom, particleMat);
      particleMesh.userData = { isDynamicEdge: true };
      scene.add(particleMesh);

      particlesRef.current.push({
        mesh: particleMesh,
        curve,
        progress: Math.random(),
        speed: edge.status === 'BOTTLENECK' ? 0.25 : 0.65,
      });
    });
  }, [topology, nodeHealthOverrides, selectedNodeId, activeLayerFilter]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[480px] bg-dark-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full flex-1 relative select-none">
        {/* Top Left: LIVE ENTERPRISE MODEL Pill Badge (Codex-inspired) */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-dark-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-slate-700/60 shadow-lg">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-200 tracking-wider uppercase">
            Live Enterprise Model
          </span>
        </div>

        {/* Top Right: Reset View & Fullscreen Action Buttons (Codex-inspired) */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={() => resetCameraFnRef.current && resetCameraFnRef.current()}
            className="p-2 rounded-lg bg-dark-900/80 hover:bg-dark-800 backdrop-blur-md text-slate-300 border border-slate-700/60 transition-all shadow-lg"
            title="Reset Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-dark-900/80 hover:bg-dark-800 backdrop-blur-md text-slate-300 border border-slate-700/60 transition-all shadow-lg"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-lg backdrop-blur-md text-xs transition-colors flex items-center gap-1.5 border shadow-lg ${
              autoRotate ? 'bg-indigo-500/30 text-indigo-300 border-indigo-500/50' : 'bg-dark-900/80 text-slate-300 border-slate-700/60 hover:bg-dark-800'
            }`}
            title="Toggle Continuous Orbit Rotation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="font-mono text-[11px] hidden sm:inline">Orbit</span>
          </button>
        </div>

        {/* Bottom Left: Architecture Planes Filter Tabs */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-1.5 bg-dark-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono shadow-lg">
          <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Planes:</span>
          {(['ALL', 'BUSINESS', 'APPLICATION', 'DATA', 'INFRASTRUCTURE'] as const).map(layer => (
            <button
              key={layer}
              onClick={() => setActiveLayerFilter(layer)}
              className={`text-[11px] px-2.5 py-0.5 rounded transition-all font-mono ${
                activeLayerFilter === layer
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {layer}
            </button>
          ))}
        </div>

        {/* Bottom Right: Status Legend */}
        <div className="absolute bottom-4 right-4 z-10 hidden md:flex items-center gap-3 bg-dark-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono shadow-lg">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-slate-300">Modern/Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="text-slate-300">Technical Drift</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="text-slate-300">Critical Bottleneck</span>
          </div>
        </div>

        {/* Hover Tooltip */}
        {hoveredNode && (
          <div className="absolute top-16 right-4 z-10 bg-dark-850/95 backdrop-blur-md p-3 rounded-lg border border-slate-700 shadow-xl max-w-xs animate-fadeIn pointer-events-none">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-sm text-slate-100">{hoveredNode.name}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                {hoveredNode.layer}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2 line-clamp-2">{hoveredNode.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-dark-900 p-2 rounded border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">TECH DEBT</span>
                <span className={`font-semibold ${hoveredNode.technicalDebt > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {hoveredNode.technicalDebt}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">LATENCY</span>
                <span className="text-slate-200">{hoveredNode.telemetry.latencyMs} ms</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Node Deep Inspector Drawer */}
      {selectedNode && (
        <div className="border-t border-slate-800 bg-dark-900/95 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-slideUp">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-100 text-base">{selectedNode.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                {selectedNode.layer}
              </span>
              {selectedNode.criticalPath && (
                <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Critical Path
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">{selectedNode.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="bg-dark-850 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">HEALTH STATUS</span>
              <span className={`font-bold ${selectedNode.health >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {selectedNode.status} ({selectedNode.health}/100)
              </span>
            </div>

            <div className="bg-dark-850 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">TECH DEBT INDEX</span>
              <span className={`font-bold ${selectedNode.technicalDebt >= 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {selectedNode.technicalDebt}%
              </span>
            </div>

            <div className="bg-dark-850 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">THROUGHPUT / LATENCY</span>
              <span className="text-cyan-400 font-semibold">
                {selectedNode.telemetry.throughputRps} rps | {selectedNode.telemetry.latencyMs}ms
              </span>
            </div>

            <div className="bg-dark-850 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">OPEX RUN-RATE</span>
              <span className="text-slate-200 font-semibold">${selectedNode.costPerRound}K / round</span>
            </div>

            <button
              onClick={() => onSelectNode && onSelectNode(null)}
              className="text-xs text-slate-400 hover:text-slate-200 underline ml-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
