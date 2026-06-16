import fs from 'fs';
// Check if useMemo is imported in Dashboard.tsx
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
if (content.includes('useMemo')) {
  console.log('useMemo is already used in Dashboard.tsx');
} else {
  console.log('useMemo is NOT used in Dashboard.tsx');
}
