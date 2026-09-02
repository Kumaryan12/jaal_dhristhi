'use client';

import '@xyflow/react/dist/style.css';

import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';

interface InteractiveGraphProps {
  graph: { nodes: Node[]; edges: Edge[] };
  onSelectNode?: (id: string) => void;
  showMiniMap?: boolean;
  fitPadding?: number;
  minZoom?: number;
  maxZoom?: number;
  ariaLabel: string;
}

export function InteractiveGraph({
  graph,
  onSelectNode,
  showMiniMap = false,
  fitPadding = 0.2,
  minZoom = 0.25,
  maxZoom = 2,
  ariaLabel,
}: InteractiveGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(prepareNodes(graph.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(graph.edges);
  const instance = useRef<ReactFlowInstance<Node, Edge> | null>(null);

  useEffect(() => {
    setNodes(prepareNodes(graph.nodes));
    setEdges(graph.edges);
    const frame = window.requestAnimationFrame(() => instance.current?.fitView({ padding: fitPadding, duration: 420 }));
    return () => window.cancelAnimationFrame(frame);
  }, [fitPadding, graph, setEdges, setNodes]);

  const resetHighlight = useCallback(() => {
    const sourceNodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const sourceEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));
    setNodes((current) => current.map((node) => ({
      ...node,
      style: { ...node.style, opacity: sourceNodes.get(node.id)?.style?.opacity ?? 1 },
    })));
    setEdges((current) => current.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: sourceEdges.get(edge.id)?.style?.opacity ?? 1,
        strokeWidth: sourceEdges.get(edge.id)?.style?.strokeWidth ?? 1.4,
      },
    })));
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  const highlightNode = useCallback((nodeId: string) => {
    const connected = new Set<string>([nodeId]);
    graph.edges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target);
      if (edge.target === nodeId) connected.add(edge.source);
    });
    setNodes((current) => current.map((node) => ({
      ...node,
      style: { ...node.style, opacity: connected.has(node.id) ? 1 : 0.18 },
    })));
    setEdges((current) => current.map((edge) => {
      const active = edge.source === nodeId || edge.target === nodeId;
      const source = graph.edges.find((item) => item.id === edge.id);
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: active ? 1 : 0.08,
          strokeWidth: active ? 2.8 : source?.style?.strokeWidth ?? 1.4,
        },
      };
    }));
  }, [graph.edges, setEdges, setNodes]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onSelectNode?.(node.id)}
      onNodeMouseEnter={(_, node) => highlightNode(node.id)}
      onNodeMouseLeave={resetHighlight}
      onPaneClick={resetHighlight}
      onInit={(nextInstance) => { instance.current = nextInstance; }}
      fitView
      fitViewOptions={{ padding: fitPadding }}
      minZoom={minZoom}
      maxZoom={maxZoom}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      defaultEdgeOptions={{ interactionWidth: 24 }}
      proOptions={{ hideAttribution: true }}
      aria-label={ariaLabel}
    >
      <Background variant={BackgroundVariant.Dots} color="#dce8e1" gap={20} size={1.1} />
      <Controls showInteractive={false} position="bottom-left" />
      {showMiniMap && (
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          nodeColor={(node) => String(node.style?.borderColor ?? '#9ca3af')}
          maskColor="rgba(246,250,248,.84)"
        />
      )}
    </ReactFlow>
  );
}

function prepareNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const focus = Boolean(node.data?.isFocus);
    return {
      ...node,
      className: [node.className, 'graph-node-motion', focus ? 'graph-node-focus' : ''].filter(Boolean).join(' '),
    };
  });
}
