// ============================================================================
// GEMSIM: 3D SPATIAL ENTERPRISE TOPOLOGY CANVAS
// Three.js Interactive 4-Layer Enterprise Visualizer with Particle Telemetry
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TopologyGraph, TopologyNode, EnterpriseLayer } from '../../types/index';
import { Layers, Eye, RefreshCw, Activity, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  topology: TopologyGraph;
  nodeHealthOverrides?: Record<string, { health: number; technicalDebt: number; status: any }>;
  selectedNodeId?: string | null;
  onSelectNode?: (node: TopologyNode | null) => void;
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

  // References for Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const particlesRef = useRef<Array<{ mesh: THREE.Mesh; path: THREE.LineCurve3; progress: number; speed: number }>>([]);
  const animFrameRef = useRef<number | null>(null);

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

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b13);
    scene.fog = new THREE.FogExp2(0x070b13, 0.035);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 8, 22);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 0.8);
    dirLight2.position.set(-15, -10, -10);
    scene.add(dirLight2);

    // 5. Grid planes for 4 Enterprise Tiers
    const layerConfigs: Array<{ layer: EnterpriseLayer; y: number; color: number; label: string }> = [
      { layer: 'BUSINESS', y: 5.5, color: 0x00f0ff, label: 'L1: Business Capabilities' },
      { layer: 'APPLICATION', y: 1.8, color: 0x6366f1, label: 'L2: Application Services' },
      { layer: 'DATA', y: -1.8, color: 0xf59e0b, label: 'L3: Data Pipelines & Storage' },
      { layer: 'INFRASTRUCTURE', y: -5.5, color: 0x10b981, label: 'L4: Infrastructure & Cloud' },
    ];

    layerConfigs.forEach(cfg => {
      const grid = new THREE.GridHelper(26, 14, cfg.color, 0x1e293b);
      grid.position.y = cfg.y;
      grid.material.opacity = 0.22;
      grid.material.transparent = true;
      scene.add(grid);
    });

    // 6. Raycaster & Mouse Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(nodeMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

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
      const meshes = Array.from(nodeMeshesRef.current.values());
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const hitId = hitMesh.userData.nodeId;
        const node = effectiveNodes.find(n => n.id === hitId) || null;
        if (onSelectNode) onSelectNode(node);
      }
    };

    // Orbit controls using mouse drag
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let spherical = { radius: 24, theta: 0.2, phi: Math.PI / 2.3 };

    const updateCameraPosition = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPosition();

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
      spherical.radius = Math.max(10, Math.min(45, spherical.radius + e.deltaY * 0.02));
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
        spherical.theta += delta * 0.15;
        updateCameraPosition();
      }

      // Animate edge telemetry particles
      for (const p of particlesRef.current) {
        p.progress += delta * p.speed;
        if (p.progress > 1) p.progress = 0;
        const point = p.path.getPoint(p.progress);
        p.mesh.position.copy(point);
      }

      // Rotate nodes subtly
      nodeMeshesRef.current.forEach((mesh) => {
        mesh.rotation.y += delta * 0.5;
      });

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

  // Update nodes and edges when topology or filter changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing nodes and edges
    nodeMeshesRef.current.forEach(mesh => scene.remove(mesh));
    nodeMeshesRef.current.clear();

    particlesRef.current.forEach(p => scene.remove(p.mesh));
    particlesRef.current = [];

    // Filter nodes
    const filteredNodes = activeLayerFilter === 'ALL'
      ? effectiveNodes
      : effectiveNodes.filter(n => n.layer === activeLayerFilter);

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));

    // Create 3D Nodes
    filteredNodes.forEach(node => {
      const isSelected = node.id === selectedNodeId;
      const size = isSelected ? 1.4 : node.criticalPath ? 1.15 : 0.95;

      // Select geometry based on enterprise layer
      let geom: THREE.BufferGeometry;
      if (node.layer === 'BUSINESS') {
        geom = new THREE.DodecahedronGeometry(size);
      } else if (node.layer === 'APPLICATION') {
        geom = new THREE.BoxGeometry(size * 1.5, size * 1.2, size * 1.5);
      } else if (node.layer === 'DATA') {
        geom = new THREE.CylinderGeometry(size * 1.1, size * 1.1, size * 1.6, 12);
      } else {
        geom = new THREE.OctahedronGeometry(size * 1.3);
      }

      // Status color
      let color = 0x10b981; // Healthy / Modern
      if (node.technicalDebt >= 65 || node.status === 'CRITICAL') {
        color = 0xef4444; // Crimson
      } else if (node.technicalDebt >= 40 || node.status === 'DEGRADED') {
        color = 0xf59e0b; // Amber
      } else if (node.status === 'MODERNIZED') {
        color = 0x00f0ff; // Cyan
      }

      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.8,
        emissive: color,
        emissiveIntensity: isSelected ? 0.7 : 0.25,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(node.position.x, node.position.y, node.position.z);
      mesh.userData = { nodeId: node.id };

      // Add wireframe cage
      const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.18 });
      const wireMesh = new THREE.Mesh(geom.clone(), wireMat);
      mesh.add(wireMesh);

      scene.add(mesh);
      nodeMeshesRef.current.set(node.id, mesh);
    });

    // Create Edges & Flow Particles
    topology.edges.forEach(edge => {
      if (!filteredNodeIds.has(edge.fromId) || !filteredNodeIds.has(edge.toId)) return;

      const fromNode = effectiveNodes.find(n => n.id === edge.fromId);
      const toNode = effectiveNodes.find(n => n.id === edge.toId);
      if (!fromNode || !toNode) return;

      const p1 = new THREE.Vector3(fromNode.position.x, fromNode.position.y, fromNode.position.z);
      const p2 = new THREE.Vector3(toNode.position.x, toNode.position.y, toNode.position.z);

      const path = new THREE.LineCurve3(p1, p2);
      const tubeGeom = new THREE.TubeGeometry(path, 16, 0.08, 6, false);

      const edgeColor = edge.status === 'BOTTLENECK' ? 0xef4444 : edge.status === 'OPTIMIZED' ? 0x00f0ff : 0x475569;
      const edgeMat = new THREE.MeshBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: edge.status === 'BOTTLENECK' ? 0.85 : 0.45,
      });

      const tube = new THREE.Mesh(tubeGeom, edgeMat);
      scene.add(tube);

      // Data telemetry particle
      const particleGeom = new THREE.SphereGeometry(0.22, 8, 8);
      const particleMat = new THREE.MeshBasicMaterial({
        color: edge.status === 'BOTTLENECK' ? 0xff3b30 : 0x00f0ff,
      });
      const particleMesh = new THREE.Mesh(particleGeom, particleMat);
      scene.add(particleMesh);

      particlesRef.current.push({
        mesh: particleMesh,
        path,
        progress: Math.random(),
        speed: edge.status === 'BOTTLENECK' ? 0.2 : 0.6,
      });
    });
  }, [topology, nodeHealthOverrides, selectedNodeId, activeLayerFilter]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-dark-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="w-full h-full flex-1 relative select-none">
        {/* Top Controls Overlay */}
        <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-dark-900/80 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/60 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mr-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Architecture Planes:</span>
          </div>

          {(['ALL', 'BUSINESS', 'APPLICATION', 'DATA', 'INFRASTRUCTURE'] as const).map(layer => (
            <button
              key={layer}
              onClick={() => setActiveLayerFilter(layer)}
              className={`text-xs px-2.5 py-1 rounded transition-colors font-mono ${
                activeLayerFilter === layer
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {layer}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
              autoRotate ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50' : 'text-slate-400 hover:bg-slate-800'
            }`}
            title="Toggle Auto Rotation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span>Rotate</span>
          </button>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 bg-dark-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-slate-300">Modern/Healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <span className="text-slate-300">Technical Drift</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="text-slate-300">Critical Bottleneck</span>
          </div>
        </div>

        {/* Hover / Hint Tooltip */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 z-10 bg-dark-850/95 backdrop-blur-md p-3.5 rounded-lg border border-slate-700 shadow-xl max-w-xs animate-fadeIn">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-bold text-sm text-slate-100">{hoveredNode.name}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                {hoveredNode.layer}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2.5 line-clamp-2">{hoveredNode.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-dark-900 p-2 rounded border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">TECHNICAL DEBT</span>
                <span className={`font-semibold ${hoveredNode.technicalDebt > 60 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {hoveredNode.technicalDebt}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">LATENCY</span>
                <span className="text-slate-200">{hoveredNode.telemetry.latencyMs} ms</span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-cyan-400/80 font-mono text-center">Click node for deep architectural inspection</div>
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
