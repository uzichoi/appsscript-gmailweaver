import * as d3 from "d3";
import React, { useEffect, useRef } from "react";

const NetworkChart = ({ data }) => {
  const chartRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      console.error("Invalid data format: 'nodes' and 'edges' are required arrays.");
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const HIDDEN_TYPES = new Set(["EMAIL", "DATE", "EMAIL_ADDRESS", "FILE_TYPE"]);
    const getNodeType = (n) => String(n.entity_type || n.type || "").toUpperCase();

    // ✅ D3가 edge.source/target을 객체로 바꿔도 안전하게 id 뽑기
    const edgeEndpointId = (x) => {
      if (x == null) return "";
      if (typeof x === "string" || typeof x === "number") return String(x);
      if (typeof x === "object") return "id" in x ? String(x.id) : String(x);
      return String(x);
    };

    // =========================
    // 1) Visible nodes/edges
    // =========================
    const visibleNodesRaw = data.nodes.filter((n) => !HIDDEN_TYPES.has(getNodeType(n)));
    const visibleIdSet = new Set(visibleNodesRaw.map((n) => String(n.id)));

    const visibleEdgesRaw = data.edges.filter((e) => {
      const s = String(e.source);
      const t = String(e.target);
      return visibleIdSet.has(s) && visibleIdSet.has(t);
    });

    const nodes = visibleNodesRaw.map((d) => ({
      ...d,
      degree: typeof d.degree === "number" ? d.degree : 5,
    }));

    // ✅ description을 복사해두기(tooltip은 이걸로만)
    const edges = visibleEdgesRaw.map((d) => ({
      ...d,
      value: 1,
      description: typeof d.description === "string" ? d.description : "",
    }));

    // =========================
    // 2) Tooltip text
    // =========================
    const formatNodeTooltip = (d) => {
      const id = String(d.id ?? "");
      const desc = typeof d.description === "string" && d.description.trim() ? d.description : "(no description)";
      return `ID: ${id}\nDescription: ${desc}`;
    };

    const formatEdgeTooltip = (e) => {
      // ✅ JSON의 description을 그대로
      if (typeof e.description === "string" && e.description.trim()) return e.description;

      // (보험) description이 진짜 없을 때만
      const rel = String(e.relationship || e.type || "").toUpperCase() || "RELATED";
      const s = edgeEndpointId(e.source);
      const t = edgeEndpointId(e.target);
      return `${rel}: ${s} -> ${t}`;
    };

    // =========================
    // 3) D3 render
    // =========================
    const color = d3.scaleOrdinal(["#f7ad63", "#6ade53", "#f15fb2", "#83d7f1", "#a133ff"]);

    const sizeScale = d3
      .scaleLinear()
      .domain([0, d3.max(nodes, (d) => d.degree)])
      .range([15, 30]);

    const svg = d3
      .select(chartRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "100%");

    svg.selectAll("*").remove();

    const graphGroup = svg.append("g");

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("white-space", "pre-line")
      .style("background", "rgba(0, 0, 0, 0.85)")
      .style("color", "#fff")
      .style("padding", "10px")
      .style("border-radius", "8px")
      .style("font-size", "12px")
      .style("pointer-events", "none");

    const showTooltip = (event, text) => {
      tooltip
        .style("visibility", "visible")
        .text(text)
        .style("top", `${event.pageY + 10}px`)
        .style("left", `${event.pageX + 10}px`);
    };
    const moveTooltip = (event) => {
      tooltip.style("top", `${event.pageY + 10}px`).style("left", `${event.pageX + 10}px`);
    };
    const hideTooltip = () => tooltip.style("visibility", "hidden");

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id((d) => d.id).distance(150).strength(0.2))
      .force("charge", d3.forceManyBody().strength(-50).distanceMin(20).distanceMax(500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => sizeScale(d.degree) + 10))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.03)
      .alphaTarget(0.02);

    const edge = graphGroup
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value))
      .on("mouseover", (event, d) => showTooltip(event, formatEdgeTooltip(d)))
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseout", () => hideTooltip());

    const nodeGroup = graphGroup
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .on("mouseover", (event, d) => showTooltip(event, formatNodeTooltip(d)))
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseout", () => hideTooltip())
      .call(
        d3
          .drag()
          .on("start", (event) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on("drag", (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on("end", (event) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          })
      );

    nodeGroup
      .append("circle")
      .attr("r", (d) => sizeScale(d.degree))
      .attr("fill", (d) => color(getNodeType(d) || "DEFAULT"))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text((d) => d.id);

    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 10])
      .on("zoom", (event) => graphGroup.attr("transform", event.transform));
    svg.call(zoom);

    simulation.on("tick", () => {
      edge
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg ref={chartRef}></svg>
    </div>
  );
};

export default NetworkChart;