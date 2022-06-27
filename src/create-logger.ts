import chalk from 'chalk'
/* c8 ignore start */
type Logger = {
  prefix: () => Logger
  info: (...args: any[]) => void
  error: (...args: any[]) => void
}

type LoggerOptions = {
  silent?: boolean
}

export default function createLogger({ silent = true }: LoggerOptions): Logger {
  return {
    prefix(): Logger {
      process.stdout.write(chalk.red('[pg-bump]') + ' ')
      return this
    },
    info(...args: any[]): void {
      if (silent) return
      console.log(...args) // eslint-disable-line no-console
    },
    error(...args: any[]): void {
      if (silent) return
      console.error(...args)
    }
  }
}
