"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { assemblyBounds, type PlacedPart } from "@/lib/assembly/geometry";
import { formatLength } from "@/lib/units";
import type { SignalState } from "@/lib/types";

/** Scene units are centimetres; the domain works in millimetres. */
const MM_TO_UNITS = 0.1;

export type ViewerMode = "solid" | "exploded" | "xray" | "measure";

export interface Viewer3DProps {
  parts: PlacedPart[];
  mode: ViewerMode;
  showGrid: boolean;
  hiddenSlots: string[];
  selectedProductId: string | null;
  /** Per-product signal used to tint parts with a documented conflict. */
  signals: Record<string, SignalState>;
  onSelect: (productId: string | null) => void;
  onReady?: (api: ViewerApi) => void;
}

export interface ViewerApi {
  screenshot: () => string | null;
  resetView: () => void;
}

const SLOT_COLORS: Record<string, string> = {
  "upper-receiver": "#8892a6",
  "lower-receiver": "#6f7a8d",
  barrel: "#5a6470",
  handguard: "#3f6f8f",
  "muzzle-device": "#9b6b3f",
  suppressor: "#7a5a3a",
  "bolt-carrier-group": "#7d8794",
  "charging-handle": "#6b7482",
  trigger: "#8a7b52",
  stock: "#5a6472",
  grip: "#4f5765",
  "buffer-system": "#66707e",
  optic: "#3d7f74",
  mount: "#4a8a7e",
  bipod: "#5d6b52",
  light: "#8f8f4a",
  "sling-hardware": "#5b5b6b",
  accessory: "#565f6d",
};

const SIGNAL_COLORS: Record<SignalState, string> = {
  GREEN: "#2fa06a",
  YELLOW: "#f0b429",
  RED: "#e0524f",
  GRAY: "#6b7280",
};

function partColor(part: PlacedPart, signal: SignalState | undefined): string {
  if (signal === "RED" || signal === "YELLOW") return SIGNAL_COLORS[signal];
  return SLOT_COLORS[part.slotKey] ?? "#6b7280";
}

function Part({
  part,
  mode,
  selected,
  signal,
  explodeOffset,
  onSelect,
}: {
  part: PlacedPart;
  mode: ViewerMode;
  selected: boolean;
  signal: SignalState | undefined;
  explodeOffset: number;
  onSelect: (id: string | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const xray = mode === "xray";

  const position: [number, number, number] = [
    part.position[0] * MM_TO_UNITS,
    (part.position[1] + explodeOffset) * MM_TO_UNITS,
    part.position[2] * MM_TO_UNITS,
  ];

  const rotation: [number, number, number] = [
    THREE.MathUtils.degToRad(part.rotationDeg[0]),
    THREE.MathUtils.degToRad(part.rotationDeg[1]),
    THREE.MathUtils.degToRad(part.rotationDeg[2]),
  ];

  const color = partColor(part, signal);
  const emissive = selected ? "#f5a524" : hovered ? "#94a3b8" : "#000000";

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selected ? null : part.productId);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {part.shape === "box" ? (
        <mesh castShadow receiveShadow>
          <boxGeometry
            args={[
              part.lengthMm * MM_TO_UNITS,
              part.heightMm * MM_TO_UNITS,
              part.widthMm * MM_TO_UNITS,
            ]}
          />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0}
            metalness={0.55}
            roughness={0.45}
            transparent={xray}
            opacity={xray ? 0.28 : 1}
            depthWrite={!xray}
          />
        </mesh>
      ) : (
        <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry
            args={[
              (part.diameterMm / 2) * MM_TO_UNITS,
              (part.diameterMm / 2) * MM_TO_UNITS,
              part.lengthMm * MM_TO_UNITS,
              28,
              1,
              part.shape === "tube",
            ]}
          />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0}
            metalness={0.6}
            roughness={0.4}
            side={part.shape === "tube" ? THREE.DoubleSide : THREE.FrontSide}
            transparent={xray || part.shape === "tube"}
            opacity={xray ? 0.24 : part.shape === "tube" ? 0.55 : 1}
            depthWrite={!xray && part.shape !== "tube"}
          />
        </mesh>
      )}

      {(selected || hovered) && (
        <Html
          center
          position={[0, (part.heightMm / 2) * MM_TO_UNITS + 1.2, 0]}
          wrapperClass="pointer-events-none"
        >
          <div className="pointer-events-none whitespace-nowrap rounded border border-line bg-surface/95 px-2 py-1 text-[10px] text-ink shadow-lg">
            <span className="font-mono uppercase tracking-wider text-ink-faint">
              {part.slotKey}
            </span>
            <span className="mx-1.5 text-line-strong">|</span>
            {part.label}
            {part.lengthApproximate ? (
              <span className="ml-1.5 text-signal-yellow">length not published</span>
            ) : null}
          </div>
        </Html>
      )}

      {mode === "measure" ? <MeasurementOverlay part={part} /> : null}
    </group>
  );
}

function MeasurementOverlay({ part }: { part: PlacedPart }) {
  const half = (part.lengthMm / 2) * MM_TO_UNITS;
  const y = ((part.shape === "box" ? part.heightMm : part.diameterMm) / 2) * MM_TO_UNITS + 0.6;
  const points: [number, number, number][] = [
    [-half, y, 0],
    [half, y, 0],
  ];
  return (
    <group>
      <Line points={points} color="#f5a524" lineWidth={1} />
      <Line
        points={[
          [-half, y - 0.3, 0],
          [-half, y + 0.3, 0],
        ]}
        color="#f5a524"
        lineWidth={1}
      />
      <Line
        points={[
          [half, y - 0.3, 0],
          [half, y + 0.3, 0],
        ]}
        color="#f5a524"
        lineWidth={1}
      />
      <Html center position={[0, y + 0.7, 0]} wrapperClass="pointer-events-none">
        <div className="pointer-events-none whitespace-nowrap rounded bg-base/90 px-1.5 py-0.5 font-mono text-[10px] text-accent">
          {formatLength(part.lengthMm)}
          {part.lengthApproximate ? " (placeholder)" : ""}
        </div>
      </Html>
    </group>
  );
}

/** Bridges the imperative renderer handle out to the toolbar. */
function ViewerBridge({
  onReady,
  target,
  distance,
}: {
  onReady?: (api: ViewerApi) => void;
  target: [number, number, number];
  distance: number;
}) {
  const { gl, camera } = useThree();
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;

  const frameKey = `${target.map((value) => value.toFixed(1)).join(",")}|${distance.toFixed(1)}`;

  const frame = useCallback(() => {
    camera.position.set(target[0] + distance * 0.12, distance * 0.3, distance * 0.85);
    camera.lookAt(target[0], target[1], target[2]);
    if (controls) {
      controls.target.set(target[0], target[1], target[2]);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, controls, frameKey]);

  // Reframe whenever the assembly's extents change — adding the first part to
  // an empty scene would otherwise leave the camera at its initial distance.
  useEffect(() => {
    frame();
  }, [frame]);

  useEffect(() => {
    if (!onReady) return;
    onReady({
      // `preserveDrawingBuffer` keeps the last frame readable, so the canvas
      // can be captured without forcing an extra render pass.
      screenshot: () => {
        try {
          return gl.domElement.toDataURL("image/png");
        } catch {
          return null;
        }
      },
      resetView: frame,
    });
  }, [gl, onReady, frame]);

  return null;
}

export function Viewer3D({
  parts,
  mode,
  showGrid,
  hiddenSlots,
  selectedProductId,
  signals,
  onSelect,
  onReady,
}: Viewer3DProps) {
  const visibleParts = useMemo(
    () => parts.filter((part) => !hiddenSlots.includes(part.slotKey)),
    [parts, hiddenSlots],
  );
  const bounds = useMemo(() => assemblyBounds(visibleParts), [visibleParts]);
  const target: [number, number, number] = [
    bounds.center[0] * MM_TO_UNITS,
    bounds.center[1] * MM_TO_UNITS,
    bounds.center[2] * MM_TO_UNITS,
  ];
  const distance = Math.max(20, bounds.size[0] * MM_TO_UNITS * 1.1);
  const apiRef = useRef<ViewerApi | null>(null);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: [target[0] + distance * 0.12, distance * 0.3, distance * 0.85], fov: 40 }}
      onPointerMissed={() => onSelect(null)}
      className="touch-pan-y"
    >
      <color attach="background" args={["#0a0c11"]} />
      <fog attach="fog" args={["#0a0c11", distance * 1.8, distance * 5]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[30, 60, 40]} intensity={1.15} castShadow />
      <directionalLight position={[-40, 20, -30]} intensity={0.4} />

      {showGrid ? (
        <Grid
          position={[target[0], bounds.min[1] * MM_TO_UNITS - 4, 0]}
          args={[200, 200]}
          cellSize={2}
          cellThickness={0.5}
          cellColor="#1b2029"
          sectionSize={10}
          sectionThickness={0.8}
          sectionColor="#2a323f"
          fadeDistance={distance * 4}
          infiniteGrid
          followCamera={false}
        />
      ) : null}

      {visibleParts.map((part, index) => (
        <Part
          key={`${part.productId}-${part.slotKey}`}
          part={part}
          mode={mode}
          selected={selectedProductId === part.productId}
          signal={signals[part.productId]}
          explodeOffset={mode === "exploded" ? explodeOffsetFor(part, index) : 0}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        makeDefault
        target={target}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={distance * 6}
      />
      <ViewerBridge
        target={target}
        distance={distance}
        onReady={(api) => {
          apiRef.current = api;
          onReady?.(api);
        }}
      />
    </Canvas>
  );
}

/** Exploded view lifts parts apart vertically, keeping axial order readable. */
function explodeOffsetFor(part: PlacedPart, index: number): number {
  const tier: Record<string, number> = {
    optic: 140,
    mount: 100,
    "charging-handle": 70,
    "upper-receiver": 40,
    "bolt-carrier-group": 10,
    barrel: -20,
    handguard: 80,
    "muzzle-device": -50,
    suppressor: -80,
    "lower-receiver": -110,
    trigger: -150,
    grip: -190,
    "buffer-system": -140,
    stock: -170,
    bipod: -60,
    light: 60,
    "sling-hardware": 50,
    accessory: 30,
  };
  return tier[part.slotKey] ?? (index % 2 === 0 ? 60 : -60);
}
