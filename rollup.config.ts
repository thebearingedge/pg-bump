import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      exports: 'auto'
    },
    {
      file: 'dist/esm/index.js',
      format: 'esm'
    }
  ],
  plugins: [
    typescript({ exclude: ['src/**/*.test.ts'] })
  ]
}
