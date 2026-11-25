/** Every model file's size in bytes, by URL (vite.config.ts's model-sizes). */
declare module 'virtual:model-sizes' {
  const sizes: Record<string, number>;
  export default sizes;
}
