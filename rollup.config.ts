import typescript from '@rollup/plugin-typescript'

export default {
  input: {
    cli: 'src/cli.ts',
    index: 'src/index.ts'
  },
  output: [
    {
      dir: 'dist/cjs',
      format: 'cjs',
      exports: 'auto'
    },
    {
      dir: 'dist/esm',
      format: 'esm'
    }
  ],
  plugins: [
    typescript({ target: 'es2017', exclude: ['src/**/*.test.ts'] })
  ]
}
