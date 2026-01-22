import { useRef, useEffect } from "react";
import * as d3 from "d3";
import "./TransactionStream.css";

interface DailyData {
  date: Date;
  expenses: number;
  income: number;
}

interface TransactionStreamProps {
  data: DailyData[];
  width?: number;
  height?: number;
}

export function TransactionStream({
  data,
  width = 600,
  height = 200,
}: TransactionStreamProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const yMax = Math.max(
      d3.max(data, (d) => d.expenses) || 0,
      d3.max(data, (d) => d.income) || 0
    );

    const yScale = d3
      .scaleLinear()
      .domain([0, yMax * 1.1])
      .range([innerHeight, 0]);

    // Gradient definitions
    const defs = svg.append("defs");

    // Expense gradient
    const expenseGradient = defs
      .append("linearGradient")
      .attr("id", "expense-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    expenseGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "var(--expense)")
      .attr("stop-opacity", 0.4);

    expenseGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "var(--expense)")
      .attr("stop-opacity", 0.05);

    // Income gradient
    const incomeGradient = defs
      .append("linearGradient")
      .attr("id", "income-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    incomeGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "var(--income)")
      .attr("stop-opacity", 0.4);

    incomeGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "var(--income)")
      .attr("stop-opacity", 0.05);

    // Area generators
    const expenseArea = d3
      .area<DailyData>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(d.expenses))
      .curve(d3.curveMonotoneX);

    const incomeArea = d3
      .area<DailyData>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(d.income))
      .curve(d3.curveMonotoneX);

    // Line generators
    const expenseLine = d3
      .line<DailyData>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.expenses))
      .curve(d3.curveMonotoneX);

    const incomeLine = d3
      .line<DailyData>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.income))
      .curve(d3.curveMonotoneX);

    // Draw expense area
    g.append("path")
      .datum(data)
      .attr("class", "area expense-area")
      .attr("fill", "url(#expense-gradient)")
      .attr("d", expenseArea);

    // Draw income area
    g.append("path")
      .datum(data)
      .attr("class", "area income-area")
      .attr("fill", "url(#income-gradient)")
      .attr("d", incomeArea);

    // Draw expense line
    g.append("path")
      .datum(data)
      .attr("class", "line expense-line")
      .attr("fill", "none")
      .attr("stroke", "var(--expense)")
      .attr("stroke-width", 2)
      .attr("d", expenseLine);

    // Draw income line
    g.append("path")
      .datum(data)
      .attr("class", "line income-line")
      .attr("fill", "none")
      .attr("stroke", "var(--income)")
      .attr("stroke-width", 2)
      .attr("d", incomeLine);

    // Animate lines
    const lines = g.selectAll(".line");
    lines.each(function () {
      const path = d3.select(this);
      const totalLength = (path.node() as SVGPathElement).getTotalLength();
      path
        .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(1000)
        .ease(d3.easeQuadOut)
        .attr("stroke-dashoffset", 0);
    });

    // X Axis
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(6)
          .tickFormat((d) => d3.timeFormat("%d %b")(d as Date))
      )
      .selectAll("text")
      .attr("fill", "var(--text-muted)")
      .attr("font-size", "10px")
      .attr("font-family", "var(--font-mono)");

    // Y Axis
    g.append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((d) => {
            const num = d as number;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return num.toString();
          })
      )
      .selectAll("text")
      .attr("fill", "var(--text-muted)")
      .attr("font-size", "10px")
      .attr("font-family", "var(--font-mono)");

    // Style axis lines
    g.selectAll(".domain").attr("stroke", "var(--border)");
    g.selectAll(".tick line").attr("stroke", "var(--border)");

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(yScale.ticks(4))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "2,4")
      .attr("opacity", 0.5);

  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <div className="transaction-stream empty">
        <p>No transaction data available</p>
      </div>
    );
  }

  return (
    <div className="transaction-stream">
      <div className="stream-header">
        <h3>Cash Flow</h3>
        <div className="stream-legend">
          <span className="legend-item">
            <span className="legend-dot expense" />
            Expenses
          </span>
          <span className="legend-item">
            <span className="legend-dot income" />
            Income
          </span>
        </div>
      </div>
      <svg ref={svgRef} />
    </div>
  );
}
