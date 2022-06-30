import chalk from 'chalk'

export default {
  info(...args: any[]): void {
    // eslint-disable-next-line no-console
    process.stdout.write(chalk.red('[pg-bump]') + ' ') && console.log(...args)
  },
  error(...args: any[]): void {
    process.stdout.write(chalk.red('[pg-bump]') + ' ') && console.error(...args)
  }
}
