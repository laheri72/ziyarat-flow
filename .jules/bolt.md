## 2024-05-19 - Avoid redundant O(N) finds in render
**Learning:** Calling `.find()` inside a JSX template on arrays (especially if done multiple times for the same condition) creates unnecessary O(N) operations during every re-render.
**Action:** Extract the `.find()` result to a local variable using an IIFE (Immediately Invoked Function Expression) or useMemo inside the render cycle to calculate it once, reducing time complexity.
