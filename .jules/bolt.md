## 2026-07-01 - React Performance Optimization with useMemo
**Learning:** Found multiple expensive arrays manipulations (filtering and grouping `assignments`) inside the render cycle of `Dashboard.tsx` that run synchronously on every render and re-render. Since `assignments` changes less frequently than some UI elements, and there could be thousands of assignments, applying `useMemo` is a good optimization.
**Action:** When filtering or reducing arrays in React components, especially for items coming from state/props like database queries, wrap them in `useMemo` with proper dependencies.
