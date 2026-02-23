import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { getCategoryById } from "../../lib/categorizer/defaultRules";
import "./SpendingWheel.css";

interface CategoryData {
  categoryId: string;
  amount: number;
  count: number;
}

interface SpendingWheelProps {
  data: CategoryData[];
  totalExpenses: number;
  size?: number;
}

export function SpendingWheel({
  data,
  totalExpenses,
  size = 300,
}: SpendingWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = size;
    const height = size;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.55;
    const outerRadius = radius * 0.85;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Create pie layout
    const pie = d3
      .pie<CategoryData>()
      .value((d) => d.amount)
      .sort(null)
      .padAngle(0.02);

    // Create arc generator
    const arc = d3
      .arc<d3.PieArcDatum<CategoryData>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(4);

    // Hover arc (slightly larger)
    const hoverArc = d3
      .arc<d3.PieArcDatum<CategoryData>>()
      .innerRadius(innerRadius - 4)
      .outerRadius(outerRadius + 8)
      .cornerRadius(4);

    // Create gradient definitions
    const defs = svg.append("defs");

    data.forEach((d) => {
      const category = getCategoryById(d.categoryId);
      const gradient = defs
        .append("linearGradient")
        .attr("id", `gradient-${d.categoryId}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%");

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", category.color)
        .attr("stop-opacity", 1);

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.color(category.color)?.darker(0.5)?.toString() || category.color)
        .attr("stop-opacity", 1);
    });

    // Add glow filter
    const filter = defs
      .append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Draw arcs
    const arcs = g
      .selectAll(".arc")
      .data(pie(data))
      .enter()
      .append("g")
      .attr("class", "arc");

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => `url(#gradient-${d.data.categoryId})`)
      .attr("stroke", "var(--surface)")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .style("transition", "all 0.3s ease")
      .on("mouseenter", function (_event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("d", (datum) => hoverArc(datum as d3.PieArcDatum<CategoryData>) || "")
          .attr("filter", "url(#glow)");
        setHoveredCategory(d.data.categoryId);
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("d", (datum) => arc(datum as d3.PieArcDatum<CategoryData>) || "")
          .attr("filter", null);
        setHoveredCategory(null);
      });

    // Animate entrance
    arcs
      .selectAll("path")
      .attr("opacity", 0)
      .transition()
      .duration(600)
      .delay((_, i) => i * 50)
      .attr("opacity", 1);

    // Add center circle
    g.append("circle")
      .attr("r", innerRadius - 10)
      .attr("fill", "var(--surface)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);

  }, [data, size, totalExpenses]);

  const formatAmount = (amount: number) => {
    if (amount >= 100000) {
      return `${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  };

  const hoveredData = data.find((d) => d.categoryId === hoveredCategory);
  const hoveredCategoryInfo = hoveredCategory
    ? getCategoryById(hoveredCategory)
    : null;

  return (
    <div className="spending-wheel">
      <div className="wheel-container" style={{ width: size, height: size }}>
        <svg ref={svgRef} />
        <div className="wheel-center">
          {hoveredData && hoveredCategoryInfo ? (
            <>
              <span className="wheel-icon">{hoveredCategoryInfo.icon}</span>
              <span className="wheel-amount" style={{ color: hoveredCategoryInfo.color }}>
                {formatAmount(hoveredData.amount)}
              </span>
              <span className="wheel-label">{hoveredCategoryInfo.name}</span>
            </>
          ) : (
            <>
              <span className="wheel-total-label">Total Spent</span>
              <span className="wheel-amount">{formatAmount(totalExpenses)}</span>
              <span className="wheel-label">This Period</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
