import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <h1>Hello Vite! Sigma.js test</h1>
  
`

/**
 * This example shows how to use different programs to render nodes.
 * This works in two steps:
 * 1. You must declare all the different rendering programs to sigma when you
 *    instantiate it
 * 2. You must give to each node and edge a "type" value that matches a declared
 *    program
 * The programs offered by default by sigma are in src/rendering/webgl/programs,
 * but you can add your own.
 *
 * Here in this example, some nodes are drawn with images in them using the
 * the getNodeProgramImage provided by Sigma. Some others are drawn as white
 * disc with a border, and the custom program to draw them is in this directory:
 * - "./node.border.ts" is the node program. It tells sigma what data to give to
 *   the GPU and how.
 * - "./node.border.vert.glsl" is the vertex shader. It tells the GPU how to
 *   interpret the data provided by the program to obtain a node position,
 *   mostly.
 * - "./node.border.frag.glsl" is the fragment shader. It tells for each pixel
 *   what color it should get, relatively to data given by the program and its
 *   position inside the shape. Basically, the GPU wants to draw a square, but
 *   we "carve" a disc in it.
 */

import Graph from "graphology";
import Sigma from "sigma";

import chroma from "chroma-js";
import { v4 as uuid } from "uuid";

import getNodeProgramImage from "sigma/rendering/webgl/programs/node.image";
import NodeProgramBorder from "./node.border";

import ForceSupervisor from "graphology-layout-force/worker";

const container = document.getElementById("sigma-container") as HTMLElement;

const graph = new Graph();

const RED = "#FA4F40";
const BLUE = "#727EE0";
const GREEN = "#5DB346";

// data - nodes
graph.addNode("John", { size: 15, label: "John", type: "image", image: "./user.svg", color: RED });
graph.addNode("Mary", { size: 15, label: "Mary", type: "image", image: "./user.svg", color: RED });
graph.addNode("Suzan", { size: 15, label: "Suzan", type: "image", image: "./user.svg", color: RED });
graph.addNode("Nantes", { size: 15, label: "Nantes", type: "image", image: "./city.svg", color: BLUE });
graph.addNode("New-York", { size: 15, label: "New-York", type: "image", image: "./city.svg", color: BLUE });
graph.addNode("Sushis", { size: 7, label: "Sushis", type: "border", color: GREEN });
graph.addNode("Falafels", { size: 7, label: "Falafels", type: "border", color: GREEN });
graph.addNode("Kouign Amann", { size: 7, label: "Kouign Amann", type: "border", color: GREEN });

// data - edges
graph.addEdge("John", "Mary", { type: "line", label: "works with", size: 5 });
graph.addEdge("Mary", "Suzan", { type: "line", label: "works with", size: 5 });
graph.addEdge("Mary", "Nantes", { type: "arrow", label: "lives in", size: 5 });
graph.addEdge("John", "New-York", { type: "arrow", label: "surfs with", size: 5 });
graph.addEdge("Suzan", "New-York", { type: "arrow", label: "lives in", size: 5 });
graph.addEdge("John", "Falafels", { type: "arrow", label: "eats", size: 5 });
graph.addEdge("Mary", "Sushis", { type: "arrow", label: "eats", size: 5 });
graph.addEdge("Suzan", "Kouign Amann", { type: "arrow", label: "eats", size: 5 });

// arrange x/y
graph.nodes().forEach((node, i) => {
  const angle = (i * 2 * Math.PI) / graph.order;
  graph.setNodeAttribute(node, "x", 100 * Math.cos(angle));
  graph.setNodeAttribute(node, "y", 100 * Math.sin(angle));
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const renderer = new Sigma(graph, container, {
  // We don't have to declare edgeProgramClasses here, because we only use the default ones ("line" and "arrow")
  nodeProgramClasses: {
    image: getNodeProgramImage(),
    border: NodeProgramBorder,
  },
  renderEdgeLabels: true,
});

// Create the spring layout and start it
const layout = new ForceSupervisor(graph);
layout.start();

//
// Drag'n'drop feature
// ~~~~~~~~~~~~~~~~~~~
//

// State for drag'n'drop
let draggedNode: string | null = null;
let isDragging = false;

// On mouse down on a node
//  - we enable the drag mode
//  - save in the dragged node in the state
//  - highlight the node
//  - disable the camera so its state is not updated
renderer.on("downNode", (e) => {
  console.log("on downNode");
  isDragging = true;
  draggedNode = e.node;
  graph.setNodeAttribute(draggedNode, "highlighted", true);
});

// On mouse move, if the drag mode is enabled, we change the position of the draggedNode
renderer.getMouseCaptor()?.on("mousemovebody", (e) => {
  console.log("on mousemovebody");
  if (!isDragging || !draggedNode) return;

  // Get new position of node
  const pos = renderer.viewportToGraph(e);

  graph.setNodeAttribute(draggedNode, "x", pos.x);
  graph.setNodeAttribute(draggedNode, "y", pos.y);

  // Prevent sigma to move camera:
  e.preventSigmaDefault();
  e.original.preventDefault();
  e.original.stopPropagation();
});

// On mouse up, we reset the autoscale and the dragging mode
renderer.getMouseCaptor()?.on("mouseup", () => {
  console.log("on mouseup");
  if (draggedNode) {
    graph.removeNodeAttribute(draggedNode, "highlighted");
  }
  isDragging = false;
  draggedNode = null;
});

// Disable the autoscale at the first down interaction
renderer.getMouseCaptor()?.on("mousedown", () => {
  if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
});

//
// Create node (and edge) by click
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//

// When clicking on the stage, we add a new node and connect it to the closest node
renderer.on("clickStage", ({ event }: { event: { x: number; y: number } }) => {
  console.log("on clickStage");
  // Sigma (ie. graph) and screen (viewport) coordinates are not the same.
  // So we need to translate the screen x & y coordinates to the graph one by calling the sigma helper `viewportToGraph`
  const coordForGraph = renderer.viewportToGraph({ x: event.x, y: event.y });

  // We create a new node
  const node = {
    ...coordForGraph,
    size: 10,
    color: chroma.random().hex(),
  };

  // Searching the two closest nodes to auto-create an edge to it
  const closestNodes = graph
    .nodes()
    .map((nodeId) => {
      const attrs = graph.getNodeAttributes(nodeId);
      const distance = Math.pow(node.x - attrs.x, 2) + Math.pow(node.y - attrs.y, 2);
      return { nodeId, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);

  // We register the new node into graphology instance
  const id = uuid();
  graph.addNode(id, node);

  // We create the edges
  closestNodes.forEach((e) => graph.addEdge(id, e.nodeId));
});
